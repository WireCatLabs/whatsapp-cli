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
