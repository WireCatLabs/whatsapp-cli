import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeEach, describe, expect, it } from "vitest"
import type { EngineEvent, WaReaction, WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const theirs = seed.messages.find((message) => message.chatId === seed.busy && !message.outgoing) as Message
const self = seed.account?.id ?? ""
const other = "100000000000088@lid"

let store = ""

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    env: { ...process.env, MESSAGING_STORE: store },
    ...(engine ? { engine } : {}),
    ...(signal ? { signal } : {}),
  })
  return { code, stdout: streams.stdout.join(""), lines: streams.stdout, stderr: streams.stderr.join("") }
}

/** `wa watch` while the engine pushes `events`, as the phone would, then stops. */
const watching = async (events: EngineEvent[] = []) => {
  const controller = new AbortController()
  const pushing = () => {
    const engine = fakeEngine(seed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("reaction"))
        setImmediate(() => {
          for (const event of events) engine.push(event)
          setImmediate(() => controller.abort())
        })
      return stop
    }
    return engine
  }
  const result = await wa(["reacting", "watch", "--events", "--jsonl"], pushing, controller.signal)
  expect(result.code, result.stderr).toBe(0)
  return result.lines.map((line) => JSON.parse(line))
}

const reactionOf = (reactor: string, reaction: string | null, reactedAt: string, own = false): WaReaction => ({
  chat: seed.busy,
  message: theirs.id,
  reactor,
  reactorName: null,
  own,
  reaction,
  reactedAt,
})
const live = (...args: Parameters<typeof reactionOf>): EngineEvent => ({
  event: "reaction",
  reaction: reactionOf(...args),
})
const history = (...reactions: WaReaction[]): EngineEvent => ({
  event: "history",
  history: { kind: "recent", chats: [], contacts: [], messages: [], votes: [], reactions },
})

const reactionsOn = async () => {
  const listed = await wa(["reacting", "--offline", "messages", "list", seed.busy, "--json"])
  expect(listed.code, listed.stderr).toBe(0)
  return JSON.parse(listed.stdout).items.find((item: { id: string }) => item.id === theirs.id)?.reactions
}

beforeEach(async () => {
  store = join(mkdtempSync(join(tmpdir(), "wa-reactions-")), "messages.db")
  await watching()
})

describe("reactions from WhatsApp", () => {
  it("passes each live reaction on as one person's, and counts them on the stored message", async () => {
    const events = await watching([
      live(seed.person, "👍", "2026-09-01T10:01:00.000Z"),
      live(other, "👍", "2026-09-01T10:02:00.000Z"),
      live(self, "🔥", "2026-09-01T10:03:00.000Z", true),
    ])
    expect(events.filter((event) => event.event === "person_reaction")).toMatchObject([
      {
        chatId: seed.busy,
        messageId: theirs.id,
        reaction: { person: { id: seed.person }, own: false, reaction: "👍", reactedAt: "2026-09-01T10:01:00.000Z" },
      },
      { reaction: { person: { id: other }, own: false, reaction: "👍" } },
      { reaction: { person: { id: self }, own: true, reaction: "🔥" } },
    ])
    expect(await reactionsOn()).toMatchObject({
      counts: expect.arrayContaining([
        { reaction: "👍", count: 2 },
        { reaction: "🔥", count: 1 },
      ]),
      mine: "🔥",
      total: 3,
    })
  })

  it("replaces a person's reaction when they change it, and drops it when they take it back", async () => {
    await watching([live(other, "👍", "2026-09-01T10:01:00.000Z"), live(seed.person, "👍", "2026-09-01T10:01:30.000Z")])
    await watching([live(other, "❤️", "2026-09-01T10:02:00.000Z"), live(seed.person, null, "2026-09-01T10:03:00.000Z")])
    expect(await reactionsOn()).toMatchObject({ counts: [{ reaction: "❤️", count: 1 }], total: 1 })
  })

  it("stores the reactions a history push carries, and keeps a newer live one over an older pushed one", async () => {
    const events = await watching([history(reactionOf(other, "👍", "2026-09-01T09:05:00.000Z"))])
    expect(events.filter((event) => event.event === "person_reaction")).toEqual([])
    expect(await reactionsOn()).toMatchObject({ counts: [{ reaction: "👍", count: 1 }], total: 1 })
    await watching([live(other, "😂", "2026-09-01T09:10:00.000Z")])
    await watching([history(reactionOf(other, "👍", "2026-09-01T09:07:00.000Z"))])
    expect(await reactionsOn()).toMatchObject({ counts: [{ reaction: "😂", count: 1 }], total: 1 })
  })
})
