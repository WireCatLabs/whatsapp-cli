import { captureStreams } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
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
const seed = { ...base, messages: [...base.messages, fresh] }
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
  return { ...result, actions: engine?.actions ?? [], closed: engine?.closed }
}

const errorCode = (stderr: string) => JSON.parse(stderr).error.code

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

describe("wa messages edit", () => {
  it("changes the text of the account's own recent message", async () => {
    const result = await acting(["messages", "edit", seed.busy, fresh.id, "fixed text"])
    expect(result.code).toBe(0)
    expect(result.actions).toEqual([
      { op: "edit", key: { chat: seed.busy, id: fresh.id, fromMe: true, sender: fresh.senderId }, text: "fixed text" },
    ])
  })

  it.each([
    ["someone else's message", theirs.id],
    ["a message older than WhatsApp's edit window", oldOwn.id],
    ["--md, which WhatsApp's edit cannot carry", fresh.id, "--md"],
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
