import { CliError } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import { fakeEngine, whatsAppIds } from "../testing/fake-engine.js"
import { whatsAppAdapter } from "./adapter.js"

const seed = contractSeed({ ids: whatsAppIds })

describe("adapter input errors", () => {
  it("reports name fields without command syntax and changes nothing", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine)
    try {
      await adapter.updateProfile({ lastName: "Example" })
      expect.fail("a last name without a first name was accepted")
    } catch (error) {
      expect(error).toBeInstanceOf(CliError)
      expect(error).toMatchObject({
        code: "validation_error",
        details: { reason: "input.field-conflict", fields: ["lastName", "firstName"] },
      })
      if (error instanceof Error) expect(error.message).not.toContain("--")
    }
    expect(engine.profileChanges).toEqual([])
  })

  it("reports privacy fields without command syntax and changes nothing", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine)
    await expect(adapter.updatePrivacy({ hideOnline: true, lastSeen: "contacts" })).rejects.toMatchObject({
      code: "validation_error",
      details: { reason: "input.field-conflict", fields: ["hideOnline", "lastSeen"] },
    })
    await expect(adapter.updatePrivacy({ chatInvites: "nobody" })).rejects.toMatchObject({
      code: "validation_error",
      details: { reason: "input.field-unsupported", fields: ["chatInvites"] },
    })
    await expect(adapter.updatePrivacy({ findByPhone: "everyone" })).rejects.toMatchObject({
      code: "validation_error",
      details: { reason: "input.field-unsupported", fields: ["findByPhone"] },
    })
    await expect(adapter.updatePrivacy({ profilePhoto: "contacts_except" })).rejects.toMatchObject({
      code: "validation_error",
      details: { reason: "input.field-unsupported", fields: ["profilePhoto"] },
    })
    expect(engine.privacyChanges).toEqual([])
  })
})
