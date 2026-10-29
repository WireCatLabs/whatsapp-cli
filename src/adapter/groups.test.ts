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

describe("group write authority", () => {
  it("refuses strangers before creating a group or adding members", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine)
    const stranger = "100000000000099@lid"
    await expect(adapter.createGroup("synthetic", [stranger], { channel: false })).rejects.toMatchObject({
      code: "permission_error",
    })
    await expect(adapter.addMembers(seed.busy, [stranger], {})).rejects.toMatchObject({ code: "permission_error" })
    expect(engine.groupActions).toEqual([])
  })

  it("allows a person the owner previously wrote to even if not in the address book", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine, {
      message: async () => undefined,
      newestIncoming: async () => undefined,
      anchor: async () => undefined,
      wroteTo: async (id) => id === "100000000000099@lid",
      pollVotes: async () => [],
      reactors: async () => [],
    })
    await adapter.addMembers(seed.busy, ["100000000000099@lid"], {})
    expect(engine.groupActions).toEqual([{ op: "add", jid: seed.busy, people: ["100000000000099@lid"] }])
  })

  it("refuses history exposure and unsupported settings without writing", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine)
    await expect(adapter.addMembers(seed.busy, [seed.person], { history: true })).rejects.toMatchObject({
      code: "validation_error",
    })
    await expect(
      adapter.updateGroup(seed.busy, {
        photo: { kind: "photo", name: "synthetic.png", source: { kind: "bytes", bytes: Buffer.from("x") } },
      }),
    ).rejects.toMatchObject({
      code: "validation_error",
    })
    await expect(adapter.updateGroup(seed.busy, { settings: { allCanPin: true } })).rejects.toMatchObject({
      code: "validation_error",
    })
    expect(engine.groupActions).toEqual([])
  })

  it("resolves people without confusing group ids, ambiguous names or unknown names", async () => {
    const engine = fakeEngine(seed)
    const original = await engine.directory()
    engine.directory = async () => [
      ...original,
      {
        jid: "100000000000077@lid",
        name: "Synthetic Person",
        kind: "dm",
        unread: null,
        lastMessageAt: null,
        participants: 2,
      },
    ]
    const adapter = whatsAppAdapter(engine)
    expect(await adapter.people([seed.person])).toEqual([seed.person])
    await expect(adapter.people([seed.busy])).rejects.toMatchObject({ code: "validation_error" })
    await expect(adapter.people(["absent synthetic person"])).rejects.toMatchObject({ code: "not_found" })
    expect(await adapter.people(["Synthetic Person"])).toEqual(["100000000000077@lid"])
    expect(await adapter.people(["synthetic per"])).toEqual(["100000000000077@lid"])
    engine.directory = async () => [
      { jid: "100000000000077@lid", name: "Same", kind: "dm", unread: null, lastMessageAt: null, participants: 2 },
      { jid: "100000000000078@lid", name: "Same", kind: "dm", unread: null, lastMessageAt: null, participants: 2 },
    ]
    await expect(adapter.people(["same"])).rejects.toMatchObject({ code: "validation_error" })
  })

  it("keeps provider administration facts and explicit changes in the returned card", async () => {
    const adapter = whatsAppAdapter(fakeEngine(seed))
    const card = await adapter.updateGroup(seed.busy, {
      title: "synthetic new title",
      description: "synthetic description",
      settings: { onlyAdminsAdd: true, joinApproval: true },
    })
    expect(card).toMatchObject({ title: "synthetic new title", settings: { onlyAdminsAdd: true, joinApproval: true } })
    expect(await adapter.group(seed.busy)).toMatchObject({ description: "synthetic description" })
    expect(await adapter.resetInviteLink(seed.busy)).toHaveProperty("link")
  })

  it("filters join requests without exposing a different link or accepting a group as a person", async () => {
    const adapter = whatsAppAdapter(fakeEngine(seed))
    expect(await adapter.joinRequests(seed.busy, { limit: 1, search: "requester" })).toMatchObject({
      total: 1,
      hasMore: false,
    })
    expect(await adapter.joinRequests(seed.busy, { limit: 1, search: "absent" })).toMatchObject({ total: 0 })
    await expect(adapter.joinRequests(seed.busy, { limit: 1, link: "synthetic" })).rejects.toMatchObject({
      code: "validation_error",
      details: { reason: "input.field-unsupported", fields: ["link"] },
    })
    await expect(adapter.profile(seed.busy)).rejects.toMatchObject({ code: "validation_error" })
    expect(await adapter.profile(seed.person)).toMatchObject({ id: seed.person })
  })
})
