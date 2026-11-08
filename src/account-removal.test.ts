import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { captureStreams, memoryKeyring } from "@wirecat/cli-base"
import { holdLock, lockPath } from "@wirecat/cli-core/background"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it, vi } from "vitest"
import { WA } from "./app.js"
import { EngineError } from "./engine/contract.js"
import { WHATSAPP } from "./messenger.js"
import { pathsFor, privateStore } from "./paths.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const started = vi.hoisted(() => ({ engines: [] as unknown[], next: undefined as (() => unknown) | undefined }))

vi.mock("./engine/go-engine.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./engine/go-engine.js")>()),
  startGoEngine: async () => {
    const engine = started.next?.()
    started.engines.push(engine)
    return engine
  },
}))

const seed = contractSeed({ ids: whatsAppIds })

const linkedProfile = (profile: string) => {
  const config = join(pathsFor().config, "config.json")
  mkdirSync(dirname(config), { recursive: true })
  const known = existsSync(config) ? JSON.parse(readFileSync(config, "utf8")) : {}
  writeFileSync(config, JSON.stringify({ ...known, profiles: { ...known.profiles, [profile]: {} } }))
  const store = privateStore(profile)
  mkdirSync(dirname(store), { recursive: true })
  for (const suffix of ["", "-wal", "-shm"]) writeFileSync(`${store}${suffix}`, "")
  return store
}

const waCli = async (argv: string[], engine?: () => FakeEngine) => {
  started.engines = []
  started.next = engine
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, keyring: memoryKeyring() })
  const out = streams.stdout.join("")
  return { code, item: out ? JSON.parse(out).item : undefined, err: streams.stderr.join("") }
}

describe("account remove", () => {
  it("**unlinks the device on WhatsApp and forgets only this profile**", async () => {
    const store = linkedProfile("removing")
    const other = linkedProfile("staying")
    let engine: FakeEngine | undefined

    const { code, item, err } = await waCli(["removing", "account", "remove", "--keep-data", "--yes", "--json"], () => {
      engine = fakeEngine(seed)
      return engine
    })

    expect(code, err).toBe(0)
    expect(item.revoked).toBe(true)
    expect(engine?.loggedOut).toBe(true)
    expect(engine?.closed).toBe(true)
    expect(existsSync(dirname(store))).toBe(false)
    expect(existsSync(other)).toBe(true)
  })

  it("**--delete-data forgets the same device files**", async () => {
    const store = linkedProfile("deleting")

    const { code, item } = await waCli(["deleting", "account", "remove", "--delete-data", "--yes", "--json"], () =>
      fakeEngine(seed),
    )

    expect(code).toBe(0)
    expect(item.data).toBe("deleted")
    expect(existsSync(dirname(store))).toBe(false)
  })

  it("**succeeds when WhatsApp had already dropped the device**", async () => {
    const store = linkedProfile("dropped")
    const engine = fakeEngine(seed)
    engine.logout = async () => {
      throw new EngineError("authentication_error", "WhatsApp logged this device out", "device.logged-out")
    }

    const { code } = await waCli(["dropped", "account", "remove", "--keep-data", "--yes", "--json"], () => engine)

    expect(code).toBe(0)
    expect(existsSync(dirname(store))).toBe(false)
  })

  it("**succeeds on a profile that is already unlinked** without starting the engine", async () => {
    linkedProfile("empty")
    rmSync(dirname(privateStore("empty")), { recursive: true })

    const { code, item } = await waCli(["empty", "account", "remove", "--keep-data", "--yes", "--json"])

    expect(code).toBe(0)
    expect(item.revoked).toBeNull()
    expect(started.engines).toEqual([])
  })

  it("**keeps the device files when WhatsApp cannot be reached**", async () => {
    const store = linkedProfile("offline")
    const engine = fakeEngine(seed)
    engine.logout = async () => {
      throw new EngineError("network_error", "no route to WhatsApp")
    }

    const { code } = await waCli(["offline", "account", "remove", "--keep-data", "--yes", "--json"], () => engine)

    expect(code).not.toBe(0)
    expect(existsSync(store)).toBe(true)
  })

  it("**refuses while wa serve holds the profile** and unlinks nothing", async () => {
    const store = linkedProfile("served")
    const lock = lockPath(WA, "served", process.env)
    mkdirSync(dirname(lock), { recursive: true, mode: 0o700 })
    holdLock(lock, { pid: process.pid, startedAt: new Date().toISOString() })

    const { code } = await waCli(["served", "account", "remove", "--keep-data", "--yes", "--json"])

    expect(code).not.toBe(0)
    expect(started.engines).toEqual([])
    expect(existsSync(store)).toBe(true)
  })

  it("**does not unlink on WhatsApp when the run may not revoke**", async () => {
    linkedProfile("moved")

    const signed = await WHATSAPP.accountRemoval?.signOut("moved", { env: process.env, mayRevoke: false })

    expect(signed).toEqual({ revoked: false, removed: ["the linked-device keys"] })
    expect(started.engines).toEqual([])
  })
})
