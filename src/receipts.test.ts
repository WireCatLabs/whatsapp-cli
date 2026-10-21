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
const PROFILE = "receipts"
const own = (id: string, text: string): WaMessage => ({
  id,
  chat: seed.dialog,
  sender: seed.account?.id ?? null,
  senderName: null,
  fromMe: true,
  timestamp: "2026-09-02T08:00:00.000Z",
  editedAt: null,
  text,
  replyTo: null,
})
const receipt = (id: string, delivery: "delivered" | "read", at: string) => ({
  event: "receipt" as const,
  receipt: { chat: seed.dialog, id, delivery, at },
})

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
  store = join(mkdtempSync(join(tmpdir(), "wa-receipts-")), "messages.db")
  const controller = new AbortController()
  const receiving = () => {
    const engine = fakeEngine(seed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("receipt"))
        setImmediate(() => {
          engine.push({ event: "message", message: own("3EB0R1", "Lunch at one?") })
          engine.push({ event: "message", message: own("3EB0R2", "Or two?") })
          engine.push(receipt("3EB0R1", "delivered", "2026-09-02T08:00:05.000Z"))
          engine.push(receipt("3EB0R1", "read", "2026-09-02T08:01:00.000Z"))
          engine.push(receipt("3EB0R1", "delivered", "2026-09-02T08:01:01.000Z"))
          engine.push(receipt("3EB0R2", "delivered", "2026-09-02T08:00:06.000Z"))
          setImmediate(() => controller.abort())
        })
      return stop
    }
    return engine
  }
  const result = await wa([PROFILE, "watch", "--events", "--jsonl"], receiving, controller.signal)
  expect(result.code).toBe(0)
  watched = result.stdout
})

describe("receipts for the owner's own messages", () => {
  it("are passed on by watch as they come", () => {
    expect(watched).toContain('"event":"delivery"')
    expect(watched).toContain('"delivery":"read"')
  })

  it("leave each message as far as it got, a late delivered never undoing a read", async () => {
    const listed = await wa([PROFILE, "messages", "list", seed.dialog, "--json"])
    expect(listed.code).toBe(0)
    const states = Object.fromEntries(
      JSON.parse(listed.stdout).items.map((message: { id: string; delivery?: string }) => [
        message.id,
        message.delivery,
      ]),
    )
    expect(states).toMatchObject({ "3EB0R1": "read", "3EB0R2": "delivered" })
  })
})
