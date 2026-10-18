import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WaChannel } from "./engine/channels.js"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { CHANNEL, CHANNEL_INVITE, CHANNEL_POSTS } from "./testing/fake-channels.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PROFILE = "channels"

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, ...(engine ? { engine } : {}), ...(signal ? { signal } : {}) })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const errorCode = (stderr: string) => JSON.parse(stderr.slice(stderr.indexOf('{"error"'))).error.code

const acting = async (argv: string[], role?: WaChannel["role"], profile = PROFILE) => {
  let engine: FakeEngine | undefined
  const result = await wa([profile, ...argv, "--json"], () => {
    engine = fakeEngine(seed, role === undefined ? {} : { channel: role })
    return engine
  })
  const body = result.code === 0 && result.stdout ? JSON.parse(result.stdout) : undefined
  return { ...result, body, engine }
}

beforeAll(async () => {
  const controller = new AbortController()
  const filling = () => {
    const engine = fakeEngine(seed, { channel: "subscriber" })
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => controller.abort())
      return stop
    }
    return engine
  }
  expect((await wa([PROFILE, "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
})

describe("wa channels", () => {
  it("stores the followed channels while listening, and lists them as kind channel", async () => {
    const result = await wa([PROFILE, "chats", "list", "kind:channel", "--json"])
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).items).toEqual([
      expect.objectContaining({ id: CHANNEL, title: "Synthetic news", kind: "channel" }),
    ])
  })

  it("reads a channel's posts from WhatsApp into the store, newest first, then back by server id", async () => {
    const argv = ["messages", "sync", CHANNEL, "--page-size", "20", "--limit", "40", "--pause", "1ms", "--no-catch-up"]
    const synced = await acting(argv, "subscriber")
    expect(synced.code).toBe(0)
    expect(synced.engine?.channelReads).toEqual([{ count: 20 }, { count: 20, before: 41 }])

    const listed = await wa([PROFILE, "messages", "list", CHANNEL, "--limit", "100", "--json"])
    expect(listed.code).toBe(0)
    const ids = JSON.parse(listed.stdout).items.map((message: { id: string }) => message.id)
    expect(ids).toEqual(CHANNEL_POSTS.slice(20).map((post) => post.id))
  })

  it("reads a channel the store holds nothing of yet", async () => {
    const argv = ["messages", "sync", CHANNEL, "--limit", "10", "--pause", "1ms", "--no-catch-up"]
    const synced = await acting(argv, "subscriber", "fresh-channel")
    expect(synced.code).toBe(0)
    expect(synced.engine?.channelReads).toEqual([{ count: 10 }])
  })

  it("follows a channel by its link, answering it as a channel", async () => {
    const result = await acting(["chats", "join", CHANNEL_INVITE])
    expect(result.code).toBe(0)
    expect(result.engine?.channelActions).toEqual([{ op: "followChannel" }])
    expect(result.body.item.chat).toMatchObject({ id: CHANNEL, kind: "channel", link: CHANNEL_INVITE })
    expect(result.engine?.groupActions).toEqual([])
  })

  it("follows nothing when the profile denies joining", async () => {
    expect((await wa(["no-joins", "config", "set", "permissions.chats.join", "deny"])).code).toBe(0)
    const result = await acting(["chats", "join", CHANNEL_INVITE], undefined, "no-joins")
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(result.engine?.channelActions ?? []).toEqual([])
  })

  it("unfollows a channel with chats leave", async () => {
    const result = await acting(["chats", "leave", CHANNEL], "subscriber")
    expect(result.code).toBe(0)
    expect(result.engine?.channelActions).toEqual([{ op: "unfollowChannel", jid: CHANNEL }])
    expect(result.engine?.groupActions).toEqual([])
  })
})
