import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it, vi } from "vitest"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PROFILE = "muting"

const muting = async (argv: string[], { settingsKeys = true, profile = PROFILE } = {}) => {
  let engine: FakeEngine | undefined
  const streams = captureStreams()
  const code = await run([profile, "chats", ...argv, "--json"], {
    streams,
    tty: false,
    engine: () => {
      engine = fakeEngine(seed, { settingsKeys })
      return engine
    },
  })
  const stdout = streams.stdout.join("")
  const stderr = streams.stderr.join("")
  return {
    code,
    item: code === 0 ? JSON.parse(stdout).item : undefined,
    error: code === 0 ? undefined : JSON.parse(stderr.slice(stderr.indexOf('{"error"'))).error,
    mutes: engine?.mutes ?? [],
    closed: engine?.closed,
  }
}

describe("wa chats mute", () => {
  it("mutes a chat for good, and the engine closes", async () => {
    const result = await muting(["mute", seed.dialog])
    expect(result.code).toBe(0)
    expect(result.item).toMatchObject({ chat_id: seed.dialog, muted_until: "forever" })
    expect(result.mutes).toEqual([{ jid: seed.dialog, until: "forever" }])
    expect(result.closed).toBe(true)
  })

  it("mutes until a time, to the minute, even a millisecond before the minute turns", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-18T09:14:59.999Z"))
    try {
      const result = await muting(["mute", seed.busy, "--until", "2h"])
      expect(result.code).toBe(0)
      expect(result.mutes).toEqual([{ jid: seed.busy, until: "2026-10-18T11:14:00.000Z" }])
      expect(result.item).toMatchObject({ muted_until: "2026-10-18T11:14:00.000Z" })
    } finally {
      vi.useRealTimers()
    }
  })

  it("unmutes", async () => {
    const result = await muting(["unmute", seed.dialog])
    expect(result.code).toBe(0)
    expect(result.mutes).toEqual([{ jid: seed.dialog, until: null }])
    expect(result.item).toMatchObject({ muted_until: null })
  })

  it("refuses unmute at permission readonly under chats.unmute, and changes nothing", async () => {
    const profile = "muting-readonly"
    const set = ["config", "set", "permissions.chats.unmute", "readonly"]
    expect(await run([profile, ...set], { streams: captureStreams(), tty: false })).toBe(0)
    const result = await muting(["unmute", seed.dialog], { profile })
    expect(result.code).toBe(5)
    expect(result.error).toMatchObject({ code: "permission_error" })
    expect(result.mutes).toEqual([])
  })

  it("says to keep serve running when WhatsApp has not sent the settings keys yet", async () => {
    const result = await muting(["mute", seed.dialog], { settingsKeys: false })
    expect(result.code).toBe(12)
    expect(result.error).toMatchObject({
      code: "provider_unavailable",
      reason: "settings.keys-missing",
      retry: { safe: true },
    })
    expect(result.error.message).toContain(`wa ${PROFILE} serve`)
    expect(result.mutes).toEqual([])
  })
})
