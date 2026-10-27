import { cpSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import { contractSeed, mcpOverStdio } from "@wirecat/cli-core/testing"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  EngineError,
  type EngineEvent,
  type WaHistory,
  type WaMessage,
  type WhatsAppEngine,
} from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"
import { watchItems } from "./testing/watch-records.js"

const base = contractSeed({ ids: whatsAppIds })
const fresh: Message = {
  id: "3EB0000000000000000F01",
  chatId: base.busy,
  senderId: base.account?.id ?? null,
  senderName: "Owner",
  timestamp: new Date().toISOString(),
  editedAt: null,
  text: "synthetic own text",
  outgoing: true,
  attachments: [],
  replyTo: null,
  forwardedFrom: null,
  reactions: null,
}
const answered = base.messages.find((message) => message.chatId === base.dialog && !message.outgoing) as Message
const answer: Message = {
  ...fresh,
  id: "3EB0000000000000000F02",
  chatId: base.dialog,
  timestamp: "2026-09-01T09:31:00.000Z",
  text: "synthetic answer",
  replyToId: answered.id,
}
// Deleted for the owner alone, which also takes them out of the store: one each per test.
const [forMeOwn, forMeTheirs, forAgent] = [
  { ...fresh, chatId: base.dialog, id: "3EB0000000000000000F03", timestamp: "2026-08-01T09:00:00.000Z" },
  {
    ...answered,
    id: "3EB0000000000000000F04",
    timestamp: "2026-08-01T09:01:00.000Z",
    text: "synthetic text to delete",
  },
  { ...fresh, chatId: base.dialog, id: "3EB0000000000000000F05", timestamp: "2026-08-01T09:02:00.000Z" },
]
// Starred or deleted on the phone.
const [phoneStarred, phonePushed, phoneDeleted] = ["F10", "F11", "F12"].map((suffix, index) => ({
  ...answered,
  id: `3EB0000000000000000${suffix}`,
  timestamp: `2026-08-01T09:1${index}:00.000Z`,
})) as [Message, Message, Message]
const atLevel = Object.fromEntries(
  (["default", "readonly", "deny"] as const).map((level, at) => [
    level,
    {
      ...fresh,
      chatId: base.dialog,
      id: `3EB0000000000000000F0${6 + at}`,
      timestamp: `2026-08-01T09:0${3 + at}:00.000Z`,
    },
  ]),
) as Record<"default" | "readonly" | "deny", Message>
const [partlyDeleted, partlyRefused] = ["3EB0000000000000000F09", "3EB0000000000000000F0A"].map((id, at) => ({
  ...fresh,
  chatId: base.dialog,
  id,
  timestamp: `2026-08-01T09:0${6 + at}:00.000Z`,
})) as [Message, Message]
const ownChat = base.account?.id as string
const toSelf: Message = {
  ...fresh,
  chatId: ownChat,
  id: "3EB0000000000000000F13",
  timestamp: "2026-08-01T09:20:00.000Z",
}
const seed = {
  ...base,
  chats: [
    ...base.chats,
    {
      id: ownChat,
      title: "Owner",
      kind: "saved" as const,
      unreadCount: 0,
      lastMessageAt: toSelf.timestamp,
      participantsCount: null,
    },
  ],
  messages: [
    ...base.messages,
    fresh,
    answer,
    forMeOwn,
    forMeTheirs,
    forAgent,
    partlyDeleted,
    partlyRefused,
    ...Object.values(atLevel),
    phoneStarred,
    phonePushed,
    phoneDeleted,
    toSelf,
  ],
}
const inBusy = seed.messages.filter((message) => message.chatId === seed.busy)
const theirs = inBusy.filter((message) => !message.outgoing).at(-1) as Message
const oldOwn = inBusy.find((message) => message.outgoing && message.id !== fresh.id) as Message
// Deleted in one test, so kept apart from the messages the others address.
const [deletedOwn, deletedTheirs] = [
  inBusy.filter((message) => message.outgoing && message.id !== fresh.id).at(-1) as Message,
  inBusy.find((message) => !message.outgoing) as Message,
]

// Each test gets a copy of one filled store: a message one test deletes would otherwise be missing from the next.
let store = ""
let filledStore = ""
const env = () => ({ ...process.env, MESSAGING_STORE: store })

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    env: env(),
    ...(engine ? { engine } : {}),
    ...(signal ? { signal } : {}),
  })
  return { code, stdout: streams.stdout.join("\n"), stderr: streams.stderr.join("") }
}

const acting = async (argv: string[], { settingsKeys = true } = {}) => {
  let engine: FakeEngine | undefined
  const result = await wa(["actions", ...argv, "--json"], () => {
    engine = fakeEngine(seed, { settingsKeys })
    return engine
  })
  return {
    ...result,
    actions: engine?.actions ?? [],
    markedRead: engine?.markedRead ?? [],
    closed: engine?.closed,
    started: engine !== undefined,
  }
}

// A command that reads the store may first warn that no `wa serve` keeps it up to date.
const errorCode = (stderr: string) => JSON.parse(stderr.slice(stderr.indexOf("{"))).error.code

// Fills the store as the phone's first history push does, then stops watching.
const filled = async (profile: string, from: typeof seed) => {
  const controller = new AbortController()
  const filling = () => {
    const engine = fakeEngine(from)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => controller.abort())
      return stop
    }
    return engine
  }
  expect((await wa([profile, "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
}

beforeAll(async () => {
  store = join(mkdtempSync(join(tmpdir(), "wa-actions-")), "messages.db")
  await filled("actions", seed)
  filledStore = store
})

beforeEach(() => {
  const copy = mkdtempSync(join(tmpdir(), "wa-actions-"))
  cpSync(dirname(filledStore), copy, { recursive: true })
  store = join(copy, "messages.db")
})

describe("wa reactions", () => {
  it("puts a reaction on someone else's message, addressed by its stored sender", async () => {
    const result = await acting(["reactions", "add", seed.busy, theirs.id, "👍"])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "react", key: { chat: seed.busy, id: theirs.id, fromMe: false, sender: theirs.senderId }, emoji: "👍" },
    ])
    expect(result.closed).toBe(true)
  })

  it("takes the reaction off", async () => {
    const result = await acting(["reactions", "remove", seed.busy, theirs.id])
    expect(result.code).toBe(0)
    expect(result.actions).toMatchObject([{ op: "react", emoji: null }])
  })

  it("refuses a message the store does not hold, and sends nothing", async () => {
    const result = await acting(["reactions", "add", seed.busy, "3EB0000000000000000DEAD", "👍"])
    expect(result.code).toBe(6)
    expect(errorCode(result.stderr)).toBe("not_found")
    expect(result.actions).toEqual([])
  })
})

describe("wa messages pin", () => {
  it("pins someone else's message for the chat, addressed by its stored sender, for 7 days without a length", async () => {
    const result = await acting(["messages", "pin", seed.busy, theirs.id])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "pin", key: { chat: seed.busy, id: theirs.id, fromMe: false, sender: theirs.senderId }, duration: 604_800 },
    ])
    expect(JSON.parse(result.stdout).item).toMatchObject({ chat_id: seed.busy, message_id: theirs.id, pinned: true })
    expect(result.closed).toBe(true)
  })

  it("unpins the account's own message", async () => {
    const result = await acting(["messages", "unpin", seed.busy, fresh.id])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "unpin", key: { chat: seed.busy, id: fresh.id, fromMe: true, sender: fresh.senderId } },
    ])
  })

  it.each([
    ["24h", 86_400],
    ["7d", 604_800],
    ["30d", 2_592_000],
  ])("pins for %s with --expire-time", async (length, seconds) => {
    const result = await acting(["messages", "pin", seed.busy, theirs.id, "--expire-time", length])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "pin", key: { chat: seed.busy, id: theirs.id, fromMe: false, sender: theirs.senderId }, duration: seconds },
    ])
  })

  it("refuses a length WhatsApp does not offer before it starts the engine", async () => {
    const result = await acting(["messages", "pin", seed.busy, theirs.id, "--expire-time", "1h"])
    expect(result.code).toBe(2)
    expect(errorCode(result.stderr)).toBe("validation_error")
    expect(result.stderr).toContain("24h, 7d or 30d")
    expect(result.started).toBe(false)
  })

  it("refuses an agent's quiet pin over MCP before it starts the engine", async () => {
    let starts = 0
    const neverConnect = (): never => {
      starts += 1
      throw new Error("a refused pin must never connect")
    }
    const mcp = await mcpOverStdio((streams) =>
      run(["agent", "mcp", "serve"], {
        streams: captureStreams(),
        tty: false,
        env: env(),
        ...streams,
        engine: neverConnect,
      }),
    )
    const answer = await mcp.call("wa_write", {
      command: "messages pin",
      arguments: { chat: seed.busy, message: theirs.id, notify: false },
    })
    await mcp.close()
    expect((answer.body as { error: unknown }).error).toMatchObject({
      code: "validation_error",
      message: expect.stringContaining("notify"),
    })
    expect(starts).toBe(0)
  })

  it.each(["pin", "unpin"])("refuses to %s a message the store does not hold, and sends nothing", async (verb) => {
    const result = await acting(["messages", verb, seed.busy, "3EB0000000000000000DEAD"])
    expect(result.code).toBe(6)
    expect(errorCode(result.stderr)).toBe("not_found")
    expect(result.actions).toEqual([])
  })
})

describe("wa messages edit", () => {
  it("changes the text of the account's own recent message", async () => {
    const result = await acting(["messages", "edit", seed.busy, fresh.id, "fixed text"])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "edit", key: { chat: seed.busy, id: fresh.id, fromMe: true, sender: fresh.senderId }, text: "fixed text" },
    ])
  })

  it("writes --md in WhatsApp's own marks", async () => {
    const result = await acting(["messages", "edit", seed.busy, fresh.id, "**fixed** text", "--md"])
    expect(result.code).toBe(0)
    expect(result.actions).toMatchObject([{ op: "edit", text: "*fixed* text" }])
  })

  it.each([
    ["someone else's message", theirs.id],
    ["a message older than WhatsApp's edit window", oldOwn.id],
  ])("refuses %s, and sends nothing", async (_, id, ...options) => {
    const result = await acting(["messages", "edit", seed.busy, id, "fixed text", ...options])
    expect(result.code).toBe(2)
    expect(result.actions).toEqual([])
  })
})

describe("wa messages delete", () => {
  it("deletes for everyone with --for-everyone, each message by its own key", async () => {
    const result = await acting([
      "messages",
      "delete",
      seed.busy,
      `${deletedOwn.id},${deletedTheirs.id}`,
      "--for-everyone",
      "--allow-dangerous",
    ])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "revoke", key: { chat: seed.busy, id: deletedOwn.id, fromMe: true, sender: deletedOwn.senderId } },
      { op: "revoke", key: { chat: seed.busy, id: deletedTheirs.id, fromMe: false, sender: deletedTheirs.senderId } },
    ])
  })

  it("deletes for the owner alone without --for-everyone, each message by its key and time", async () => {
    const result = await acting([
      "messages",
      "delete",
      seed.dialog,
      `${forMeOwn.id},${forMeTheirs.id}`,
      "--allow-dangerous",
    ])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      {
        op: "deleteForMe",
        key: {
          chat: seed.dialog,
          id: forMeOwn.id,
          fromMe: true,
          sender: forMeOwn.senderId,
          timestamp: forMeOwn.timestamp,
        },
      },
      {
        op: "deleteForMe",
        key: {
          chat: seed.dialog,
          id: forMeTheirs.id,
          fromMe: false,
          sender: forMeTheirs.senderId,
          timestamp: forMeTheirs.timestamp,
        },
      },
    ])
  })

  it("deletes nothing when one of the messages is not in the store", async () => {
    const result = await acting([
      "messages",
      "delete",
      seed.dialog,
      answer.id,
      "3EB0000000000000000FFF",
      "--allow-dangerous",
    ])
    expect(result.code).toBe(6)
    expect(errorCode(result.stderr)).toBe("not_found")
    expect(result.actions).toEqual([])
  })

  it("asks first, so a script that cannot answer is refused and nothing is deleted", async () => {
    const result = await acting(["messages", "delete", seed.dialog, answer.id])
    expect(result.code).not.toBe(0)
    expect(JSON.parse(result.stderr.slice(result.stderr.indexOf("{"))).error.message).toContain("--allow-dangerous")
    expect(result.actions).toEqual([])
  })

  it("names what went when a later message fails, and does not call the run safe to retry", async () => {
    let engine: FakeEngine | undefined
    const result = await wa(
      [
        "actions",
        "messages",
        "delete",
        seed.dialog,
        `${partlyDeleted.id},${partlyRefused.id}`,
        "--allow-dangerous",
        "--json",
      ],
      () => {
        engine = fakeEngine(seed)
        const deleteForMe = engine.deleteForMe
        engine.deleteForMe = async (message) => {
          if (message.id === partlyRefused.id)
            throw new EngineError("provider_unavailable", "synthetic refusal", "settings.keys-missing")
          await deleteForMe(message)
        }
        return engine
      },
    )
    expect(result.code).toBe(12)
    const { error } = JSON.parse(result.stderr.slice(result.stderr.indexOf("{")))
    expect(error.message).toContain(`deleted ${partlyDeleted.id}; ${partlyRefused.id}`)
    expect(error.retry).toEqual({ safe: false })
    expect(engine?.actions.map((action) => action.key.id)).toEqual([partlyDeleted.id])
  })

  it("says to keep serve running when WhatsApp has not sent the settings keys yet", async () => {
    const result = await wa(
      ["actions", "messages", "delete", seed.dialog, answer.id, "--allow-dangerous", "--json"],
      () => fakeEngine(seed, { settingsKeys: false }),
    )
    expect(result.code).toBe(12)
    const { error } = JSON.parse(result.stderr.slice(result.stderr.indexOf("{")))
    expect(error).toMatchObject({ code: "provider_unavailable", reason: "settings.keys-missing" })
    expect(error.message).toContain("wa actions serve")
  })

  it("lets an agent delete over MCP for the owner alone, and never for everyone", async () => {
    expect((await wa(["agent", "config", "set", "permissions.messages.delete", "allow"])).code).toBe(0)
    let engine: FakeEngine | undefined
    const mcp = await mcpOverStdio((streams) =>
      run(["agent", "mcp", "serve"], {
        streams: captureStreams(),
        tty: false,
        env: env(),
        ...streams,
        engine: () => {
          engine = fakeEngine(seed)
          return engine
        },
      }),
    )
    const everyone = await mcp.call("wa_write", {
      command: "messages delete",
      arguments: { chat: seed.dialog, message: [forAgent.id], for_everyone: true },
    })
    const deleted = await mcp.call("wa_write", {
      command: "messages delete",
      arguments: { chat: seed.dialog, message: [forAgent.id] },
    })
    await mcp.close()

    // --for-everyone is the owner's alone, so the agent's tool has no such argument.
    expect(everyone.body).toMatchObject({ error: { code: "validation_error", reason: "input.invalid" } })
    expect(deleted.body).not.toHaveProperty("error")
    expect(engine?.actions).toEqual([
      {
        op: "deleteForMe",
        key: {
          chat: seed.dialog,
          id: forAgent.id,
          fromMe: true,
          sender: forAgent.senderId,
          timestamp: forAgent.timestamp,
        },
      },
    ])
  })
})

describe("an agent's messages delete over MCP, by permission level", () => {
  const agentDeletes = async (profile: string, message: Message) => {
    let engine: FakeEngine | undefined
    const mcp = await mcpOverStdio((streams) =>
      run([profile, "mcp", "serve"], {
        streams: captureStreams(),
        tty: false,
        env: env(),
        ...streams,
        engine: () => {
          engine = fakeEngine(seed)
          return engine
        },
      }),
    )
    const answer = await mcp.call("wa_write", {
      command: "messages delete",
      arguments: { chat: seed.dialog, message: [message.id] },
    })
    await mcp.close()
    return { body: answer.body as { error?: Record<string, unknown> }, actions: engine?.actions ?? [] }
  }

  it("goes ahead at the default level, ask, since no one is there to answer", async () => {
    const { body, actions } = await agentDeletes("mcp-ask", atLevel.default)
    expect(body).toMatchObject({ item: { deleted: [atLevel.default.id], for_everyone: false } })
    expect(actions).toMatchObject([{ op: "deleteForMe", key: { id: atLevel.default.id } }])
  })

  // The server does not offer a write the level forbids; asked for it anyway, it answers with the level's refusal.
  it.each(["readonly", "deny"] as const)("is not offered at %s, and the owner's own call exits 5", async (level) => {
    const profile = `mcp-${level}`
    const message = atLevel[level]
    expect((await wa([profile, "config", "set", "permissions.messages.delete", level])).code).toBe(0)
    const { body, actions } = await agentDeletes(profile, message)
    expect(body.error).toMatchObject({ code: "permission_error", reason: "access.denied" })
    expect(actions).toEqual([])

    let engine: FakeEngine | undefined
    const owner = await wa(
      [profile, "messages", "delete", seed.dialog, message.id, "--allow-dangerous", "--json"],
      () => {
        engine = fakeEngine(seed)
        return engine
      },
    )
    expect(owner.code).toBe(5)
    expect(errorCode(owner.stderr)).toBe("permission_error")
    expect(engine?.actions ?? []).toEqual([])
  })
})

/** `wa watch --events` while the phone pushes `events`, then stops; the lines it printed. */
const fromThePhone = async (events: EngineEvent[]) => {
  const controller = new AbortController()
  const pushing = () => {
    const engine = fakeEngine(seed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("star"))
        setImmediate(() => {
          for (const event of events) engine.push(event)
          setImmediate(() => controller.abort())
        })
      return stop
    }
    return engine
  }
  const result = await wa(["actions", "watch", "--events", "--jsonl"], pushing, controller.signal)
  expect(result.code, result.stderr).toBe(0)
  return watchItems(result.stdout)
}

const listedIds = async (chat: string, ...filters: string[]) => {
  const listed = await wa(["actions", "--offline", "messages", "list", chat, ...filters, "--json"])
  expect(listed.code, listed.stderr).toBe(0)
  return JSON.parse(listed.stdout).items.map((item: { id: string }) => item.id)
}

describe("stars and deletions made on the phone", () => {
  it("prints a star from the phone in watch, and keeps it until the phone takes it off", async () => {
    const star = (starred: boolean): EngineEvent => ({ event: "star", chat: seed.dialog, id: phoneStarred.id, starred })
    expect(await fromThePhone([star(true)])).toEqual([
      {
        event: "star",
        chat_id: seed.dialog,
        chat_title: expect.any(String),
        message_id: phoneStarred.id,
        starred: true,
      },
    ])
    expect(await listedIds(seed.dialog, "starred:true")).toContain(phoneStarred.id)

    await fromThePhone([star(false)])
    expect(await listedIds(seed.dialog, "starred:true")).not.toContain(phoneStarred.id)
  })

  it("applies full-sync stars and deletions through history without printing live changes", async () => {
    const printed = await fromThePhone([
      {
        event: "history",
        history: {
          kind: "other",
          chats: [],
          contacts: [],
          messages: [],
          votes: [],
          stars: [{ chat: seed.dialog, message: phoneStarred.id, starred: true }],
          deletions: [{ chat: seed.dialog, message: phoneDeleted.id }],
        },
      },
    ])
    expect(printed).toEqual([])
    expect(await listedIds(seed.dialog, "starred:true")).toContain(phoneStarred.id)
    expect(await listedIds(seed.dialog)).not.toContain(phoneDeleted.id)
  })

  it("keeps the star a history push carries on its message", async () => {
    const pushed: WaMessage = {
      id: phonePushed.id,
      chat: seed.dialog,
      sender: phonePushed.senderId,
      senderName: null,
      fromMe: false,
      timestamp: phonePushed.timestamp,
      editedAt: null,
      text: phonePushed.text,
      replyTo: null,
    }
    const history: Omit<WaHistory, "messages"> = { kind: "recent", chats: [], contacts: [], votes: [] }
    await fromThePhone([{ event: "history", history: { ...history, messages: [{ ...pushed, starred: true }] } }])
    expect(await listedIds(seed.dialog, "starred:true")).toContain(phonePushed.id)

    await fromThePhone([{ event: "history", history: { ...history, messages: [pushed] } }])
    expect(await listedIds(seed.dialog, "starred:true")).toContain(phonePushed.id)
  })

  it("drops a message the owner deleted for themselves on the phone", async () => {
    expect(await listedIds(seed.dialog)).toContain(phoneDeleted.id)
    await fromThePhone([{ event: "delete", chat: seed.dialog, id: phoneDeleted.id }])
    expect(await listedIds(seed.dialog)).not.toContain(phoneDeleted.id)
  })
})

describe("wa messages star", () => {
  it("stars someone else's message by its stored key, and answers that it is starred", async () => {
    const result = await acting(["messages", "star", seed.busy, theirs.id])
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({ chat_id: seed.busy, message_id: theirs.id, starred: true })
    expect(result.actions).toEqual([
      { op: "star", key: { chat: seed.busy, id: theirs.id, fromMe: false, sender: theirs.senderId }, starred: true },
    ])
    expect(result.closed).toBe(true)
  })

  it("keeps a star in the store, so starred:true lists the message until it is unstarred", async () => {
    const starredIds = async () => {
      const listed = await wa(["actions", "--offline", "messages", "list", seed.busy, "starred:true", "--json"])
      expect(listed.code, listed.stderr).toBe(0)
      return JSON.parse(listed.stdout).items.map((item: { id: string }) => item.id)
    }
    expect(await starredIds()).not.toContain(oldOwn.id)
    expect((await acting(["messages", "star", seed.busy, oldOwn.id])).code).toBe(0)
    expect(await starredIds()).toContain(oldOwn.id)
    expect((await acting(["messages", "unstar", seed.busy, oldOwn.id])).code).toBe(0)
    expect(await starredIds()).not.toContain(oldOwn.id)
  })

  it("takes the star off the account's own message", async () => {
    const result = await acting(["messages", "unstar", seed.busy, fresh.id])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "star", key: { chat: seed.busy, id: fresh.id, fromMe: true, sender: fresh.senderId }, starred: false },
    ])
  })

  it("refuses a message the store does not hold, and sends nothing", async () => {
    const result = await acting(["messages", "star", seed.busy, "3EB0000000000000000DEAD"])
    expect(result.code).toBe(6)
    expect(errorCode(result.stderr)).toBe("not_found")
    expect(result.actions).toEqual([])
  })

  it("says to keep serve running when WhatsApp has not sent the settings keys yet", async () => {
    const result = await wa(["actions", "messages", "star", seed.busy, theirs.id, "--json"], () =>
      fakeEngine(seed, { settingsKeys: false }),
    )
    expect(result.code).toBe(12)
    const { error } = JSON.parse(result.stderr.slice(result.stderr.indexOf("{")))
    expect(error).toMatchObject({ code: "provider_unavailable", reason: "settings.keys-missing" })
    expect(error.retry).toEqual({ safe: true })
  })

  it("lets an agent star a message over MCP", async () => {
    let engine: FakeEngine | undefined
    const mcp = await mcpOverStdio((streams) =>
      run(["agent", "mcp", "serve"], {
        streams: captureStreams(),
        tty: false,
        env: env(),
        ...streams,
        engine: () => {
          engine = fakeEngine(seed)
          return engine
        },
      }),
    )
    const starred = await mcp.call("wa_write", {
      command: "messages star",
      arguments: { chat: seed.busy, message: theirs.id },
    })
    await mcp.close()
    expect(starred.body).not.toHaveProperty("error")
    expect(engine?.actions).toMatchObject([{ op: "star", key: { id: theirs.id }, starred: true }])
  })
})

describe("marking read", () => {
  const newestTheirs = { op: "read", key: { chat: seed.busy, id: theirs.id, fromMe: false, sender: theirs.senderId } }
  const upTo = (message: Message) => ({
    chat: message.chatId,
    id: message.id,
    fromMe: message.outgoing === true,
    sender: message.senderId,
    timestamp: message.timestamp,
  })

  it("sends the read patch up to the newest message, then one receipt for the newest from someone else", async () => {
    const result = await acting(["chats", "mark-read", seed.busy])
    expect(result.code).toBe(0)
    expect(result.markedRead).toEqual([upTo(fresh)])
    expect(result.actions).toEqual([newestTheirs])
  })

  it("with --until-id on the account's own message, marks the newest one from someone else before it", async () => {
    const result = await acting(["chats", "mark-read", seed.busy, "--until-id", fresh.id])
    expect(result.code).toBe(0)
    expect(result.markedRead).toEqual([upTo(fresh)])
    expect(result.actions).toEqual([newestTheirs])
  })

  it("with --until-id, bounds the read patch by that message", async () => {
    const result = await acting(["chats", "mark-read", seed.busy, "--until-id", theirs.id])
    expect(result.code).toBe(0)
    expect(result.markedRead).toEqual([upTo(theirs)])
    expect(result.actions).toEqual([newestTheirs])
  })

  it("in the own chat sends the read patch alone, as the account's own messages have no receipt", async () => {
    const result = await acting(["chats", "mark-read", ownChat])
    expect(result.code).toBe(0)
    expect(result.markedRead).toEqual([upTo(toSelf)])
    expect(result.actions).toEqual([])
  })

  it("sends no receipt when WhatsApp has not sent the settings keys the read patch needs", async () => {
    const result = await acting(["chats", "mark-read", seed.busy], { settingsKeys: false })
    expect(result.code).not.toBe(0)
    const { error } = JSON.parse(result.stderr.slice(result.stderr.indexOf('{"error"')))
    expect(error).toMatchObject({ reason: "settings.keys-missing", retry: { safe: true } })
    expect(result.markedRead).toEqual([])
    expect(result.actions).toEqual([])
  })

  it.each([
    ["messages", "list", seed.busy],
    ["review", "--all"],
    ["inbox", "--all"],
  ])("a read %j sends no read patch or receipt and refuses the retired flags", async (...words) => {
    const plain = await acting(words)
    expect(plain.code).toBe(0)
    expect(plain.actions).toEqual([])
    expect(plain.markedRead).toEqual([])
    for (const flag of ["--mark-read", "--no-mark-read"]) {
      const refused = await acting([...words, flag])
      expect(refused.code).toBe(2)
      expect(refused.actions).toEqual([])
      expect(refused.markedRead).toEqual([])
    }
  })
})

describe("replies and live edits", () => {
  it("names the quoted message's sender and text when it answers a stored message", async () => {
    let engine: FakeEngine | undefined
    const result = await wa(
      ["actions", "messages", "send", seed.busy, "synthetic reply", "--reply-to", theirs.id],
      () => {
        engine = fakeEngine(seed)
        return engine
      },
    )
    expect(result.code).toBe(0)
    expect(engine?.sends).toMatchObject([
      { replyTo: theirs.id, quoted: { fromMe: false, sender: theirs.senderId, text: theirs.text } },
    ])
  })

  it("keeps an edited message's time and reply when the edit arrives live", async () => {
    const controller = new AbortController()
    const editing = () => {
      const engine = fakeEngine({ ...seed, messages: [] })
      const listen = engine.listen
      engine.listen = (kinds, onEvent) => {
        const stop = listen(kinds, onEvent)
        if (kinds.includes("edit"))
          setImmediate(() => {
            engine.push({
              event: "edit",
              message: {
                id: answer.id,
                chat: answer.chatId,
                sender: answer.senderId,
                senderName: null,
                fromMe: true,
                timestamp: "2026-09-01T09:45:00.000Z",
                editedAt: "2026-09-01T09:45:00.000Z",
                text: "synthetic answer, fixed",
                replyTo: null,
              },
            })
            setImmediate(() => controller.abort())
          })
        return stop
      }
      return engine
    }
    expect((await wa(["actions", "watch", "--jsonl"], editing, controller.signal)).code).toBe(0)

    const listed = await wa(["actions", "messages", "list", seed.dialog, "--json"], () => {
      throw new Error("a read must never start the engine")
    })
    const stored = JSON.parse(listed.stdout).items.find((message: Message) => message.id === answer.id)
    expect(stored).toMatchObject({
      timestamp: answer.timestamp,
      edited_at: "2026-09-01T09:45:00.000Z",
      text: "synthetic answer, fixed",
      reply_to_id: answered.id,
    })
  })

  it("answers messages edit with the message's own time", async () => {
    const result = await acting(["messages", "edit", seed.busy, fresh.id, "fixed again"])
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item.message).toMatchObject({ timestamp: fresh.timestamp, text: "fixed again" })
  })
})

describe("wa stats messages counters sync", () => {
  it("answers that WhatsApp keeps no view, reaction or comment counts, and never starts the engine", async () => {
    const neverStarted = () => {
      throw new Error("a counter refresh on WhatsApp must never start the engine")
    }
    const argv = ["actions", "stats", "messages", "counters", "sync", "--chat", seed.busy, "--limit", "2"]
    const refreshed = await wa([...argv, "--json"], neverStarted)
    expect(refreshed.code, refreshed.stderr).toBe(0)
    const item = JSON.parse(refreshed.stdout).item
    expect(item).toMatchObject({ dry_run: false, supported: [], unsupported: ["views", "reactions", "comments"] })
    expect(item.results).toHaveLength(2)
    expect(item.results.every((one: { status: string }) => one.status === "unsupported")).toBe(true)

    const preview = await wa(
      [...argv, "--counters", "views", "--max-messages", "1", "--dry-run", "--json"],
      neverStarted,
    )
    expect(JSON.parse(preview.stdout).item).toMatchObject({
      dry_run: true,
      counters: ["views"],
      supported: [],
      max_messages: 1,
    })
  })
})
