import { mkdtempSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { PHONE_AWAY_WARN_DAYS, phoneState } from "./diagnose.js"

const DAY_MS = 24 * 60 * 60 * 1000

describe("phone last seen", () => {
  const store = join(mkdtempSync(join(tmpdir(), "wa-phone-")), "private.db")
  const seen = (daysAgo: number, now: number) => {
    writeFileSync(`${store}.phone-seen`, "")
    const at = new Date(now - daysAgo * DAY_MS)
    utimesSync(`${store}.phone-seen`, at, at)
  }

  it("is unknown before the engine saw the phone", () => {
    expect(phoneState(join(tmpdir(), "no-such-profile", "private.db"))).toEqual({ last_seen: null, days_away: null })
  })

  it("warns once the phone has been away long enough for WhatsApp to unlink the device", () => {
    const now = Date.now()
    seen(3, now)
    expect(phoneState(store, now)).toMatchObject({ days_away: 3 })
    expect(phoneState(store, now).warning).toBeUndefined()
    seen(PHONE_AWAY_WARN_DAYS, now)
    expect(phoneState(store, now).warning).toContain(`${PHONE_AWAY_WARN_DAYS} days`)
  })
})
