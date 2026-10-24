import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { startGoEngine } from "./go-engine.js"

const STUB = fileURLToPath(new URL("../testing/engine-stub.mjs", import.meta.url))
const GROUP = "120363000000000001@g.us"
const INVITE = "https://chat.whatsapp.com/TRANSPORT"

const stub = (mode = "ok") =>
  startGoEngine({
    storePath: "/nowhere/private.db",
    holder: "transport test",
    warn: () => {},
    command: { file: process.execPath, args: [STUB, "--mode", mode] },
  })

describe("discovery over the engine transport", () => {
  it("passes invite and chat fields and decodes previews, device ids, Lists and announcement eligibility", async () => {
    const engine = await stub()
    try {
      expect(await engine.inspect(INVITE)).toMatchObject({
        jid: GROUP,
        kind: "group",
        participants: 42,
        member: null,
        approval: true,
      })
      expect(await engine.devices()).toEqual([
        { id: 0, current: false },
        { id: 7, current: true },
      ])
      expect(await engine.folders()).toEqual([{ id: "5", name: "Synthetic list", type: 5, chats: [GROUP] }])
      expect(await engine.commentGroup(GROUP)).toBe(true)
      await expect(engine.commentGroup("100000000000001@newsletter")).rejects.toMatchObject({
        code: "validation_error",
      })
    } finally {
      await engine.close()
    }
  })

  it.each(["inspect", "devices", "folders", "commentGroup"] as const)(
    "rejects a malformed %s answer",
    async (method) => {
      const engine = await stub("malformed-discovery")
      try {
        const answer =
          method === "inspect"
            ? engine.inspect(INVITE)
            : method === "commentGroup"
              ? engine.commentGroup(GROUP)
              : engine[method]()
        await expect(answer).rejects.toThrow()
      } finally {
        await engine.close()
      }
    },
  )

  it("reports an interrupted read as an unavailable engine", async () => {
    const engine = await stub("discovery-dies")
    try {
      await expect(engine.devices()).rejects.toMatchObject({ code: "provider_unavailable", reason: "engine.stopped" })
    } finally {
      await engine.close()
    }
  })

  it("preserves explicit contact fields, leaves omitted options unset, and treats an interrupted save as uncertain", async () => {
    const engine = await stub()
    try {
      await expect(engine.saveContact("70000000002@s.whatsapp.net", "Synthetic Default")).resolves.toBeUndefined()
      await expect(
        engine.saveContact("70000000002@s.whatsapp.net", "Synthetic Person", {
          firstName: "Synthetic",
          phonebook: false,
        }),
      ).resolves.toBeUndefined()
      await expect(engine.saveContact("70000000002@s.whatsapp.net", "crash before the answer")).rejects.toMatchObject({
        code: "outcome_unknown",
        reason: "engine.stopped-mid-write",
      })
    } finally {
      await engine.close()
    }
  })
})
