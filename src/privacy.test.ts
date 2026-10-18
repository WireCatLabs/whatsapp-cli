import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import type { WaPrivacy } from "./engine/privacy.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })

const wa = async (argv: string[], privacy?: WaPrivacy) => {
  let engine: FakeEngine | undefined
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    engine: () => {
      engine = fakeEngine(seed, privacy ? { privacy } : {})
      return engine
    },
  })
  const stdout = streams.stdout.join("")
  const stderr = streams.stderr.join("")
  return {
    code,
    item: code === 0 ? JSON.parse(stdout).item : undefined,
    error: code === 0 ? undefined : JSON.parse(stderr.slice(stderr.indexOf('{"error"'))).error,
    sent: engine?.privacyChanges ?? [],
  }
}

describe("wa account privacy", () => {
  it("`show` reads WhatsApp's settings under cli-core's names, and leaves out what WhatsApp has no setting for", async () => {
    const { code, item } = await wa(["privacy", "account", "privacy", "show", "--json"], {
      groupadd: "contacts",
      last: "none",
      online: "match_last_seen",
      calladd: "known",
    })
    expect(code).toBe(0)
    expect(item).toEqual({ calls: "contacts", chat_invites: "contacts", hide_online: true })
  })

  it("`show` leaves out a setting kept with exceptions, rather than rounding it", async () => {
    const { item } = await wa(["privacy", "account", "privacy", "show", "--json"], {
      groupadd: "contact_blacklist",
      last: "contact_blacklist",
      online: "all",
      calladd: "all",
    })
    expect(item).toEqual({ calls: "everyone", hide_online: false })
  })

  it("`set` sends only the settings named, under WhatsApp's names, and answers them all", async () => {
    const { code, item, sent } = await wa([
      "privacy",
      "account",
      "privacy",
      "set",
      "--chat-invites",
      "nobody",
      "--hide-online",
      "on",
      "--json",
    ])
    expect(code).toBe(0)
    expect(sent).toEqual([
      { name: "groupadd", value: "none" },
      { name: "last", value: "none" },
      { name: "online", value: "match_last_seen" },
    ])
    expect(item.privacy).toEqual({ calls: "everyone", chat_invites: "nobody", hide_online: true })
  })

  it("`set --hide-online off` shows last seen to contacts, and changes nothing already so", async () => {
    const hidden = { groupadd: "all", last: "none", online: "match_last_seen", calladd: "all" }
    const shown = await wa(["privacy", "account", "privacy", "set", "--hide-online", "off", "--json"], hidden)
    expect(shown.sent).toEqual([{ name: "last", value: "contacts" }])
    expect(shown.item.privacy.hide_online).toBe(false)

    const again = await wa(["privacy", "account", "privacy", "set", "--hide-online", "off", "--calls", "everyone"])
    expect(again.code).toBe(0)
    expect(again.sent).toEqual([])
  })

  it("refuses what WhatsApp has no setting for before sending anything", async () => {
    for (const option of [
      ["--find-by-phone", "contacts"],
      ["--phone-number", "nobody"],
      ["--calls", "nobody"],
    ]) {
      const { code, error, sent } = await wa(["privacy", "account", "privacy", "set", ...option, "--json"])
      expect(code).toBe(2)
      expect(error.code).toBe("validation_error")
      expect(sent).toEqual([])
    }
  })

  it("changes nothing when the profile denies it", async () => {
    expect((await wa(["denying", "config", "set", "permissions.account.privacy.set", "deny"])).code).toBe(0)
    const { code, error, sent } = await wa(["denying", "account", "privacy", "set", "--calls", "contacts", "--json"])
    expect(code).toBe(5)
    expect(error.code).toBe("permission_error")
    expect(sent).toEqual([])
  })
})
