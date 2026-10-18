import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const PROFILE = "own-profile"

const updating = async (argv: string[], { settingsKeys = true, profile = PROFILE } = {}) => {
  let engine: FakeEngine | undefined
  const streams = captureStreams()
  const code = await run([profile, "account", "update", ...argv, "--json"], {
    streams,
    tty: false,
    engine: () => {
      engine = fakeEngine(seed, { settingsKeys })
      return engine
    },
  })
  const stdout = streams.stdout.join("")
  const stderr = streams.stderr.join("")
  return {
    code,
    item: code === 0 ? JSON.parse(stdout).item : undefined,
    error: code === 0 ? undefined : JSON.parse(stderr.slice(stderr.indexOf('{"error"'))).error,
    changes: engine?.profileChanges ?? [],
    closed: engine?.closed,
  }
}

describe("wa account update", () => {
  it("joins the first and last name into WhatsApp's one name, and answers the account with it", async () => {
    const result = await updating(["--first-name", "Synthetic ", "--last-name", "Owner"])
    expect(result.code).toBe(0)
    expect(result.changes).toEqual([{ pushName: "Synthetic Owner" }])
    expect(result.item).toMatchObject({ account: { id: seed.account?.id, name: "Synthetic Owner" } })
    expect(result.closed).toBe(true)
  })

  it("sets the about line from --description", async () => {
    const result = await updating(["--description", "Synthetic about"])
    expect(result.code).toBe(0)
    expect(result.changes).toEqual([{ about: "Synthetic about" }])
  })

  it.each([
    [["--last-name", "Owner"], "WhatsApp has one name"],
    [["--photo", "photo.jpg"], "profile photo"],
    [["--description", " "], "about cannot be empty"],
    [["--first-name", " ", "--last-name", " "], "name cannot be empty"],
  ])("refuses %j before anything changes", async (argv, message) => {
    const folder = mkdtempSync(join(tmpdir(), "wa-photo-"))
    writeFileSync(join(folder, "photo.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
    const result = await updating(argv.map((arg) => (arg === "photo.jpg" ? join(folder, arg) : arg)))
    expect(result.code).toBe(2)
    expect(result.error).toMatchObject({ code: "validation_error" })
    expect(result.error.message).toContain(message)
    expect(result.changes).toEqual([])
  })

  it("refuses at permission readonly under account.update, and changes nothing", async () => {
    const profile = "own-profile-readonly"
    const set = ["config", "set", "permissions.account.update", "readonly"]
    expect(await run([profile, ...set], { streams: captureStreams(), tty: false })).toBe(0)
    const result = await updating(["--first-name", "Synthetic"], { profile })
    expect(result.code).toBe(5)
    expect(result.error).toMatchObject({ code: "permission_error" })
    expect(result.changes).toEqual([])
  })

  it("says to keep serve running when WhatsApp has not sent the settings keys yet", async () => {
    const result = await updating(["--first-name", "Synthetic"], { settingsKeys: false })
    expect(result.code).toBe(12)
    expect(result.error).toMatchObject({ code: "provider_unavailable", reason: "settings.keys-missing" })
    expect(result.error.message).toContain(`wa ${PROFILE} serve`)
  })
})
