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
