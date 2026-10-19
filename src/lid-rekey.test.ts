import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import type { WaMessage, WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PHONE = "70000000009@s.whatsapp.net"
const LID = "100000000000001@lid"

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, ...(engine ? { engine } : {}), ...(signal ? { signal } : {}) })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const message = (chat: string, n: number): WaMessage => ({
  id: `3EB00000000000000R${String(n).padStart(2, "0")}`,
  chat,
  sender: chat,
  senderName: null,
  fromMe: false,
  timestamp: new Date(Date.UTC(2026, 9, 1, 12, n)).toISOString(),
  editedAt: null,
  text: "synthetic text",
  replyTo: null,
})

describe("a person who gains a LID", () => {
  it("keeps one chat: what was stored under the phone number moves to the LID", async () => {
    const profile = "rekeyed"
    const controller = new AbortController()
    const watching = () => {
      const engine = fakeEngine(seed)
      const listen = engine.listen
      const kinds = new Set<string>()
      let pushed = false
      engine.listen = (wanted, onEvent) => {
        const stop = listen(wanted, onEvent)
        for (const kind of wanted) kinds.add(kind)
        if (!pushed && kinds.has("history") && kinds.has("message")) {
          pushed = true
          setImmediate(() => {
            engine.push({
              event: "history",
              history: {
                kind: "recent",
                chats: [{ jid: PHONE, name: null, kind: "dm", unread: null, lastMessageAt: null, participants: null }],
                contacts: [],
                messages: [message(PHONE, 1), message(PHONE, 2)],
                votes: [],
              },
            })
            engine.push({ event: "rekey", from: PHONE, to: LID })
            engine.push({ event: "message", message: message(LID, 3) })
            setTimeout(() => controller.abort(), 50)
          })
        }
        return stop
      }
      return engine
    }
    const watched = await wa([profile, "watch", "--jsonl"], watching, controller.signal)
    expect(watched.code, watched.stderr).toBe(0)

    const listed = await wa([profile, "--offline", "messages", "list", LID, "--json"])
    expect(listed.code, listed.stderr).toBe(0)
    expect(JSON.parse(listed.stdout).items.map((one: { id: string }) => one.id)).toEqual([
      message(LID, 1).id,
      message(LID, 2).id,
      message(LID, 3).id,
    ])
    const chats = JSON.parse((await wa([profile, "--offline", "chats", "list", "--json"])).stdout).items
    expect(chats.map((chat: { id: string }) => chat.id)).not.toContain(PHONE)
    expect(chats.filter((chat: { id: string }) => chat.id === LID)).toHaveLength(1)
  })
})

describe("a phone-form chat stored before the engine kept its table", () => {
  const UNKNOWN = "70000000008@s.whatsapp.net"
  const dm = (jid: string) => ({
    jid,
    name: null,
    kind: "dm" as const,
    unread: null,
    lastMessageAt: null,
    participants: null,
  })

  // An engine that records nothing, as one older than the table: the two chats are stored in phone form only.
  const storeInPhoneForm = async (profile: string, n: number) => {
    const controller = new AbortController()
    const seeding = () => {
      const engine = fakeEngine(seed)
      engine.storedChats = async () => {}
      setImmediate(() => {
        engine.push({
          event: "history",
          history: {
            kind: "recent",
            chats: [dm(PHONE), dm(UNKNOWN)],
            contacts: [],
            messages: [message(PHONE, n), message(UNKNOWN, n + 1)],
            votes: [],
          },
        })
        setImmediate(() => controller.abort())
      })
      return engine
    }
    const seeded = await wa([profile, "watch", "--jsonl"], seeding, controller.signal)
    expect(seeded.code, seeded.stderr).toBe(0)
  }

  const chatIds = async (profile: string): Promise<string[]> =>
    JSON.parse((await wa([profile, "--offline", "chats", "list", "--json"])).stdout).items.map(
      (chat: { id: string }) => chat.id,
    )

  it("re-keys as watch starts when its LID is known, and goes to the engine for a lookup when not", async () => {
    const profile = "stored-phone-chats"
    await storeInPhoneForm(profile, 11)
    expect(await chatIds(profile)).toEqual(expect.arrayContaining([PHONE, UNKNOWN]))

    const controller = new AbortController()
    let asked: string[][] = []
    const starting = () => {
      const engine = fakeEngine(seed, { lids: { [PHONE]: LID } })
      asked = engine.storedAsked
      const handOver = engine.storedChats
      engine.storedChats = async (chats) => {
        await handOver(chats)
        setImmediate(() => controller.abort())
      }
      return engine
    }
    const watched = await wa([profile, "watch", "--jsonl"], starting, controller.signal)
    expect(watched.code, watched.stderr).toBe(0)

    expect(asked.map((chats) => [...chats].sort())).toEqual([[UNKNOWN, PHONE]])
    const ids = await chatIds(profile)
    expect(ids).toContain(LID)
    expect(ids).toContain(UNKNOWN)
    expect(ids).not.toContain(PHONE)
    const listed = await wa([profile, "--offline", "messages", "list", LID, "--json"])
    expect(JSON.parse(listed.stdout).items.map((one: { id: string }) => one.id)).toContain(message(LID, 11).id)
  })

  it("warns once when the engine cannot take them, and watch goes on", async () => {
    const profile = "stored-phone-chats-refused"
    await storeInPhoneForm(profile, 21)
    const controller = new AbortController()
    const refusing = () => {
      const engine = fakeEngine(seed)
      engine.storedChats = async () => {
        setImmediate(() => controller.abort())
        throw new Error("synthetic refusal")
      }
      return engine
    }
    const watched = await wa([profile, "watch", "--jsonl"], refusing, controller.signal)
    expect(watched.code, watched.stderr).toBe(0)
    expect(watched.stderr.match(/not told the stored chats: synthetic refusal/g)).toHaveLength(1)
  })
})
