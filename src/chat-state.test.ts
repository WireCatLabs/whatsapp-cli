import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeEach, describe, expect, it } from "vitest"
import { toChatUpdate } from "./adapter/map.js"
import type { EngineEvent, WaChat, WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PROFILE = "chat-state"
const chat = "120363000000000091@g.us"
let store = ""

beforeEach(() => {
  store = join(mkdtempSync(join(tmpdir(), "wa-chat-state-")), "messages.db")
})

const wa = async (argv: string[], engine: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run([PROFILE, ...argv], {
    streams,
    tty: false,
    env: { ...process.env, MESSAGING_STORE: store },
    engine,
    ...(signal ? { signal } : {}),
  })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const pushing = (pushed: WaChat): EngineEvent => ({
  event: "history",
  history: { kind: "other", chats: [pushed], contacts: [], messages: [], votes: [] },
})

const watching = async (events: EngineEvent[]) => {
  const controller = new AbortController()
  const result = await wa(
    ["watch", "--events", "--jsonl"],
    () => {
      const engine = fakeEngine(seed)
      engine.ready = async () => {
        setImmediate(() => {
          for (const event of events) engine.push(event)
          setImmediate(() => controller.abort())
        })
      }
      return engine
    },
    controller.signal,
  )
  expect(result.code, result.stderr).toBe(0)
  return result.stdout
}

const shown = async () => {
  const result = await wa(["chats", "show", chat, "--offline", "--json"], () => {
    throw new Error("a stored read must never start the engine")
  })
  expect(result.code, result.stderr).toBe(0)
  return JSON.parse(result.stdout).item
}

describe("chat state changed on the phone", () => {
  it("is saved by watch without an event line, as tg's watch has none, and keeps the stored title", async () => {
    const lastMessageAt = "2026-10-20T10:00:00.000Z"
    await watching([
      pushing({ jid: chat, name: "Book club", kind: "group", unread: 3, lastMessageAt, participants: 5 }),
    ])

    const printed = await watching([
      pushing({ jid: chat, kind: "group", unread: 0 }),
      pushing({ jid: chat, kind: "group", archived: true }),
      pushing({ jid: chat, kind: "group", muted: true }),
    ])

    expect(printed).toBe("")
    expect(await shown()).toMatchObject({
      title: "Book club",
      unread_count: 0,
      last_message_at: lastMessageAt,
      participants_count: 5,
    })
  })

  it("keeps a mute's end, the archive and the unread mark, and a read on the phone takes the mark off", async () => {
    const lastMessageAt = "2026-10-20T10:00:00.000Z"
    const mutedUntil = "2099-01-01T08:00:00.000Z"
    await watching([
      pushing({ jid: chat, name: "Book club", kind: "group", unread: 0, lastMessageAt, participants: 5 }),
    ])

    await watching([
      pushing({ jid: chat, kind: "group", archived: true }),
      pushing({ jid: chat, kind: "group", muted: true, mutedUntil }),
      pushing({ jid: chat, kind: "group", markedUnread: true }),
    ])
    expect(await shown()).toMatchObject({
      archived: true,
      muted: true,
      muted_until: mutedUntil,
      marked_unread: true,
      unread_count: 0,
    })

    await watching([pushing({ jid: chat, kind: "group", unread: 0, lastMessageAt, markedUnread: false })])
    expect(await shown()).toMatchObject({ marked_unread: false, unread_count: 0, muted_until: mutedUntil })

    await watching([pushing({ jid: chat, kind: "group", muted: true })])
    expect((await shown()).muted_until ?? null).toBeNull()
  })

  it("counts a message from someone else that arrives after the phone's count", async () => {
    const lastMessageAt = "2026-10-20T10:00:00.000Z"
    await watching([
      pushing({ jid: chat, name: "Book club", kind: "group", unread: 0, lastMessageAt, participants: 5 }),
    ])

    await watching([
      {
        event: "message",
        message: {
          id: "3EB0COUNTED00001",
          chat,
          sender: "100000000000003@lid",
          senderName: null,
          fromMe: false,
          timestamp: "2026-10-20T11:00:00.000Z",
          editedAt: null,
          text: "new",
          replyTo: null,
        },
      },
    ])
    expect(await shown()).toMatchObject({ unread_count: 1 })
  })

  it("maps a notice to a chat update that carries only its flag", () => {
    expect(toChatUpdate({ jid: chat, kind: "group", archived: true })).toEqual({
      id: chat,
      kind: "group",
      archived: true,
    })
    expect(toChatUpdate({ jid: chat, kind: "group", muted: false })).toEqual({ id: chat, kind: "group", muted: false })
    expect(toChatUpdate({ jid: chat, kind: "dm", unread: 0 })).toEqual({ id: chat, kind: "dialog", unreadCount: 0 })
    expect(toChatUpdate({ jid: chat, kind: "group", muted: true })).toEqual({
      id: chat,
      kind: "group",
      muted: true,
      mutedUntil: null,
    })
    expect(toChatUpdate({ jid: chat, kind: "group", markedUnread: true })).toEqual({
      id: chat,
      kind: "group",
      markedUnread: true,
    })
  })
})
