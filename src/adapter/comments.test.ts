import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it, vi } from "vitest"
import { fakeEngine, whatsAppIds } from "../testing/fake-engine.js"
import { commentAdapter } from "./comments.js"
import { toMessage } from "./map.js"

const seed = contractSeed({ ids: whatsAppIds })
const stored = {
  message: async () => undefined,
  newestIncoming: async () => undefined,
  anchor: async () => undefined,
  wroteTo: async () => false,
  pollVotes: async () => [],
}
const translated = <T>(work: Promise<T>): Promise<T> => work

describe("stored community comments", () => {
  it("maps the decrypted parent to a thread and pages the shared store", async () => {
    const original = seed.messages[0]
    if (!original) throw new Error("missing synthetic message")
    const engine = fakeEngine(seed)
    engine.commentGroup = async () => true
    const threadMessages = vi.fn(async () => ({ items: [original], hasMore: true }))
    const adapter = commentAdapter(engine, { ...stored, threadMessages }, translated)
    expect(await adapter.discussionOf(seed.busy, "POST")).toEqual({ chatId: seed.busy, messageId: "POST" })
    expect(await adapter.comments(seed.busy, "POST", { limit: 1, before: "NEXT" })).toEqual({
      items: [original],
      hasMore: true,
    })
    expect(threadMessages).toHaveBeenCalledWith(seed.busy, "POST", { limit: 1, before: "NEXT" })
    expect(
      toMessage({
        id: "COMMENT",
        chat: seed.busy,
        sender: seed.person,
        senderName: null,
        fromMe: false,
        timestamp: "2026-09-01T10:00:00.000Z",
        editedAt: null,
        text: "synthetic",
        replyTo: "POST",
        thread: "POST",
      }),
    ).toMatchObject({ id: "COMMENT", replyToId: "POST", threadId: "POST" })
    expect(engine.sent).toEqual([])
  })

  it("refuses an old core that cannot read threads instead of claiming an empty discussion", async () => {
    const engine = fakeEngine(seed)
    engine.commentGroup = async () => true
    const adapter = commentAdapter(engine, stored, translated)
    await expect(adapter.comments(seed.busy, "POST", { limit: 1 })).rejects.toMatchObject({
      code: "provider_unavailable",
    })
  })
})
