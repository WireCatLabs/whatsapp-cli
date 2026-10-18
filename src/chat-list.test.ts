import { captureStreams } from "@wirecat/cli-base"
import type { Chat, Message } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PROFILE = "arranging"
const newestIn = (chatId: string) =>
  seed.messages
    .filter((message) => message.chatId === chatId)
    .reduce((newest: Message, message) => (message.timestamp > newest.timestamp ? message : newest))
const anchorOf = (message: Message) => ({
  chat: message.chatId,
  id: message.id,
  fromMe: message.outgoing === true,
  sender: message.senderId,
  timestamp: message.timestamp,
})

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, ...(engine ? { engine } : {}), ...(signal ? { signal } : {}) })
  const stderr = streams.stderr.join("")
  return {
    code,
    stdout: streams.stdout.join(""),
    error: code === 0 ? undefined : JSON.parse(stderr.slice(stderr.indexOf('{"error"'))).error,
  }
}

const arranging = async (argv: string[], { settingsKeys = true, profile = PROFILE, world = seed } = {}) => {
  let engine: FakeEngine | undefined
  const result = await wa([profile, "chats", ...argv, "--json"], () => {
    engine = fakeEngine(world, { settingsKeys })
    return engine
  })
  return {
    ...result,
    item: result.code === 0 ? JSON.parse(result.stdout).item : undefined,
    archives: engine?.archives ?? [],
    pins: engine?.chatPins ?? [],
    unread: engine?.markedUnread ?? [],
    closed: engine?.closed,
  }
}

const filled = async (profile: string) => {
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
  expect((await wa([profile, "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
}

beforeAll(() => filled(PROFILE))

describe("wa chats archive and unarchive", () => {
  it("archives a chat up to its newest stored message, and the engine closes", async () => {
    const result = await arranging(["archive", seed.busy])
    expect(result.code).toBe(0)
    expect(result.item).toMatchObject({ chat_id: seed.busy, archived: true })
    expect(result.archives).toEqual([{ last: anchorOf(newestIn(seed.busy)), archived: true }])
    expect(result.closed).toBe(true)
  })

  it("unarchives", async () => {
    const result = await arranging(["unarchive", seed.dialog])
    expect(result.code).toBe(0)
    expect(result.item).toMatchObject({ archived: false })
    expect(result.archives).toEqual([{ last: anchorOf(newestIn(seed.dialog)), archived: false }])
  })

  it("refuses a chat the store holds nothing of, rather than guess its newest message", async () => {
    const quiet = {
      ...(seed.chats.find((chat) => chat.id === seed.busy) as Chat),
      id: whatsAppIds("chat", 99, new Date()),
    }
    const world = { ...seed, chats: [...seed.chats, quiet], members: { ...seed.members, [quiet.id]: [] } }
    const result = await arranging(["archive", quiet.id], { profile: "arranging-empty", world })
    expect(result.code).toBe(6)
    expect(result.error).toMatchObject({ code: "not_found" })
    expect(result.error.message).toContain("what the archive covers")
    expect(result.archives).toEqual([])
  })

  it("refuses at permission readonly under chats.archive, and archives nothing", async () => {
    const profile = "arranging-readonly"
    const set = ["config", "set", "permissions.chats.archive", "readonly"]
    expect(await run([profile, ...set], { streams: captureStreams(), tty: false })).toBe(0)
    const result = await arranging(["archive", seed.busy], { profile })
    expect(result.code).toBe(5)
    expect(result.error).toMatchObject({ code: "permission_error" })
    expect(result.archives).toEqual([])
  })
})

describe("wa chats pin and unpin", () => {
  it("pins and unpins a chat without needing a stored message", async () => {
    const pinned = await arranging(["pin", seed.dialog], { profile: "arranging-pins" })
    expect(pinned.code).toBe(0)
    expect(pinned.item).toMatchObject({ chat_id: seed.dialog, pinned: true })
    expect(pinned.pins).toEqual([{ jid: seed.dialog, pinned: true }])
    const unpinned = await arranging(["unpin", seed.dialog], { profile: "arranging-pins" })
    expect(unpinned.pins).toEqual([{ jid: seed.dialog, pinned: false }])
  })

  it("says to keep serve running when WhatsApp has not sent the settings keys yet", async () => {
    const result = await arranging(["pin", seed.dialog], { settingsKeys: false })
    expect(result.code).toBe(12)
    expect(result.error).toMatchObject({ reason: "settings.keys-missing", retry: { safe: true } })
    expect(result.error.message).toContain(`wa ${PROFILE} serve`)
    expect(result.pins).toEqual([])
  })
})

describe("wa chats mark-unread", () => {
  it("marks a chat unread up to its newest stored message", async () => {
    const result = await arranging(["mark-unread", seed.dialog])
    expect(result.code).toBe(0)
    expect(result.item).toMatchObject({ chat_id: seed.dialog, unread: true })
    expect(result.unread).toEqual([anchorOf(newestIn(seed.dialog))])
  })
})
