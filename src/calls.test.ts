import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WaMessage, WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PROFILE = "calls"
const ringing: WaMessage = {
  id: "call-C0FFEE01",
  chat: seed.dialog,
  sender: seed.person,
  senderName: "Ann Lee",
  fromMe: false,
  timestamp: "2026-09-02T08:00:00.000Z",
  editedAt: null,
  text: "Incoming voice call",
  replyTo: null,
  call: { video: false },
}
const missed: WaMessage = { ...ringing, text: "Missed voice call", call: { video: false, outcome: "missed" } }

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
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

let watched = ""
beforeAll(async () => {
  store = join(mkdtempSync(join(tmpdir(), "wa-calls-")), "messages.db")
  const controller = new AbortController()
  const calling = () => {
    const engine = fakeEngine(seed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("message"))
        setImmediate(() => {
          engine.push({ event: "message", message: ringing })
          engine.push({ event: "message", message: missed })
          setImmediate(() => controller.abort())
        })
      return stop
    }
    return engine
  }
  const result = await wa([PROFILE, "watch", "--jsonl"], calling, controller.signal)
  expect(result.code).toBe(0)
  watched = result.stdout
})

describe("a call someone made to the owner", () => {
  it("is passed on by watch as it rings and as it ends", () => {
    const rang = watched.indexOf('"text":"Incoming voice call"')
    expect(rang).toBeGreaterThan(-1)
    expect(watched.indexOf('"text":"Missed voice call"')).toBeGreaterThan(rang)
    expect(watched).toContain('"providerMetadata":{"action":"call","video":false,"outcome":"missed"}')
  })

  it("is one stored message that says the call was missed, marked as a call", async () => {
    const listed = await wa([PROFILE, "messages", "list", seed.dialog, "--json"])
    expect(listed.code).toBe(0)
    const calls = JSON.parse(listed.stdout).items.filter((message: { id: string }) => message.id === ringing.id)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      text: "Missed voice call",
      outgoing: false,
      provider_metadata: { action: "call", video: false, outcome: "missed" },
    })
  })

  it("shows in the inbox", async () => {
    const inbox = await wa([PROFILE, "inbox", "--all", "--json"])
    expect(inbox.code).toBe(0)
    expect(inbox.stdout).toContain("Missed voice call")
  })
})
