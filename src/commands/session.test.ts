import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { PassThrough } from "node:stream"
import { CliError, captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it, vi } from "vitest"
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

  it("asks nothing and counts nothing when the profile is already linked", async () => {
    const result = await wa(["linked", "session", "start", "--qr-file", `${process.env.TMPDIR}/x.png`, "--json"], () =>
      fakeEngine(seed),
    )
    expect(result.code).toBe(0)
    const answer = JSON.parse(result.stdout).item
    expect(answer).toMatchObject({ already_linked: true })
    expect(answer).not.toHaveProperty("received")
  })

  it("refuses to run without a terminal unless the QR goes to a file", async () => {
    const result = await wa(["headless", "session", "start", "--json"], () => fakeEngine(seed, { linked: false }))
    expect(result.code).toBe(2)
    const { error } = JSON.parse(result.stderr)
    expect(error.reason).toBe("input.required")
    expect(error.message).toContain("--qr-file")
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

  const neverScanned = (stop?: AbortController) => {
    const engine = fakeEngine(seed, { linked: false })
    engine.link = async (_request, onCode) => {
      onCode({ login: "qr", code: "FAKECODE" })
      stop?.abort()
      return new Promise(() => {})
    }
    return engine
  }

  it("closes the engine and removes the QR image when the login is interrupted", async () => {
    const stop = new AbortController()
    const engine = neverScanned(stop)
    const qrFile = `${process.env.TMPDIR}/interrupted.png`
    const result = await wa(["interrupted", "session", "start", "--qr-file", qrFile, "--json"], () => engine, {
      signal: stop.signal,
    })
    expect(result.code).toBe(130)
    expect(engine.closed).toBe(true)
    expect(existsSync(qrFile)).toBe(false)
  })

  it("closes the engine and removes the QR image when the login runs past its deadline", async () => {
    const engine = neverScanned()
    const qrFile = `${process.env.TMPDIR}/late.png`
    const result = await wa(
      ["late", "session", "start", "--qr-file", qrFile, "--timeout", "50ms", "--json"],
      () => engine,
    )
    expect(result.code).toBe(9)
    expect(engine.closed).toBe(true)
    expect(existsSync(qrFile)).toBe(false)
  })

  it("refuses to link under WA_READ_ONLY", async () => {
    const engine = fakeEngine(seed, { linked: false })
    const qrFile = `${process.env.TMPDIR}/locked.png`
    const result = await wa(["unlinked", "session", "start", "--qr-file", qrFile, "--json"], () => engine, {
      env: { ...process.env, WA_READ_ONLY: "1" },
    })
    expect(result.code).toBe(5)
    expect(engine.self()).toBeNull()
    expect(engine.closed).toBe(true)
  })

  it("refuses --qr-file with the phone method", async () => {
    const result = await wa(["both", "session", "start", "phone", "--qr-file", "x.png", "--json"])
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.param).toBe("--qr-file")
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

  it("refuses under WA_READ_ONLY and keeps the device", async () => {
    const store = linkedProfile("locked")
    const engine = fakeEngine(seed)
    const result = await wa(["locked", "session", "end", "--json"], () => engine, {
      env: { ...process.env, WA_READ_ONLY: "1" },
    })
    expect(result.code).toBe(5)
    expect(engine.loggedOut).toBe(false)
    expect(existsSync(store)).toBe(true)
  })

  it("refuses while serve holds the device, and leaves serve's connection and the keys alone", async () => {
    const store = linkedProfile("serving")
    const lock = join(process.env.WA_STATE_DIR ?? "", "serve", "serving.lock")
    const controller = new AbortController()
    const served = fakeEngine(seed)
    const serving = wa(["serving", "serve", "--json"], () => served, { signal: controller.signal })
    await vi.waitFor(() => expect(JSON.parse(readFileSync(lock, "utf8")).relay).toBeDefined(), { timeout: 5000 })

    const result = await wa(["serving", "session", "end", "--json"], () => {
      throw new Error("session end must not open an engine of its own while serve holds the device")
    })
    expect(result.code).toBe(12)
    expect(JSON.parse(result.stderr).error).toMatchObject({
      code: "provider_unavailable",
      reason: "device.in-use",
      message: expect.stringContaining("wa serving server stop"),
    })
    expect(served.loggedOut).toBe(false)
    expect(served.closed).toBe(false)
    expect(existsSync(store)).toBe(true)

    controller.abort()
    expect((await serving).code).toBe(0)
  })

  it("says nothing was ended for a profile that was never linked", async () => {
    const result = await wa(["never", "session", "end", "--json"], never)
    expect(JSON.parse(result.stdout).item).toEqual({ profile: "never", ended: false })
  })
})
