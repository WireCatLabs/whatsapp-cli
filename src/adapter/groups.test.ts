import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import { fakeEngine, whatsAppIds } from "../testing/fake-engine.js"
import { whatsAppAdapter } from "./adapter.js"

const seed = contractSeed({ ids: whatsAppIds })
const owner = seed.account?.id as string

describe("group moderation", () => {
  it("pages a group's members with their roles, and names its admins by the ids the store keeps", async () => {
    const adapter = whatsAppAdapter(fakeEngine(seed))
    const first = await adapter.members(seed.busy, { limit: 2, offset: 0 })
    expect(first).toMatchObject({ chatId: seed.busy, hasMore: true, participantsCount: 3 })
    expect(first.items[0]).toEqual({ id: owner, name: "Owner", username: null, role: "owner" })
    expect(await adapter.admins(seed.busy)).toEqual([owner])
  })

  it("refuses a chat that is not a group before asking WhatsApp", async () => {
    const adapter = whatsAppAdapter(fakeEngine(seed))
    await expect(adapter.members(seed.person, { offset: 0 })).rejects.toMatchObject({ code: "validation_error" })
  })
})
