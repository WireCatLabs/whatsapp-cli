import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { scrubPhoneNumbers } from "./scrub.ts"

const root = join(import.meta.dirname, "../..")

describe("the sample phone numbers in Meta's file", () => {
  it("are replaced by fictional ones, the same original by the same one, keeping a leading +", () => {
    const { text, replaced } = scrubPhoneNumbers(
      [
        "wa_id: '16505551234'",
        "from: 16505551234",
        "input: '+16505551234'",
        "description: call +1 (631) 555-1000 or +91 3854559033",
        "url: https://graph.facebook.com/v23.0/16505551234/messages",
        "to: 2026-10-01",
        "phone_number_id: '106540352242922'",
      ].join("\n"),
    )
    expect(text.split("\n")).toEqual([
      "wa_id: '1555-0101'",
      "from: 1555-0101",
      "input: '+1555-0102'",
      "description: call +1555-0103 or +1555-0104",
      "url: https://graph.facebook.com/v23.0/16505551234/messages",
      "to: 2026-10-01",
      "phone_number_id: '106540352242922'",
    ])
    expect(replaced).toBe(4)
  })

  it("are gone from the committed snapshot, which is what provenance.json says it is", () => {
    const provenance = JSON.parse(readFileSync(join(root, "spec/bot/provenance.json"), "utf8"))
    const snapshot = readFileSync(join(root, "spec/bot", provenance.file), "utf8")
    expect(createHash("sha256").update(snapshot).digest("hex")).toBe(provenance.sha256)
    expect(scrubPhoneNumbers(snapshot).replaced).toBe(0)
  })
})
