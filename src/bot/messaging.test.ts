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

describe("a send with files", () => {
  const sendWith = async (
    files: { kind: string; name: string; asFile?: true }[],
    text: string,
    answers: unknown[] = [],
  ) => {
    const bodies: unknown[] = []
    const graph = new GraphTransport({
      token: "EAAtest0000made0up0token",
      version: "v23.0",
      fetch: async (url, init) => {
        if (url.endsWith("/media")) return new Response(JSON.stringify({ id: "300000000000003" }))
        bodies.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify(answers.shift() ?? { messages: [{ id: `wamid.${bodies.length}` }] }))
      },
    })
    const attachments = files.map((file) => ({
      ...file,
      source: { kind: "bytes" as const, bytes: new Uint8Array([1]) },
    }))
    const sent = await sendMessage({ graph, phoneNumberId: "100000000000001" }, "70000000001", text, {
      attachments,
    } as Parameters<typeof sendMessage>[3])
    return { sent, bodies }
  }

  it("sends a voice note alone and the text before it, since audio carries no caption", async () => {
    const { sent, bodies } = await sendWith([{ kind: "voice", name: "note.ogg" }], "listen")
    expect(bodies).toMatchObject([
      { type: "text", text: { body: "listen" } },
      { type: "audio", audio: { id: "300000000000003" } },
    ])
    expect(sent.id).toBe("wamid.1")
  })

  it("picks the kind by type: a picture, a video, and a document named as sent or asked for", async () => {
    const { bodies } = await sendWith(
      [
        { kind: "photo", name: "wave.webp" },
        { kind: "file", name: "clip.mp4" },
        { kind: "file", name: "terms.pdf" },
        { kind: "file", name: "photo.jpg", asFile: true },
      ],
      "",
    )
    expect(bodies.map((body) => (body as { type: string }).type)).toEqual(["image", "video", "document", "document"])
    expect(bodies[2]).toMatchObject({ document: { filename: "terms.pdf" } })
  })

  it("refuses formatting it cannot send, an empty message, and an answer with no message id", async () => {
    const graph = new GraphTransport({
      token: "EAAtest0000made0up0token",
      version: "v23.0",
      fetch: async () => new Response(JSON.stringify({ messages: [] })),
    })
    const context = { graph, phoneNumberId: "100000000000001" }
    await expect(sendMessage(context, "70000000001", "*hi*", { html: true })).rejects.toThrow("plain text")
    await expect(sendMessage(context, "70000000001", "  ", {})).rejects.toThrow("nothing to send")
    await expect(sendMessage(context, "70000000001", "hi", {})).rejects.toMatchObject({ code: "invalid_response" })
  })
})
