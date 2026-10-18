import { captureStreams } from "@wirecat/cli-base"
import type { Chat, Message } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PROFILE = "deleting"
const newestIn = (chatId: string) =>
  seed.messages
    .filter((message) => message.chatId === chatId)
    .reduce((newest: Message, message) => (message.timestamp > newest.timestamp ? message : newest))

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

const deleting = async (argv: string[], { settingsKeys = true, profile = PROFILE, world = seed } = {}) => {
  let engine: FakeEngine | undefined
  const result = await wa([profile, "chats", ...argv, "--json"], () => {
    engine = fakeEngine(world, { settingsKeys })
    return engine
  })
  return { ...result, deletions: engine?.chatDeletions ?? [], closed: engine?.closed }
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

describe("wa chats delete and clear", () => {
  it("deletes a chat up to its newest stored message, either side's, and the engine closes", async () => {
    const last = newestIn(seed.busy)
    const result = await deleting(["delete", seed.busy, "--allow-dangerous"])
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({ chat_id: seed.busy })
    expect(result.deletions).toEqual([
      {
        op: "deleteChat",
        last: {
          chat: seed.busy,
          id: last.id,
          fromMe: last.outgoing === true,
          sender: last.senderId,
          timestamp: last.timestamp,
        },
      },
    ])
    expect(result.closed).toBe(true)
  })

  it("clears a chat's messages up to the newest one", async () => {
    const result = await deleting(["clear", seed.dialog, "--allow-dangerous"])
    expect(result.code).toBe(0)
    expect(result.deletions).toMatchObject([
      { op: "clearChat", last: { chat: seed.dialog, id: newestIn(seed.dialog).id } },
    ])
  })

  it("asks first, so a script that cannot answer is refused and nothing is deleted", async () => {
    const result = await deleting(["delete", seed.busy])
    expect(result.code).not.toBe(0)
    expect(result.error.message).toContain("--allow-dangerous")
    expect(result.deletions).toEqual([])
  })

  it("refuses a chat the store holds nothing of, rather than guess what WhatsApp should delete", async () => {
    const quiet = {
      ...(seed.chats.find((chat) => chat.id === seed.busy) as Chat),
      id: whatsAppIds("chat", 99, new Date()),
    }
    const world = { ...seed, chats: [...seed.chats, quiet], members: { ...seed.members, [quiet.id]: [] } }
    const result = await deleting(["clear", quiet.id, "--allow-dangerous"], { profile: "deleting-empty", world })
    expect(result.code).toBe(6)
    expect(result.error).toMatchObject({ code: "not_found" })
    expect(result.error.message).toContain("wa deleting-empty serve")
    expect(result.deletions).toEqual([])
  })

  it("says to keep serve running when WhatsApp has not sent the settings keys yet, and that a retry is safe", async () => {
    const result = await deleting(["delete", seed.busy, "--allow-dangerous"], { settingsKeys: false })
    expect(result.code).toBe(12)
    expect(result.error).toMatchObject({ code: "provider_unavailable", reason: "settings.keys-missing" })
    expect(result.error.message).toContain(`wa ${PROFILE} serve`)
    expect(result.deletions).toEqual([])
  })
})
