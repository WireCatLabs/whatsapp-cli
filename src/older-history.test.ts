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
const lookups = (owner: string): StoredMessages => {
  const key = { provider: "whatsapp", account: owner }
  return {
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
}
const stored = lookups(account ?? "")

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

beforeAll(() => filled("older", seed))

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

  it("still refuses `messages sync --all`: there is no chat list to walk", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const result = await wa(["older", "messages", "sync", "--all", "--json"], () => engine)
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("name one chat")
    expect(engine.olderAsked).toEqual([])
  })
})

// Each on an account of its own: a page sync stores moves the chat's oldest message, which every test counts back from.
describe("messages sync", () => {
  const ownAccount = async (profile: string, n: number) => {
    const own = { ...seed, account: { id: `1000000000000${80 + n}@lid`, name: "Synthetic owner", username: null } }
    await filled(profile, own)
    return own
  }
  const sync = async (profile: string, engine: WhatsAppEngine, ...options: string[]) => {
    const argv = [profile, "messages", "sync", seed.busy, ...options, "--pause", "1ms", "--no-catch-up", "--json"]
    const result = await wa(argv, () => engine)
    expect(result.code).toBe(0)
    return JSON.parse(result.stdout).item
  }

  it("asks the phone through `messages sync <chat>` and stores the page", async () => {
    const own = await ownAccount("stores", 3)
    const engine = fakeEngine(own, { phone: onPhone })
    await sync("stores", engine, "--limit", "50")
    expect(engine.olderAsked).toHaveLength(1)
    expect(await lookups(own.account.id).message(seed.busy, onPhone[0]?.id ?? "")).toMatchObject({ id: onPhone[0]?.id })
  })

  it("asks the phone for --page-size messages at a time", async () => {
    const engine = fakeEngine(await ownAccount("paged", 4), { phone: onPhone })
    await sync("paged", engine, "--page-size", "5", "--limit", "10")
    expect(engine.olderAsked.map((asked) => asked.count)).toEqual([5, 5])
  })

  it("with --since-time, stops asking the phone once its pages reach that time", async () => {
    const engine = fakeEngine(await ownAccount("since", 1), { phone: onPhone })
    const item = await sync("since", engine, "--since-time", onPhone[4]?.timestamp ?? "", "--page-size", "3")
    expect(engine.olderAsked.map((asked) => asked.count)).toEqual([3, 3])
    expect(item).toMatchObject({ fetched: 6, reached_since: true })
  })

  it("with --last, stops once the chat's newest n messages are held", async () => {
    const engine = fakeEngine(await ownAccount("last", 2), { phone: onPhone })
    const item = await sync("last", engine, "--last", String(inBusy.length + 4), "--page-size", "4")
    expect(engine.olderAsked.map((asked) => asked.count)).toEqual([4])
    expect(item).toMatchObject({ fetched: 4, reached_last: true })
  })

  it("refuses --dry-run without starting the engine: the phone pushes history, there is no count", async () => {
    const result = await wa(["older", "messages", "sync", seed.busy, "--dry-run", "--json"], () => {
      throw new Error("a dry run must never start the engine")
    })
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr.slice(result.stderr.indexOf("{"))).error.message).toContain(
      "pushes its history instead",
    )
  })
})
