import { cpSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { WaChannel } from "./engine/channels.js"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { CHANNEL, CHANNEL_INVITE, CHANNEL_POSTS } from "./testing/fake-channels.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PROFILE = "channels"

// Each test gets a copy of one filled store: a follow, an unfollow or a sync would otherwise change the next one's answer.
let store = ""
let filledStore = ""
let env: NodeJS.ProcessEnv = {}

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    env: { ...process.env, MESSAGING_STORE: store, ...env },
    ...(engine ? { engine } : {}),
    ...(signal ? { signal } : {}),
  })
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
  store = join(mkdtempSync(join(tmpdir(), "wa-channels-")), "messages.db")
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
  filledStore = store
})

beforeEach(() => {
  env = {}
  const copy = mkdtempSync(join(tmpdir(), "wa-channels-"))
  cpSync(dirname(filledStore), copy, { recursive: true })
  store = join(copy, "messages.db")
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
    const items = JSON.parse(listed.stdout).items as { id: string; provider_metadata?: unknown }[]
    expect(items.map((message) => message.id)).toEqual(CHANNEL_POSTS.slice(20).map((post) => post.id))
    const post = CHANNEL_POSTS[20]
    expect(items.find((message) => message.id === post?.id)?.provider_metadata).toEqual({ serverId: post?.serverId })
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

  it("posts text to a channel the account runs", async () => {
    const result = await acting(["messages", "send", CHANNEL, "synthetic post"], "admin")
    expect(result.code).toBe(0)
    expect(result.engine?.sends).toEqual([expect.objectContaining({ chat: CHANNEL, text: "synthetic post" })])
  })

  it("refuses a post where the account only follows, and sends nothing", async () => {
    const result = await acting(["messages", "send", CHANNEL, "synthetic post"], "subscriber")
    expect(result.code).toBe(5)
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(result.engine?.sends).toEqual([])
  })

  it("posts a photo, its text the caption, to a channel the account runs", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "wa-channel-file-")), "synthetic.png")
    writeFileSync(path, "synthetic png bytes")
    const result = await acting(["messages", "send", CHANNEL, "synthetic caption", "--photo", path], "admin")
    expect(result.code).toBe(0)
    expect(result.engine?.uploads).toEqual([{ kind: "photo", name: "synthetic.png", size: 19 }])
    expect(result.engine?.sends).toEqual([expect.objectContaining({ chat: CHANNEL, text: "synthetic caption" })])
  })

  it("posts a document to a channel the account owns", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "wa-channel-file-")), "synthetic.pdf")
    writeFileSync(path, "synthetic pdf bytes")
    const result = await acting(["messages", "send", CHANNEL, "--file", path], "owner")
    expect(result.code).toBe(0)
    expect(result.engine?.uploads).toEqual([{ kind: "document", name: "synthetic.pdf", size: 19 }])
  })

  it("refuses a file where the account only follows, before anything is uploaded", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "wa-channel-file-")), "synthetic.png")
    writeFileSync(path, "synthetic png bytes")
    const result = await acting(["messages", "send", CHANNEL, "--photo", path], "subscriber")
    expect(result.code).toBe(5)
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(result.engine?.uploads).toEqual([])
    expect(result.engine?.sends).toEqual([])
  })

  it("refuses an album to a channel, and uploads nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wa-channel-file-"))
    writeFileSync(join(dir, "a.png"), "synthetic png")
    writeFileSync(join(dir, "clip.mp4"), "synthetic mp4")
    const argv = ["messages", "send", CHANNEL, "--photo", join(dir, "a.png"), "--file", join(dir, "clip.mp4")]
    const result = await acting(argv, "admin")
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("one file at a time")
    expect(result.engine?.uploads).toEqual([])
  })

  it("refuses a reply posted to a channel, and sends nothing", async () => {
    const post = CHANNEL_POSTS.at(-1)?.id ?? ""
    const reply = await acting(["messages", "send", CHANNEL, "synthetic post", "--reply-to", post], "admin")
    expect(reply.code).toBe(2)
    expect(reply.stderr).toContain("cannot be a reply")
    expect(reply.engine?.sends ?? []).toEqual([])
  })

  it("posts nothing under WA_READ_ONLY", async () => {
    env = { WA_READ_ONLY: "1" }
    const result = await acting(["messages", "send", CHANNEL, "synthetic post"], "admin")
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(result.engine?.sends ?? []).toEqual([])
  })

  it("posts nothing when the profile denies sending", async () => {
    expect((await wa(["no-sends", "config", "set", "permissions.messages.send", "deny"])).code).toBe(0)
    const result = await acting(["messages", "send", CHANNEL, "synthetic post"], "admin", "no-sends")
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(result.engine?.sends ?? []).toEqual([])
  })

  it("refuses a poll or a forward to a channel, even one the account runs, and sends nothing", async () => {
    const poll = await acting(["polls", "create", CHANNEL, "Synthetic?", "yes", "no"], "admin")
    expect(poll.code).toBe(2)
    expect(poll.stderr).toContain("in a WhatsApp channel")
    expect(poll.engine?.sent).toEqual([])

    const post = CHANNEL_POSTS.at(-1)?.id ?? ""
    const forward = await acting(["messages", "forward", CHANNEL, post, "--to", CHANNEL], "admin")
    expect(forward.code).toBe(2)
    expect(forward.stderr).toContain("in a WhatsApp channel")
    expect(forward.engine?.forwards).toEqual([])
  })

  it("refuses to forward a channel's file into a chat, where it would not open, and sends nothing", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "wa-channel-file-")), "synthetic.png")
    writeFileSync(path, "synthetic png bytes")
    const posted = await acting(["messages", "send", CHANNEL, "synthetic caption", "--photo", path], "admin")
    expect(posted.code).toBe(0)

    const argv = ["messages", "forward", CHANNEL, posted.body.item.message.id, "--to", seed.dialog]
    const forward = await acting(argv, "admin")
    expect(forward.code).toBe(2)
    const { error } = JSON.parse(forward.stderr.slice(forward.stderr.indexOf('{"error"')))
    expect(error).toMatchObject({ code: "validation_error", reason: "media.channel-file-forward" })
    expect(error.message).toContain("send it as a new file")
    expect(forward.engine?.forwards).toEqual([])
  })

  it("refuses an edit or a deletion in a channel, and sends nothing", async () => {
    const post = CHANNEL_POSTS.at(-1)?.id ?? ""
    const edit = await acting(["messages", "edit", CHANNEL, post, "fixed text"], "admin")
    expect(edit.code).toBe(2)
    expect(edit.stderr).toContain("in a WhatsApp channel")
    expect(edit.engine?.actions).toEqual([])

    const remove = await acting(["messages", "delete", CHANNEL, post, "--for-everyone", "--allow-dangerous"], "admin")
    expect(remove.code).toBe(2)
    expect(remove.stderr).toContain("in a WhatsApp channel")
    expect(remove.engine?.actions).toEqual([])
  })

  it("unfollows a channel with chats leave", async () => {
    const result = await acting(["chats", "leave", CHANNEL], "subscriber")
    expect(result.code).toBe(0)
    expect(result.engine?.channelActions).toEqual([{ op: "unfollowChannel", jid: CHANNEL }])
    expect(result.engine?.groupActions).toEqual([])
  })

  it("follows nothing under WA_READ_ONLY", async () => {
    env = { WA_READ_ONLY: "1" }
    const result = await acting(["chats", "join", CHANNEL_INVITE])
    expect(result.code).not.toBe(0)
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(result.engine?.channelActions ?? []).toEqual([])
  })

  it("unfollows nothing under WA_READ_ONLY", async () => {
    env = { WA_READ_ONLY: "1" }
    const result = await acting(["chats", "leave", CHANNEL], "subscriber")
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(result.engine?.channelActions ?? []).toEqual([])
  })

  it("unfollows nothing when the profile denies leaving", async () => {
    expect((await wa(["no-leaves", "config", "set", "permissions.chats.leave", "deny"])).code).toBe(0)
    const result = await acting(["chats", "leave", CHANNEL], "subscriber", "no-leaves")
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(result.engine?.channelActions ?? []).toEqual([])
  })

  it("answers not found for a channel link WhatsApp does not know", async () => {
    const result = await acting(["chats", "join", "https://whatsapp.com/channel/FAKE0000000000000000ZZ"])
    expect(errorCode(result.stderr)).toBe("not_found")
    expect(result.engine?.channelActions).toEqual([])
  })

  it("joins a group by a group link, not as a channel", async () => {
    const result = await acting(["chats", "join", "https://chat.whatsapp.com/FAKE0000000000000000AB"])
    expect(result.code).toBe(0)
    expect(result.engine?.channelActions).toEqual([])
    expect(result.body.item.chat.kind).not.toBe("channel")
  })

  it("leaves a group with chats leave, not as a channel", async () => {
    const result = await acting(["chats", "leave", seed.busy], "subscriber")
    expect(result.code).toBe(0)
    expect(result.engine?.channelActions).toEqual([])
    expect(result.engine?.groupActions).toEqual([expect.objectContaining({ op: "leave", jid: seed.busy })])
  })
})
