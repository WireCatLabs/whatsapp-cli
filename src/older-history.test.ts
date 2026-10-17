import { captureStreams } from "@wirecat/cli-base"
import type { StoredMessages } from "@wirecat/cli-core/cli"
import { openStore } from "@wirecat/cli-core/store"
import { contractSeed } from "@wirecat/cli-core/testing"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { whatsAppAdapter } from "./adapter/adapter.js"
import type { WaMessage, WhatsAppEngine } from "./engine/contract.js"

import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const inBusy = seed.messages.filter((message) => message.chatId === seed.busy)
const oldest = inBusy[0]
const account = seed.account?.id ?? null

// What the phone still holds of the busy chat, older than anything it pushed: one an hour, back from the first push.
const onPhone: WaMessage[] = Array.from({ length: 60 }, (_, n) => ({
  id: `3EB0000000000000000P${String(n).padStart(2, "0")}`,
  chat: seed.busy,
  sender: seed.person,
  senderName: null,
  fromMe: false,
  timestamp: new Date(Date.parse(oldest?.timestamp ?? "") - (n + 1) * 3_600_000).toISOString(),
  editedAt: null,
  text: "synthetic older text",
  replyTo: null,
}))

const wa = async (argv: string[], engine: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, engine, ...(signal ? { signal } : {}) })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

// The lookups cli-core hands a connection, over the store the CLI filled, for calling the adapter directly.
const opened = openStore({ env: process.env, command: "wa" })
const key = { provider: "whatsapp", account: account ?? "" }
const stored: StoredMessages = {
  message: async (chatId, messageId) => (await opened).messages.message(key, messageId, { chatId }),
  newestIncoming: async () => undefined,
  anchor: async (chatId, at) =>
    (
      await (
        await opened
      ).messages.messagesWindow(
        key,
        chatId,
        at === undefined ? { at: new Date(0).toISOString(), before: 0, after: 1 } : { at, before: 1, after: 0 },
      )
    )[0],
  wroteTo: async () => false,
  pollVotes: async () => [],
}

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
  expect((await wa(["older", "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
})

afterAll(async () => (await opened).close())

describe("older history from the phone", () => {
  it("counts back from the oldest stored message on the first page, and asks at most 50", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const page = await whatsAppAdapter(engine, stored).history(seed.busy, { limit: 100 })
    expect(engine.olderAsked).toEqual([
      {
        anchor: expect.objectContaining({ chat: seed.busy, id: oldest?.id, timestamp: oldest?.timestamp }),
        count: 50,
      },
    ])
    expect(page.hasMore).toBe(true)
    expect(page.items).toHaveLength(50)
    expect(page.items.at(-1)?.id).toBe(onPhone[0]?.id)
    expect(page.items.map((message) => message.timestamp)).toEqual(page.items.map((m) => m.timestamp).toSorted())
  })

  it("then counts back from the newest stored message at or before the time the last page reached", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const middle = inBusy[4]
    await whatsAppAdapter(engine, stored).history(seed.busy, { limit: 20, before: middle?.timestamp ?? "" })
    expect(engine.olderAsked[0]?.anchor).toMatchObject({ id: middle?.id, fromMe: middle?.outgoing === true })
  })

  it("says the chat's start is reached only when the phone sends nothing", async () => {
    const engine = fakeEngine(seed, { phone: [] })
    expect(await whatsAppAdapter(engine, stored).history(seed.busy, { limit: 50 })).toEqual({
      items: [],
      hasMore: false,
    })
  })

  it("refuses a chat the store holds nothing of, without asking the phone", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    await expect(whatsAppAdapter(engine, stored).history("100000000000099@lid", { limit: 50 })).rejects.toMatchObject({
      code: "not_found",
      message: expect.stringContaining("local store"),
    })
    expect(engine.olderAsked).toEqual([])
  })

  it("passes on the phone's silence as a timeout, never as an empty page", async () => {
    const engine = fakeEngine(seed)
    await expect(whatsAppAdapter(engine, stored).history(seed.busy, { limit: 50 })).rejects.toMatchObject({
      code: "timeout",
    })
  })

  // Last: the page it stores moves the chat's oldest message, which the tests above count back from.
  it("asks the phone through `messages sync <chat>` and stores the page", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const argv = ["older", "messages", "sync", seed.busy, "--limit", "50", "--pause", "1ms", "--no-catch-up", "--json"]
    const result = await wa(argv, () => engine)
    expect(result.code).toBe(0)
    expect(engine.olderAsked).toHaveLength(1)
    expect(await stored.message(seed.busy, onPhone[0]?.id ?? "")).toMatchObject({ id: onPhone[0]?.id })
  })

  it("asks the phone for --page-size messages at a time", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const argv = ["older", "messages", "sync", seed.busy, "--page-size", "5", "--limit", "10", "--pause", "1ms"]
    const result = await wa([...argv, "--no-catch-up", "--json"], () => engine)
    expect(result.code).toBe(0)
    expect(engine.olderAsked.map((asked) => asked.count)).toEqual([5, 5])
  })

  it("still refuses `messages sync --all`: there is no chat list to walk", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const result = await wa(["older", "messages", "sync", "--all", "--json"], () => engine)
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("name one chat")
    expect(engine.olderAsked).toEqual([])
  })
})
