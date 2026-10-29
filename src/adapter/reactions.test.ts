import type { Message } from "@wirecat/cli-core"
import type { StoredMessages } from "@wirecat/cli-core/cli"
import { describe, expect, it } from "vitest"
import { reactionAdapter } from "./reactions.js"

const reactor = (id: string, reaction: string, minute: number) => ({
  person: { id, name: null, username: null },
  reaction,
  reactedAt: `2026-10-29T10:0${minute}:00.000Z`,
})

const held = async () => ({ id: "40" }) as Message

const adapterWith = (rows: ReturnType<typeof reactor>[], message = held) =>
  reactionAdapter({ stored: { reactors: async () => rows } as unknown as StoredMessages, held: message })

const rows = [reactor("1", "🔥", 5), reactor("2", "👍", 4), reactor("3", "🔥", 3)]

describe("reactionAdapter", () => {
  it("lists the stored reactors as they come, newest first", async () => {
    expect(await adapterWith(rows).reactors("120@g.us", "40", { limit: 10 })).toEqual({ items: rows, hasMore: false })
  })

  it("keeps one emoji", async () => {
    const page = await adapterWith(rows).reactors("120@g.us", "40", { limit: 10, emoji: "🔥" })

    expect(page.items.map(({ person }) => person.id)).toEqual(["1", "3"])
  })

  it("pages by cursor until the list ends", async () => {
    const adapter = adapterWith(rows)

    const first = await adapter.reactors("120@g.us", "40", { limit: 2 })
    expect(first).toMatchObject({ hasMore: true, cursor: "2" })
    expect(first.items.map(({ person }) => person.id)).toEqual(["1", "2"])

    const last = await adapter.reactors("120@g.us", "40", { limit: 2, cursor: "2" })
    expect(last).toEqual({ items: [rows[2]], hasMore: false })
  })

  it("refuses a cursor it did not give", async () => {
    await expect(adapterWith(rows).reactors("120@g.us", "40", { limit: 2, cursor: "x" })).rejects.toMatchObject({
      code: "validation_error",
    })
  })

  it("refuses a channel with its reason, before it reads anything", async () => {
    await expect(adapterWith(rows).reactors("1@newsletter", "40", { limit: 2 })).rejects.toMatchObject({
      code: "permission_error",
      details: { reason: "reactions.broadcast" },
    })
  })

  it("refuses a message the store does not hold", async () => {
    const missing = async () => {
      throw Object.assign(new Error("not stored"), { code: "not_found" })
    }

    await expect(adapterWith(rows, missing).reactors("120@g.us", "40", { limit: 2 })).rejects.toMatchObject({
      code: "not_found",
    })
  })
})
