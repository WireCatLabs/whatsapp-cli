import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeEach, describe, expect, it } from "vitest"
import type { WaMessage, WhatsAppEngine } from "./engine/contract.js"
import { privateStore } from "./paths.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const queued: WaMessage = {
  id: "3EB0000000000000000Q01",
  chat: seed.dialog,
  sender: seed.person,
  senderName: "Ann Lee",
  fromMe: false,
  timestamp: "2026-09-02T08:00:00.000Z",
  editedAt: null,
  text: "synthetic queued text",
  replyTo: null,
  attachments: [],
}
const NOT_SAVED = "messages arriving during this command are not saved"

let store = ""
const wa = async (argv: string[], engine?: () => WhatsAppEngine) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    env: { ...process.env, MESSAGING_STORE: store },
    ...(engine ? { engine } : {}),
  })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

// WhatsApp hands a queued message over once the connection is up, which the send's own request opens.
const handingOverOnSend = (more: (engine: FakeEngine) => void = () => {}) => {
  const engine = fakeEngine(seed)
  const send = engine.send
  engine.send = async (...args) => {
    engine.push({ event: "message", message: queued })
    more(engine)
    return send(...args)
  }
  return engine
}

beforeEach(() => {
  store = join(mkdtempSync(join(tmpdir(), "wa-oneshot-")), "messages.db")
})

describe("a one-shot command with no serve running", () => {
  it("saves a message WhatsApp queued while nothing was connected", async () => {
    const sent = await wa(["oneshot", "messages", "send", seed.dialog, "synthetic text", "--json"], () =>
      handingOverOnSend(),
    )
    expect(sent.code).toBe(0)
    expect(sent.stderr).not.toContain(NOT_SAVED)

    const never = () => {
      throw new Error("a read must never start the engine")
    }
    const listed = await wa(["oneshot", "messages", "list", seed.dialog, "--json"], never)
    expect(listed.code).toBe(0)
    expect(JSON.parse(listed.stdout).items.map((message: { id: string }) => message.id)).toContain(queued.id)
  })

  it("warns that arrivals are not saved when the phone logs the device out mid-command", async () => {
    const sent = await wa(["phoneout", "messages", "send", seed.dialog, "synthetic text", "--json"], () =>
      handingOverOnSend((engine) => engine.push({ event: "connection", state: "logged_out" })),
    )
    expect(sent.stderr).toContain(NOT_SAVED)
  })

  it("ends quietly on session end, which logs the device out itself", async () => {
    const keys = privateStore("ownout")
    mkdirSync(dirname(keys), { recursive: true })
    writeFileSync(keys, "")
    const ended = await wa(["ownout", "session", "end", "--json"], () => {
      const engine = fakeEngine(seed)
      const logout = engine.logout
      // WhatsApp's own word that the device is gone reaches the CLI before the answer to the logout.
      engine.logout = async () => {
        engine.push({ event: "connection", state: "logged_out" })
        await new Promise((next) => setImmediate(next))
        await logout()
      }
      return engine
    })
    expect(ended.code).toBe(0)
    expect(ended.stderr).not.toContain(NOT_SAVED)
  })
})
