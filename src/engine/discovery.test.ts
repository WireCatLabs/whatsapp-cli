import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
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

  it("answers whether a number is the linked account's with its last four digits only", async () => {
    const engine = await stub()
    try {
      await expect(engine.ownNumber("70000000001")).resolves.toEqual({ matches: true, ends: "0001" })
      await expect(engine.ownNumber("34600000001")).resolves.toEqual({ matches: false, ends: "0001" })
    } finally {
      await engine.close()
    }
  })

  it("names the account's own contact entry by the chosen key and the name only, for bin/fix-own-contact-name", async () => {
    const engine = await stub()
    try {
      await expect(engine.saveOwnContact("pn", "Synthetic Own")).resolves.toEqual({ readBack: "yes" })
      await expect(engine.saveOwnContact("lid", "Synthetic Own")).resolves.toEqual({ readBack: "yes" })
      await expect(engine.saveOwnContact("lid_contact", "Synthetic Own")).resolves.toEqual({ readBack: "unchecked" })
    } finally {
      await engine.close()
    }
  })

  it("leaves the own-contact write out of every command: only the engine bindings and fakes name it", () => {
    const src = fileURLToPath(new URL("..", import.meta.url))
    const naming = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(ts|mjs)$/.test(file) && !/\.test\.ts$/.test(file))
      .filter((file) => readFileSync(join(src, file), "utf8").includes("saveOwnContact"))
      .map((file) => file.replaceAll("\\", "/"))
      .sort()
    expect(naming).toEqual([
      "engine/contract.ts",
      "engine/discovery.ts",
      "testing/engine-stub.mjs",
      "testing/fake-engine.ts",
    ])
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
