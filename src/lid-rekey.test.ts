import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WaMessage, WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const fedRekeys: number[] = []
vi.mock("./adapter/adapter.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./adapter/adapter.js")>()
  return {
    ...original,
    whatsAppAdapter: (...args: Parameters<typeof original.whatsAppAdapter>) => {
      const adapter = original.whatsAppAdapter(...args)
      return {
        ...adapter,
        feed: (onBatch, signal) =>
          adapter.feed((batch) => {
            if (batch.rekeys?.length) fedRekeys.push(batch.rekeys.length)
            return onBatch(batch)
          }, signal),
      } satisfies typeof adapter
    },
  }
})

const seed = contractSeed({ ids: whatsAppIds })
const PHONE = "70000000009@s.whatsapp.net"
const LID = "100000000000001@lid"

// Every fake engine links the same account, so separate profiles would still share its chats in the file's store.
const fileStore = process.env.MESSAGING_STORE
beforeEach(() => {
  process.env.MESSAGING_STORE = join(mkdtempSync(join(tmpdir(), "store-")), "messages.db")
})
afterEach(() => {
  process.env.MESSAGING_STORE = fileStore
})

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

  const allChatIds = async (profile: string): Promise<string[]> =>
    JSON.parse((await wa([profile, "--offline", "chats", "list", "--all", "--json"])).stdout).items.map(
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

  it("re-keys as serve starts, and serve stops cleanly after it", async () => {
    const profile = "stored-phone-chats-served"
    await storeInPhoneForm(profile, 31)
    const controller = new AbortController()
    const starting = () => {
      const engine = fakeEngine(seed, { lids: { [PHONE]: LID } })
      const handOver = engine.storedChats
      engine.storedChats = async (chats) => {
        await handOver(chats)
        setImmediate(() => controller.abort())
      }
      return engine
    }
    const served = await wa([profile, "serve", "--json"], starting, controller.signal)
    expect(served.code, served.stderr).toBe(0)
    expect(served.stderr).not.toContain("stored_chats")

    expect(await chatIds(profile)).not.toContain(PHONE)
    const listed = await wa([profile, "--offline", "messages", "list", LID, "--json"])
    expect(JSON.parse(listed.stdout).items.map((one: { id: string }) => one.id)).toContain(message(LID, 31).id)
  })

  it("re-keys 500 stored phone-form chats as serve starts, and stops cleanly after them", async () => {
    const profile = "many-stored-phone-chats"
    const phones = Array.from({ length: 500 }, (_, n) => `7100000${String(n).padStart(4, "0")}@s.whatsapp.net`)
    const lids = Object.fromEntries(phones.map((phone, n) => [phone, `2000000000${String(n).padStart(5, "0")}@lid`]))

    const seeding = new AbortController()
    const seeded = await wa(
      [profile, "watch", "--jsonl"],
      () => {
        const engine = fakeEngine(seed)
        engine.storedChats = async () => {}
        setImmediate(() => {
          engine.push({
            event: "history",
            history: {
              kind: "recent",
              chats: phones.map(dm),
              contacts: [],
              messages: [],
              votes: [],
            },
          })
          setImmediate(() => seeding.abort())
        })
        return engine
      },
      seeding.signal,
    )
    expect(seeded.code, seeded.stderr).toBe(0)
    expect(await allChatIds(profile)).toEqual(expect.arrayContaining(phones))

    fedRekeys.length = 0
    const controller = new AbortController()
    const starting = () => {
      const engine = fakeEngine(seed, { lids })
      const handOver = engine.storedChats
      engine.storedChats = async (chats) => {
        await handOver(chats)
        setImmediate(() => controller.abort())
      }
      return engine
    }
    const served = await wa([profile, "serve", "--json"], starting, controller.signal)
    expect(served.code, served.stderr).toBe(0)
    // serve logs a warning as a bare "serve.warning" record, so "N chat re-keys not applied" is not in stderr.
    expect(served.stderr).not.toContain('"severity":"warn"')
    expect(fedRekeys).toEqual([500])

    const ids = await allChatIds(profile)
    expect(ids).toEqual(expect.arrayContaining(Object.values(lids)))
    expect(ids.filter((id) => phones.includes(id))).toEqual([])
  })

  it("moves a recipient added by a number with no stored chat to its LID as watch starts", async () => {
    const profile = "recipient-by-number"
    const added = await wa([profile, "recipients", "add", UNKNOWN, "--json"], () => fakeEngine(seed))
    expect(added.code, added.stderr).toBe(0)

    const controller = new AbortController()
    let recipients: string[][] = []
    const starting = () => {
      const engine = fakeEngine(seed, { lids: { [UNKNOWN]: LID } })
      recipients = engine.recipientsAsked
      const handOver = engine.storedChats
      engine.storedChats = async (chats, typed) => {
        await handOver(chats, typed)
        setImmediate(() => controller.abort())
      }
      return engine
    }
    const watched = await wa([profile, "watch", "--jsonl"], starting, controller.signal)
    expect(watched.code, watched.stderr).toBe(0)

    expect(recipients).toEqual([[UNKNOWN]])
    const listed = await wa([profile, "recipients", "list", "--json"])
    expect(JSON.parse(listed.stdout).items.map((one: { id: string }) => one.id)).toEqual([LID])
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
