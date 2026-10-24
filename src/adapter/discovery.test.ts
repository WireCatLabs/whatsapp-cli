import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import { fakeEngine, whatsAppIds } from "../testing/fake-engine.js"
import { whatsAppAdapter } from "./adapter.js"

const seed = contractSeed({ ids: whatsAppIds })

describe("WhatsApp invite and device reads", () => {
  it("previews a group without joining or changing the group", async () => {
    const engine = fakeEngine(seed)
    engine.inspect = async () => ({
      jid: seed.busy,
      kind: "group",
      name: "Synthetic group",
      description: "A preview",
      participants: 42,
      member: null,
      approval: true,
    })
    const preview = await whatsAppAdapter(engine).inspect("https://chat.whatsapp.com/SYNTHETIC")
    expect(preview).toEqual({
      kind: "group",
      title: "Synthetic group",
      id: seed.busy,
      username: null,
      description: "A preview",
      participantsCount: 42,
      member: null,
      approvalNeeded: true,
    })
    expect(engine.groupActions).toEqual([])
    expect(engine.channelActions).toEqual([])
  })

  it("maps a channel preview and preserves unknown membership", async () => {
    const engine = fakeEngine(seed)
    engine.inspect = async () => ({
      jid: "100000000000001@newsletter",
      kind: "newsletter",
      name: "News",
      description: null,
      participants: 12,
      member: null,
      approval: false,
    })
    expect(await whatsAppAdapter(engine).inspect("https://whatsapp.com/channel/SYNTHETIC")).toMatchObject({
      kind: "channel",
      title: "News",
      member: null,
    })
    expect(engine.channelActions).toEqual([])
  })

  it("lists numeric device ids with no invented names or last-active times", async () => {
    const sessions = await whatsAppAdapter(fakeEngine(seed)).sessions()
    expect(sessions).toEqual([
      { current: false, device: "0", client: null, location: null, lastActiveAt: null },
      { current: true, device: "7", client: null, location: null, lastActiveAt: null },
    ])
  })

  it("maps custom Lists without exposing label details or writing them", async () => {
    const engine = fakeEngine(seed)
    engine.folders = async () => [{ id: "5", name: "People", type: 5, chats: [seed.busy] }]
    expect(await whatsAppAdapter(engine).folders()).toEqual([{ id: "5", title: "People", chatIds: [seed.busy] }])
    expect(engine.groupActions).toEqual([])
  })

  it("translates a provider refusal without changing it to an empty preview", async () => {
    await expect(whatsAppAdapter(fakeEngine(seed)).inspect("https://example.invalid/")).rejects.toMatchObject({
      code: "validation_error",
    })
  })
})
