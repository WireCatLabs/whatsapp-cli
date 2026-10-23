import { describe, expect, it } from "vitest"
import { GraphTransport } from "./graph.js"
import { addressOf, sendMessage } from "./messaging.js"

const now = () => new Date("2026-10-23T12:00:00Z")

describe("a free-form send", () => {
  const calls: string[] = []
  const graph = new GraphTransport({
    token: "EAAtest0000made0up0token",
    version: "v23.0",
    fetch: async (url) => {
      calls.push(url)
      return new Response(JSON.stringify({ messages: [{ id: "wamid.ok" }] }))
    },
  })
  const context = (lastWrote: string | undefined) => ({
    graph,
    phoneNumberId: "100000000000001",
    now,
    lastInbound: async () => (lastWrote ? new Date(lastWrote) : undefined),
  })

  it("is refused before it leaves when the person last wrote more than 24 hours ago", async () => {
    calls.length = 0
    await expect(sendMessage(context("2026-10-22T11:59:00Z"), "70000000001", "late", {})).rejects.toThrow(
      "only a template",
    )
    expect(calls).toEqual([])
  })

  it("goes within the 24 hours, and when nothing of theirs was kept Meta decides", async () => {
    expect((await sendMessage(context("2026-10-22T12:30:00Z"), "70000000001", "in time", {})).id).toBe("wamid.ok")
    expect((await sendMessage(context(undefined), "70000000001", "unknown", {})).id).toBe("wamid.ok")
  })
})

describe("a chat's address", () => {
  it("is `to` for digits and `recipient` for user:<id>, and nothing else", () => {
    expect(addressOf("70000000001")).toEqual({ to: "70000000001" })
    expect(addressOf("user:900000000000009")).toEqual({ recipient: "900000000000009" })
    expect(() => addressOf("Ann")).toThrow("phone number in digits")
  })
})
