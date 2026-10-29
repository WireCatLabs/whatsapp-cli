import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { PassThrough } from "node:stream"
import { fileURLToPath } from "node:url"
import { captureStreams } from "@wirecat/cli-base"
import { PASTE_QR, plainQr } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it, vi } from "vitest"
import { whatsAppAdapter } from "../adapter/adapter.js"
import { EngineError } from "../engine/contract.js"
import type { EngineRequest, Environment } from "../messenger.js"
import { privateStore } from "../paths.js"
import { run } from "../program.js"
import { BAN_WARNING, receiveHistory } from "../session.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "../testing/fake-engine.js"

// serve offers no relay on Windows, so there the lock's listeningAt is the sign it is up.
const listening = (lock: string): unknown => {
  const held = JSON.parse(readFileSync(lock, "utf8"))
  return process.platform === "win32" ? held.listeningAt : held.relay
}

const seed = contractSeed({ ids: whatsAppIds })
const STUB = fileURLToPath(new URL("../testing/engine-stub.mjs", import.meta.url))
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
    const linked = await wa(["fresh", "session", "start", "--json"], (request) => {
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
    expect(linked.stderr).toContain(plainQr("FAKECODE"))
    expect(linked.stderr).toContain(PASTE_QR)
    const event = linked.stderr.match(/\{"event":"qr".*?\}\}/)?.[0]
    expect(JSON.parse(event ?? "{}")).toEqual({
      event: "qr",
      qr: { text: plainQr("FAKECODE"), expires_at: null, scan: expect.stringContaining("Linked devices") },
    })

    const listed = await wa(["fresh", "chats", "list", "--json"], never)
    expect(listed.code).toBe(0)
    expect(JSON.parse(listed.stdout).items.length).toBe(seed.chats.length)
  })

  it("ends the history wait on a cancel, keeps what came, and still answers with exit 0", async () => {
    const stop = new AbortController()
    const engine = fakeEngine(seed, { linked: false })
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const unlisten = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => stop.abort())
      return unlisten
    }
    const result = await wa(["cancelled", "session", "start", "--json"], () => engine, {
      signal: stop.signal,
      historyWait: { firstMs: 60_000, quietMs: 60_000 },
    })
    expect(result.code, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).item.received.messages).toBe(seed.messages.length)
    expect(engine.closed).toBe(true)
  })

  it("says once that it is still waiting when the phone's history is slow to come", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    try {
      const engine = fakeEngine(seed)
      const listen = engine.listen
      engine.listen = (kinds, onEvent) => {
        if (!kinds.includes("history")) return listen(kinds, onEvent)
        let unlisten = () => {}
        const late = setTimeout(() => {
          unlisten = listen(kinds, onEvent)
        }, 100)
        return () => {
          clearTimeout(late)
          unlisten()
        }
      }
      const slow = vi.fn()
      const pending = receiveHistory(whatsAppAdapter(engine), { firstMs: 5_000, quietMs: 0, slowMs: 10 }, slow)
      await vi.advanceTimersByTimeAsync(101)
      expect((await pending).messages).toBe(seed.messages.length)
      expect(slow).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }

    const quick = await wa(["quick", "session", "start", "--json"], () => fakeEngine(seed, { linked: false }), {
      historyWait: { ...QUICK, slowMs: 60_000 },
    })
    expect(quick.stderr).not.toContain("still waiting")
  })

  it("asks nothing and counts nothing when the profile is already linked", async () => {
    const result = await wa(["linked", "session", "start", "--json"], () => fakeEngine(seed))
    expect(result.code).toBe(0)
    const answer = JSON.parse(result.stdout).item
    expect(answer).toMatchObject({ already_linked: true })
    expect(answer).not.toHaveProperty("received")
  })

  it("refuses a phone link without a terminal, with a store left without a device by an unfinished link", async () => {
    const store = privateStore("halfdone")
    mkdirSync(dirname(store), { recursive: true })
    writeFileSync(store, "")
    const engine = fakeEngine(seed, { linked: false })
    const result = await wa(["halfdone", "session", "start", "phone", "--json"], () => engine)
    expect(result.code).toBe(2)
    const { error } = JSON.parse(result.stderr)
    expect(error).toMatchObject({ reason: "input.required", message: expect.stringContaining("run it in a terminal") })
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

  it("closes the engine when the login is interrupted", async () => {
    const stop = new AbortController()
    const engine = neverScanned(stop)
    const result = await wa(["interrupted", "session", "start", "--json"], () => engine, {
      signal: stop.signal,
    })
    expect(result.code).toBe(130)
    expect(engine.closed).toBe(true)
  })

  it("closes the engine when the login runs past its deadline", async () => {
    const engine = neverScanned()
    const result = await wa(["late", "session", "start", "--timeout", "50ms", "--json"], () => engine)
    expect(result.code).toBe(9)
    expect(engine.closed).toBe(true)
  })

  it("refuses to link under WA_READ_ONLY", async () => {
    const engine = fakeEngine(seed, { linked: false })
    let opened = false
    const opening = () => {
      opened = true
      return engine
    }
    const result = await wa(["unlinked", "session", "start", "--json"], opening, {
      env: { ...process.env, WA_READ_ONLY: "1" },
    })
    expect(result.code).toBe(5)
    expect(JSON.parse(result.stderr).error.message).toContain("cannot log in or out")
    expect(engine.self()).toBeNull()
    expect(opened).toBe(false)
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
      terminal("+7 000 000 00 01\n"),
    )
    expect(result.code).toBe(0)
    expect(result.stderr).toMatch(/pairing code: \S+/)
    expect(result.stderr).toContain("FAKECODE")
    expect(result.stderr).toContain("Link with phone number instead")
  })

  it("refuses a number without + and the country code before it reaches WhatsApp", async () => {
    let engine: FakeEngine | undefined
    const result = await wa(
      ["guessed", "session", "start", "phone"],
      () => {
        engine = fakeEngine(seed, { linked: false })
        vi.spyOn(engine, "link")
        return engine
      },
      terminal("000 000 00 01\n"),
    )
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("write the phone number with + and the country code")
    expect(engine?.link).not.toHaveBeenCalled()
  })

  it("warns about bans on stderr before the code, once per link and even with --quiet", async () => {
    const warnsBefore = (stderr: string, code: string) => {
      expect(stderr).toContain(BAN_WARNING)
      expect(stderr.indexOf(BAN_WARNING)).toBeLessThan(stderr.indexOf(code))
      expect(stderr.split(BAN_WARNING)).toHaveLength(2)
    }
    const scanned = await wa(["warned", "session", "start"], () => fakeEngine(seed, { linked: false }), terminal())
    expect(scanned.code, scanned.stderr).toBe(0)
    warnsBefore(scanned.stderr, "Linked devices")
    expect(scanned.stdout).not.toContain("ban")

    const quiet = await wa(
      ["hushed", "session", "start", "--quiet"],
      () => fakeEngine(seed, { linked: false }),
      terminal(),
    )
    expect(quiet.stderr).toContain(BAN_WARNING)

    const paired = await wa(
      ["warnedphone", "session", "start", "phone"],
      () => fakeEngine(seed, { linked: false }),
      terminal("+7 000 000 00 01\n"),
    )
    expect(paired.code, paired.stderr).toBe(0)
    warnsBefore(paired.stderr, "pairing code:")
    expect(paired.stdout).toContain("Linked as")
    expect(paired.stdout).not.toContain("ban")

    const again = await wa(["warned", "session", "start"], () => fakeEngine(seed), terminal())
    const later = await wa(["warned", "chats", "list"], never)
    expect(`${again.stderr}${later.stderr}`).not.toContain(BAN_WARNING)
  })

  const drawnAt = async (columns: number) => {
    const before = Object.getOwnPropertyDescriptor(process.stderr, "columns")
    Object.defineProperty(process.stderr, "columns", { value: columns, configurable: true })
    try {
      const result = await wa(["scanned", "session", "start"], () => fakeEngine(seed, { linked: false }), terminal())
      expect(result.code).toBe(0)
      return result.stderr
    } finally {
      if (before) Object.defineProperty(process.stderr, "columns", before)
      else delete (process.stderr as { columns?: number }).columns
    }
  }

  it("draws the QR code in the terminal, then says where to scan it", async () => {
    const shown = await drawnAt(200)
    expect(shown).toMatch(/[█▀▄]/)
    expect(shown.indexOf("Linked devices")).toBeGreaterThan(shown.lastIndexOf("▀"))
  })

  it("does not ask to scan a code a narrow terminal could not draw", async () => {
    const shown = await drawnAt(20)
    expect(shown).toContain("20 columns wide")
    expect(shown).not.toMatch(/[█▀▄]/)
    expect(shown).not.toContain("Linked devices")
  })

  it("tells a person the profile is linked already, and how to link again", async () => {
    if (!seed.account) throw new Error("the contract seed has an account")
    const nameless = { ...seed, account: { ...seed.account, name: null } }
    const result = await wa(["again", "session", "start"], () => fakeEngine(nameless), terminal())
    expect(result.code, result.stderr).toBe(0)
    const out = `${result.stdout}${result.stderr}`
    expect(out).toContain("Already linked as you — profile again; nothing was asked.")
    expect(out).toContain("`wa again session end` first to link again")
    expect(out).not.toContain("History:")
  })

  it("passes on why linking failed, in the engine's own code", async () => {
    const engine = fakeEngine(seed, { linked: false })
    engine.link = async () => {
      throw new EngineError("timeout", "the login code expired before the phone confirmed it")
    }
    const result = await wa(["expired", "session", "start", "--json"], () => engine)
    expect(result.stderr.startsWith(BAN_WARNING)).toBe(true)
    expect(JSON.parse(result.stderr.slice(BAN_WARNING.length)).error).toMatchObject({ code: "timeout" })
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

  it("deletes the keys and says so when WhatsApp had already dropped the device", async () => {
    const store = linkedProfile("forgotten")
    const engine = fakeEngine(seed)
    engine.logout = async () => {
      engine.push({ event: "connection", state: "logged_out" })
      await new Promise((next) => setImmediate(next))
      throw new EngineError("authentication_error", "WhatsApp logged this device out", "device.logged-out")
    }
    const result = await wa(["forgotten", "session", "end", "--json"], () => engine)
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toEqual({ profile: "forgotten", ended: true })
    expect(result.stderr).toContain("WhatsApp had already dropped this device; deleted its keys here")
    expect(existsSync(store)).toBe(false)
  })

  it("keeps the keys when the connection broke after the logout left", async () => {
    const store = linkedProfile("cutoff")
    const engine = fakeEngine(seed)
    engine.logout = async () => {
      throw new EngineError(
        "outcome_unknown",
        "the connection to WhatsApp broke before it confirmed the change; it may have gone through — check first",
      )
    }
    const result = await wa(["cutoff", "session", "end", "--json"], () => engine)
    expect(result.code).not.toBe(0)
    expect(JSON.parse(result.stderr).error.message).toContain("it may have gone through")
    expect(existsSync(store)).toBe(true)
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
    expect(JSON.parse(result.stderr).error.message).toContain("cannot log in or out")
    expect(engine.loggedOut).toBe(false)
    expect(existsSync(store)).toBe(true)
  })

  it("refuses while serve holds the device, and leaves serve's connection and the keys alone", async () => {
    const store = linkedProfile("serving")
    const lock = join(process.env.WA_STATE_DIR ?? "", "serve", "serving.lock")
    const controller = new AbortController()
    const served = fakeEngine(seed)
    const serving = wa(["serving", "serve", "--json"], () => served, { signal: controller.signal })
    await vi.waitFor(() => expect(listening(lock)).toBeDefined(), { timeout: 5000 })

    // Never relayed: run here, it meets the device lock serve holds, as the Go engine refuses it.
    const result = await wa(["serving", "session", "end", "--json"], undefined, {
      engineCommand: { file: process.execPath, args: [STUB, "--mode", "refuse"] },
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

  it("refuses when an older client relays it into serve, and leaves serve's connection alone", async () => {
    const store = linkedProfile("relayedend")
    const served = fakeEngine(seed)
    const result = await wa(["relayedend", "session", "end", "--json"], never, {
      relayed: { profile: "relayedend", cwd: process.cwd(), connection: () => whatsAppAdapter(served) },
    })
    expect(result.code).toBe(5)
    expect(JSON.parse(result.stderr).error).toMatchObject({
      code: "permission_error",
      details: { sent: false },
      message: expect.stringContaining("server stop"),
    })
    expect(served.loggedOut).toBe(false)
    expect(existsSync(store)).toBe(true)
  })

  it("says nothing was ended for a profile that was never linked", async () => {
    const result = await wa(["never", "session", "end", "--json"], never)
    expect(JSON.parse(result.stdout).item).toEqual({ profile: "never", ended: false })
  })
})
