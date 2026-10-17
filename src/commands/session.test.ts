import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { PassThrough } from "node:stream"
import { CliError, captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import { EngineError } from "../engine/contract.js"
import type { EngineRequest, Environment } from "../messenger.js"
import { privateStore } from "../paths.js"
import { run } from "../program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "../testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
// The fake phone pushes its history in one batch, so the wait can end the moment it lands.
const QUICK = { firstMs: 5_000, quietMs: 0 }

const wa = async (argv: string[], engine?: (request: EngineRequest) => FakeEngine, more: Environment = {}) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, historyWait: QUICK, ...(engine ? { engine } : {}), ...more })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const never = () => {
  throw new Error("a read must never start the engine")
}

describe("wa session start", () => {
  it("links, keeps the history the phone pushes, and answers reads from it afterwards", async () => {
    const requests: EngineRequest[] = []
    let engine: FakeEngine | undefined
    const qrFile = `${process.env.TMPDIR}/login-qr.png`
    const linked = await wa(["fresh", "session", "start", "--qr-file", qrFile, "--json"], (request) => {
      requests.push(request)
      engine ??= fakeEngine(seed, { linked: false })
      return engine
    })
    expect(linked.code).toBe(0)
    const answer = JSON.parse(linked.stdout).item
    expect(answer).toMatchObject({ profile: "fresh", already_linked: false, account: { id: seed.account?.id } })
    expect(answer.received.messages).toBe(seed.messages.length)
    expect(requests[0]).toMatchObject({ link: true, holder: "session start" })
    expect(requests).toHaveLength(1)
    expect(engine?.closed).toBe(true)
    expect(existsSync(qrFile)).toBe(false)

    const listed = await wa(["fresh", "chats", "list", "--json"], never)
    expect(listed.code).toBe(0)
    expect(JSON.parse(listed.stdout).items.length).toBe(seed.chats.length)
  })

  it("asks nothing and receives nothing when the profile is already linked", async () => {
    const result = await wa(["linked", "session", "start", "--qr-file", `${process.env.TMPDIR}/x.png`, "--json"], () =>
      fakeEngine(seed),
    )
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({ already_linked: true, received: { messages: 0 } })
  })

  it("refuses to run without a terminal unless the QR goes to a file", async () => {
    const result = await wa(["headless", "session", "start", "--json"], () => fakeEngine(seed, { linked: false }))
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("--qr-file")
  })

  it("refuses a store left without a device by an unfinished link, when nobody can scan", async () => {
    const store = privateStore("halfdone")
    mkdirSync(dirname(store), { recursive: true })
    writeFileSync(store, "")
    const engine = fakeEngine(seed, { linked: false })
    const result = await wa(["halfdone", "session", "start", "--json"], () => engine)
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("--qr-file")
    expect(engine.closed).toBe(true)
  })

  it("refuses --qr-file with the phone method", async () => {
    const result = await wa(["both", "session", "start", "phone", "--qr-file", "x.png", "--json"])
    expect(result.code).toBe(2)
  })
})

describe("wa session start at a terminal", () => {
  // A person at a terminal: stdout a terminal too, and not under CI, or cli-core treats the run as headless.
  const terminal = (typed = ""): Environment => {
    const stdin = Object.assign(new PassThrough(), { isTTY: true })
    if (typed) stdin.end(typed)
    return { stdin, tty: true, env: { ...process.env, CI: "" } }
  }

  it("asks for the number and shows the pairing code with where to type it", async () => {
    const result = await wa(
      ["paired", "session", "start", "phone"],
      () => fakeEngine(seed, { linked: false }),
      terminal("+7 123 456 78 90\n"),
    )
    expect(result.code).toBe(0)
    expect(result.stderr).toMatch(/pairing code: \S+/)
    expect(result.stderr).toContain("FAKECODE")
    expect(result.stderr).toContain("Link with phone number instead")
  })

  it("draws the QR code in the terminal", async () => {
    const result = await wa(["scanned", "session", "start"], () => fakeEngine(seed, { linked: false }), terminal())
    expect(result.code).toBe(0)
    expect(result.stderr).toContain("Linked devices")
    expect(result.stderr.split("\n").length).toBeGreaterThan(10)
  })

  it("passes on why linking failed, in the engine's own code", async () => {
    const engine = fakeEngine(seed, { linked: false })
    engine.link = async () => {
      throw new EngineError("timeout", "the login code expired before the phone confirmed it")
    }
    const qrFile = `${process.env.TMPDIR}/expired.png`
    const result = await wa(["expired", "session", "start", "--qr-file", qrFile, "--json"], () => engine)
    expect(JSON.parse(result.stderr).error).toMatchObject({ code: "timeout" })
    expect(engine.closed).toBe(true)
  })
})

describe("wa session end", () => {
  const linkedProfile = (profile: string) => {
    const store = privateStore(profile)
    mkdirSync(dirname(store), { recursive: true })
    writeFileSync(store, "")
    return store
  }

  it("logs the device out on WhatsApp's side and deletes its keys here", async () => {
    const store = linkedProfile("ending")
    let engine: FakeEngine | undefined
    const result = await wa(["ending", "session", "end", "--json"], () => {
      engine = fakeEngine(seed)
      return engine
    })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toEqual({ profile: "ending", ended: true })
    expect(engine?.loggedOut).toBe(true)
    expect(existsSync(store)).toBe(false)
  })

  it("still deletes the keys when WhatsApp no longer knows the device", async () => {
    const store = linkedProfile("forgotten")
    const engine = fakeEngine(seed)
    engine.logout = async () => {
      throw new CliError("authentication_error", "WhatsApp no longer accepts this linked device")
    }
    const result = await wa(["forgotten", "session", "end", "--json"], () => engine)
    expect(result.code).toBe(0)
    expect(existsSync(store)).toBe(false)
  })

  it("keeps the keys when the logout fails for another reason", async () => {
    const store = linkedProfile("offline")
    const engine = fakeEngine(seed)
    engine.logout = async () => {
      throw new EngineError("network_error", "not connected to WhatsApp")
    }
    const result = await wa(["offline", "session", "end", "--json"], () => engine)
    expect(result.code).not.toBe(0)
    expect(existsSync(store)).toBe(true)
  })

  it("says nothing was ended for a profile that was never linked", async () => {
    const result = await wa(["never", "session", "end", "--json"], never)
    expect(JSON.parse(result.stdout).item).toEqual({ profile: "never", ended: false })
  })
})
