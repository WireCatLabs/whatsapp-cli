import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import type { Environment } from "./messenger.js"
import { privateStore } from "./paths.js"
import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const STUB = fileURLToPath(new URL("./testing/engine-stub.mjs", import.meta.url))

const wa = async (argv: string[], environment: Environment = {}) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, ...environment })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const linked = (profile: string) => {
  const store = privateStore(profile)
  mkdirSync(dirname(store), { recursive: true })
  writeFileSync(store, "")
}

const stub = (mode: string): Environment => ({
  engineCommand: { file: process.execPath, args: [STUB, "--mode", mode] },
})

describe("connecting to WhatsApp", () => {
  it("starts the engine for a linked profile and sends through it", async () => {
    linked("gostub")
    const result = await wa(["gostub", "messages", "send", "100000000000002@lid", "hello", "--json"], stub("ok"))
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item.message).toMatchObject({
      text: "hello",
      outgoing: true,
      provider: "whatsapp",
    })
  })

  it("refuses while another command holds the device, naming it", async () => {
    linked("held")
    const result = await wa(["held", "messages", "send", "100000000000002@lid", "hi", "--json"], stub("refuse"))
    expect(result.code).not.toBe(0)
    expect(JSON.parse(result.stderr).error).toMatchObject({
      code: "provider_unavailable",
      message: expect.stringContaining("messages send"),
    })
  })

  it("says how to log in when the engine finds no device in the store", async () => {
    linked("emptied")
    const result = await wa(
      ["emptied", "messages", "send", "100000000000002@lid", "hi", "--json"],
      stub("unlinked-store"),
    )
    expect(result.code).toBe(4)
    expect(JSON.parse(result.stderr).error.message).toContain("wa emptied session start")
  })

  it("refuses a write when the engine has no account, and stops the engine", async () => {
    const engine = fakeEngine(seed, { linked: false })
    const result = await wa(["noaccount", "messages", "send", seed.dialog, "hi", "--json"], { engine: () => engine })
    expect(result.code).toBe(4)
    expect(JSON.parse(result.stderr).error.message).toContain("session start")
    expect(engine.closed).toBe(true)
  })
})

describe("wa doctor", () => {
  const CHECKOUT = "/home/a/Projects/whatsapp-cli/dist/x.js"
  const doctor = async (profile: string, env: NodeJS.ProcessEnv, scriptPath = CHECKOUT) => {
    const result = await wa([profile, "doctor", "--json"], {
      env: { ...process.env, ...env },
      update: { scriptPath },
      engine: () => {
        throw new Error("doctor must never start the engine")
      },
    })
    expect(result.code).toBe(0)
    return JSON.parse(result.stdout).item.whatsapp
  }

  it("says the engine is missing and how to get it, for a checkout and for an install", async () => {
    const env = { WA_ENGINE: `${process.env.TMPDIR}/no-such-engine` }
    expect((await doctor("noengine", env)).engine).toMatchObject({
      found: false,
      hint: expect.stringContaining("pnpm engine:build"),
    })
    const installed = await doctor("noengine", env, "/home/a/.npm-global/lib/node_modules/@wirecat/whatsapp-cli/x.js")
    expect(installed.engine.hint).toContain("WA_ENGINE")
  })

  it("finds the engine, checks the device keys' modes without opening them, and names the lock's holder", async () => {
    const binary = `${process.env.TMPDIR}/wa-engine-found`
    writeFileSync(binary, "", { mode: 0o755 })
    const store = privateStore("checked")
    mkdirSync(dirname(store), { recursive: true, mode: 0o700 })
    writeFileSync(store, "not a database", { mode: 0o644 })
    writeFileSync(`${store}.lock`, `serve (pid ${process.pid})\n`)

    const report = await doctor("checked", { WA_ENGINE: binary })
    expect(report.engine).toMatchObject({ found: true })
    expect(report.device).toMatchObject({ exists: true, files: { checked: true, ok: false } })
    expect(report.device.files.problems).toEqual([expect.objectContaining({ path: store, mode: "0644", want: "0600" })])
    expect(report.lock).toEqual({
      path: `${store}.lock`,
      holder: `serve (pid ${process.pid})`,
      pid: process.pid,
      running: true,
    })
    expect(JSON.stringify(report)).not.toContain("not a database")
  })

  it("does not count a holder whose process has ended as holding the lock", async () => {
    const store = privateStore("stale")
    mkdirSync(dirname(store), { recursive: true })
    writeFileSync(`${store}.lock`, "messages send (pid 2147483646)\n")
    expect((await doctor("stale", {})).lock).toMatchObject({ pid: 2147483646, running: false })
    expect((await doctor("unlinked", {})).lock).toMatchObject({ holder: null, running: false })
  })
})
