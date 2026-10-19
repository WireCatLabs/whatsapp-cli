import { createHash } from "node:crypto"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PHONE = "70000000009@s.whatsapp.net"
const LID = "100000000000003@lid"
const UNKNOWN = "70000000008@s.whatsapp.net"
const TEXT = "synthetic text to take back"

const fileStore = process.env.MESSAGING_STORE
beforeEach(() => {
  process.env.MESSAGING_STORE = join(mkdtempSync(join(tmpdir(), "store-")), "messages.db")
})
afterEach(() => {
  process.env.MESSAGING_STORE = fileStore
})

// The Go engine answers a send to a phone-form chat under the LID it knows, as cli-core then stores it.
const lidEngine = (): FakeEngine => {
  const engine = fakeEngine(seed, { lids: { [PHONE]: LID } })
  const send = engine.send
  engine.send = async (request) => {
    const sent = await send(request)
    return request.chat === PHONE ? { ...sent, chat: LID } : sent
  }
  return engine
}

const wa = async (argv: string[], engine?: FakeEngine) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, ...(engine ? { engine: () => engine } : {}) })
  const result = { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
  expect(result.code, result.stderr).toBe(0)
  return result
}

const answerId = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 8)

describe("a one-to-one chat typed by its phone number", () => {
  it("is addressed by its LID in every command, so a later delete, star and vote reach the sent message", async () => {
    const profile = "typed-phone"
    const engine = lidEngine()
    await wa([profile, "messages", "send", PHONE, TEXT, "--json"], engine)
    const sent = engine.sends.at(-1)?.id as string
    expect(engine.sends.map((one) => one.chat)).toEqual([LID])

    await wa([profile, "messages", "star", PHONE, sent, "--json"], engine)
    const starred = await wa([profile, "--offline", "messages", "list", LID, "starred:true", "--json"])
    expect(JSON.parse(starred.stdout).items.map((one: { id: string }) => one.id)).toEqual([sent])
    await wa([profile, "polls", "create", PHONE, "Which day?", "Monday", "Tuesday", "--json"], engine)
    const poll = JSON.parse((await wa([profile, "--offline", "messages", "list", LID, "--json"])).stdout).items.find(
      (one: { text: string }) => one.text === "Which day?",
    ).id
    await wa([profile, "polls", "vote", PHONE, poll, answerId("Tuesday"), "--json"], engine)
    await wa([profile, "messages", "delete", PHONE, sent, "--for-everyone", "--allow-dangerous", "--json"], engine)

    expect(engine.actions.map((action) => [action.op, action.key.chat])).toEqual([
      ["star", LID],
      ["vote", LID],
      ["revoke", LID],
    ])
    const chats = JSON.parse((await wa([profile, "--offline", "chats", "list", "--json"])).stdout).items
    expect(chats.map((chat: { id: string }) => chat.id)).not.toContain(PHONE)
    const listed = JSON.parse((await wa([profile, "--offline", "messages", "list", LID, "--json"])).stdout).items
    expect(listed.map((one: { text: string }) => one.text)).not.toContain(TEXT)
  })

  it("keeps the number when WhatsApp's LID map does not know it, and asks only for phone-form ids", async () => {
    const profile = "unknown-phone"
    const engine = lidEngine()
    await wa([profile, "messages", "send", UNKNOWN, TEXT, "--json"], engine)
    await wa([profile, "messages", "send", seed.busy, TEXT, "--json"], engine)
    expect(engine.sends.map((one) => one.chat)).toEqual([UNKNOWN, seed.busy])
    expect(engine.canonicalAsked).toEqual([UNKNOWN])
  })
})
