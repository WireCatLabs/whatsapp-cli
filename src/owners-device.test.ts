import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { describe, expect, it, vi } from "vitest"
import { privateStore, usesOwnersDevice } from "./paths.js"
import { run } from "./program.js"

const owner = vi.hoisted(() => ({ home: "" }))

// The account's own home comes from the user database; here it is a folder of this test, never the real one.
vi.mock("node:os", async (importOriginal) => {
  const os = await importOriginal<typeof import("node:os")>()
  return { ...os, userInfo: () => ({ ...os.userInfo(), homedir: owner.home }) }
})

owner.home = mkdtempSync(join(tmpdir(), "owner-"))

/** Only the config folder moved: the state folder, and the device in it, is the owner's. */
const configOnlyMoved = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: owner.home }
  for (const name of ["WA_STATE_DIR", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME"]) delete env[name]
  return env
}

const ownersDevice = (profile: string, env: NodeJS.ProcessEnv) => {
  const store = privateStore(profile, env)
  mkdirSync(dirname(store), { recursive: true })
  writeFileSync(store, "")
  return store
}

describe("a run with moved folders and the owner's linked device (WC-SECR-24)", () => {
  it("**session end keeps the device linked and its keys in place**", async () => {
    const env = configOnlyMoved()
    const store = ownersDevice("personal", env)
    const streams = captureStreams()

    const code = await run(["personal", "session", "end", "--json"], { streams, tty: false, env })

    expect(code, streams.stderr.join("")).toBe(0)
    expect(JSON.parse(streams.stdout.join("")).item).toEqual({ profile: "personal", ended: false })
    expect(streams.stderr.join("")).toContain("its device keys are the owner's")
    expect(existsSync(store)).toBe(true)
  })

  it("a run whose state folder moved holds its own device, which it may end", () => {
    expect(usesOwnersDevice("personal", process.env)).toBe(false)
  })

  it("**account remove refuses, and deletes neither the device nor the owner's other files**", async () => {
    const env = configOnlyMoved()
    const store = ownersDevice("side", env)
    const state = dirname(dirname(dirname(store)))
    const account = join(state, "accounts", "side.json")
    mkdirSync(dirname(account), { recursive: true })
    writeFileSync(account, JSON.stringify({ account: "601" }))
    const config = join(env.WA_CONFIG_DIR ?? "", "config.json")
    mkdirSync(dirname(config), { recursive: true })
    writeFileSync(config, JSON.stringify({ profiles: { side: {} } }))
    const streams = captureStreams()

    const code = await run(["side", "account", "remove", "--keep-data", "--yes", "--json"], {
      streams,
      tty: false,
      env,
    })

    expect(code).not.toBe(0)
    expect(JSON.parse(streams.stderr.join("")).error).toMatchObject({ reason: "device.owners" })
    expect(existsSync(store)).toBe(true)
    expect(existsSync(account)).toBe(true)
  })
})
