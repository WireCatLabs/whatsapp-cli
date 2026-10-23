import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import type { WaPrivacy } from "./engine/privacy.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"
import { DEFAULT_PRIVACY } from "./testing/fake-privacy.js"

const seed = contractSeed({ ids: whatsAppIds })

const wa = async (argv: string[], privacy: Partial<WaPrivacy> = {}) => {
  let engine: FakeEngine | undefined
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    engine: () => {
      engine = fakeEngine(seed, { privacy: { ...DEFAULT_PRIVACY, ...privacy } })
      return engine
    },
  })
  const stdout = streams.stdout.join("")
  const stderr = streams.stderr.join("")
  return {
    code,
    item: code === 0 ? JSON.parse(stdout).item : undefined,
    error: stderr.includes('{"error"') ? JSON.parse(stderr.slice(stderr.indexOf('{"error"'))).error : undefined,
    sent: engine?.privacyChanges ?? [],
  }
}

describe("wa account privacy", () => {
  it("`show` reads WhatsApp's settings under cli-core's names", async () => {
    const { code, item } = await wa(["privacy", "account", "privacy", "show", "--json"], {
      groupadd: "contacts",
      last: "none",
      online: "match_last_seen",
      calladd: "known",
      profile: "contact_blacklist",
      status: "contacts",
      readreceipts: "none",
    })
    expect(code).toBe(0)
    expect(item).toEqual({
      calls: "contacts",
      chat_invites: "contacts",
      hide_online: true,
      read_receipts: false,
      last_seen: "nobody",
      profile_photo: "contacts_except",
      about: "contacts",
    })
  })

  it("`show` leaves out who may add the account when kept with exceptions, and what WhatsApp did not send", async () => {
    const { item } = await wa(["privacy", "account", "privacy", "show", "--json"], {
      groupadd: "contact_blacklist",
      last: "contact_blacklist",
      status: "",
      readreceipts: "",
    })
    expect(item).toEqual({
      calls: "everyone",
      hide_online: false,
      last_seen: "contacts_except",
      profile_photo: "everyone",
    })
  })

  it("`set` sends only the settings named, under WhatsApp's names, and answers them all", async () => {
    const { code, item, sent } = await wa([
      "privacy",
      "account",
      "privacy",
      "set",
      "--chat-invites",
      "contacts",
      "--hide-online",
      "on",
      "--profile-photo",
      "nobody",
      "--about-text",
      "contacts",
      "--read-receipts",
      "off",
      "--json",
    ])
    expect(code).toBe(0)
    expect(sent).toEqual([
      { name: "profile", value: "none" },
      { name: "status", value: "contacts" },
      { name: "readreceipts", value: "none" },
      { name: "groupadd", value: "contacts" },
      { name: "last", value: "none" },
      { name: "online", value: "match_last_seen" },
    ])
    expect(item.privacy).toEqual({
      calls: "everyone",
      chat_invites: "contacts",
      hide_online: true,
      read_receipts: false,
      last_seen: "nobody",
      profile_photo: "nobody",
      about: "contacts",
    })
  })

  it("`set --last-seen` changes last seen alone, which also ends a hidden online", async () => {
    const hidden = { last: "none", online: "match_last_seen" }
    const { item, sent } = await wa(
      ["privacy", "account", "privacy", "set", "--last-seen", "everyone", "--json"],
      hidden,
    )
    expect(sent).toEqual([{ name: "last", value: "all" }])
    expect(item.privacy).toMatchObject({ last_seen: "everyone", hide_online: false })
  })

  it("`set --hide-online off` shows last seen to contacts, and changes nothing already so", async () => {
    const hidden = { last: "none", online: "match_last_seen" }
    const shown = await wa(["privacy", "account", "privacy", "set", "--hide-online", "off", "--json"], hidden)
    expect(shown.sent).toEqual([{ name: "last", value: "contacts" }])
    expect(shown.item.privacy.hide_online).toBe(false)

    const again = await wa(["privacy", "account", "privacy", "set", "--hide-online", "off", "--calls", "everyone"])
    expect(again.code).toBe(0)
    expect(again.sent).toEqual([])

    const onlineShown = { last: "none", online: "all" }
    expect((await wa(["privacy", "account", "privacy", "set", "--hide-online", "off"], onlineShown)).sent).toEqual([])
  })

  it("refuses what WhatsApp has no setting for before sending anything", async () => {
    for (const option of [
      ["--calls", "nobody"],
      ["--chat-invites", "nobody"],
      ["--hide-online", "on", "--last-seen", "contacts"],
      ["--profile-photo", "contacts_except"],
    ]) {
      const { code, error, sent } = await wa(["privacy", "account", "privacy", "set", ...option, "--json"])
      expect(code).toBe(2)
      expect(error.code).toBe("validation_error")
      if (option[1] === "contacts_except") {
        expect(error.reason).toBe("input.invalid")
        expect(sent).toEqual([])
        continue
      }
      expect(error.reason).toBe(option[0] === "--hide-online" ? "input.field-conflict" : "input.field-unsupported")
      expect(error.param).toBe(option[0])
      expect(error.details.fields).toEqual(
        option[0] === "--hide-online" ? ["--hide-online", "--last-seen"] : [option[0]],
      )
      expect(sent).toEqual([])
    }
    for (const option of ["--find-by-phone", "--phone-number"]) {
      const { code, sent } = await wa(["privacy", "account", "privacy", "set", option, "contacts", "--json"])
      expect(code).toBe(2)
      expect(sent).toEqual([])
    }
  })

  it("changes nothing when the profile denies it", async () => {
    expect((await wa(["privacy-denying", "config", "set", "permissions.account.privacy.set", "deny"])).code).toBe(0)
    const { code, error, sent } = await wa([
      "privacy-denying",
      "account",
      "privacy",
      "set",
      "--calls",
      "contacts",
      "--json",
    ])
    expect(code).toBe(5)
    expect(error.code).toBe("permission_error")
    expect(sent).toEqual([])
  })
})
