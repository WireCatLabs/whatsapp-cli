import { captureStreams } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import { contractSeed, mcpOverStdio } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

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
const seed = { ...base, messages: [...base.messages, fresh, answer] }
const inBusy = seed.messages.filter((message) => message.chatId === seed.busy)
const theirs = inBusy.filter((message) => !message.outgoing).at(-1) as Message
const oldOwn = inBusy.find((message) => message.outgoing && message.id !== fresh.id) as Message
// Deleted in one test, so kept apart from the messages the others address.
const [deletedOwn, deletedTheirs] = [
  inBusy.filter((message) => message.outgoing && message.id !== fresh.id).at(-1) as Message,
  inBusy.find((message) => !message.outgoing) as Message,
]

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    ...(engine ? { engine } : {}),
    ...(signal ? { signal } : {}),
  })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const acting = async (argv: string[]) => {
  let engine: FakeEngine | undefined
  const result = await wa(["actions", ...argv, "--json"], () => {
    engine = fakeEngine(seed)
    return engine
  })
  return { ...result, actions: engine?.actions ?? [], closed: engine?.closed, started: engine !== undefined }
}

// A command that reads the store may first warn that no `wa serve` keeps it up to date.
const errorCode = (stderr: string) => JSON.parse(stderr.slice(stderr.indexOf("{"))).error.code

beforeAll(async () => {
  const controller = new AbortController()
  const filling = () => {
    const engine = fakeEngine(seed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => controller.abort())
      return stop
    }
    return engine
  }
  expect((await wa(["actions", "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
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
  it("pins someone else's message for the chat, addressed by its stored sender, for the engine's default length", async () => {
    const result = await acting(["messages", "pin", seed.busy, theirs.id])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "pin", key: { chat: seed.busy, id: theirs.id, fromMe: false, sender: theirs.senderId } },
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
      run(["agent", "mcp"], { streams: captureStreams(), tty: false, ...streams, engine: neverConnect }),
    )
    const answer = await mcp.call("wa_write", {
      command: "messages pin",
      arguments: { chat: seed.busy, message: theirs.id, notify: false },
    })
    await mcp.close()
    expect((answer.body as { error: { code: string } }).error.code).toBe("validation_error")
    expect(starts).toBe(0)
  })

  it.each([["pin", "--notify"], ["unpin"]])(
    "refuses to %s a message the store does not hold, and sends nothing",
    async (verb, ...options) => {
      const result = await acting(["messages", verb, seed.busy, "3EB0000000000000000DEAD", ...options])
      expect(result.code).toBe(6)
      expect(errorCode(result.stderr)).toBe("not_found")
      expect(result.actions).toEqual([])
    },
  )
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

  it("refuses to delete for the owner alone, which is not built, and deletes nothing", async () => {
    const result = await acting(["messages", "delete", seed.busy, fresh.id, "--allow-dangerous"])
    expect(result.code).toBe(2)
    expect(result.actions).toEqual([])
  })

  it("refuses an agent's delete over MCP with permission_error, without connecting", async () => {
    expect((await wa(["agent", "config", "set", "permissions.messages.delete", "allow"])).code).toBe(0)
    let connects = 0
    const neverConnect = (): never => {
      connects += 1
      throw new Error("an agent's delete must never connect")
    }
    const mcp = await mcpOverStdio((streams) =>
      run(["agent", "mcp"], { streams: captureStreams(), tty: false, ...streams, engine: neverConnect }),
    )
    const answer = await mcp.call("wa_write", {
      command: "messages delete",
      arguments: { chat: seed.busy, messages: [fresh.id] },
    })
    await mcp.close()
    const refused = answer.body as { error: { code: string; message: string } }

    expect(refused.error).toMatchObject({ code: "permission_error" })
    expect(refused.error.message).toContain("deletes only for everyone")
    expect(refused.error.message).toContain("wa messages delete --for-everyone")
    expect(connects).toBe(0)
  })
})

describe("marking read", () => {
  const newestTheirs = { op: "read", key: { chat: seed.busy, id: theirs.id, fromMe: false, sender: theirs.senderId } }

  it("sends one read receipt, for the newest message from someone else", async () => {
    const result = await acting(["chats", "mark-read", seed.busy])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([newestTheirs])
  })

  it("with --until-id on the account's own message, marks the newest one from someone else before it", async () => {
    const result = await acting(["chats", "mark-read", seed.busy, "--until-id", fresh.id])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([newestTheirs])
  })

  it("marks read from messages list only with --mark-read", async () => {
    const plain = await acting(["messages", "list", seed.busy])
    expect(plain.actions).toEqual([])
    const marked = await acting(["messages", "list", seed.busy, "--mark-read"])
    expect(marked.code).toBe(0)
    expect(marked.actions).toEqual([newestTheirs])
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
