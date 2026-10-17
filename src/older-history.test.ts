import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { whatsAppAdapter } from "./adapter/adapter.js"
import type { WaMessage, WhatsAppEngine } from "./engine/contract.js"
import { storedMessages } from "./messenger.js"
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

const stored = storedMessages(process.env, account)

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

afterAll(() => stored.close())

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

  // cli-core refuses `messages sync` for a messenger whose history is pushed (archive.ts, `pushed`). When it lets an
  // adapter with `history` through, this test should change to expect the phone's messages in the store.
  it("is not reachable from `messages sync` until cli-core allows it", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const result = await wa(["older", "messages", "sync", seed.busy, "--json"], () => engine)
    expect(result.code).not.toBe(0)
    expect(JSON.parse(result.stderr).error.message).toContain("serve")
    expect(engine.olderAsked).toEqual([])
  })
})
