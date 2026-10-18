import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { engineBinary, enginePackage } from "../engine-binary.js"
import { assertPrivate } from "../testing/private-files.js"
import type { EngineEvent, LoginCode, WaAttachment } from "./contract.js"
import { startGoEngine } from "./go-engine.js"

const STUB = fileURLToPath(new URL("../testing/engine-stub.mjs", import.meta.url))

const stub = (mode: string, warnings: string[] = []) =>
  startGoEngine({
    storePath: "/nowhere/private.db",
    holder: "serve",
    warn: (line) => warnings.push(line),
    command: { file: process.execPath, args: [STUB, "--mode", mode] },
  })

describe("startGoEngine", () => {
  it("reads the account from the hello, answers requests and passes the engine's stderr on as warnings", async () => {
    const warnings: string[] = []
    const engine = await stub("ok", warnings)
    expect(engine.self()).toBe("100000000000001@lid")
    expect(await engine.me()).toEqual({ jid: "100000000000001@lid", name: "Owner" })
    const sent = await engine.send({ chat: "100000000000002@lid", text: "hi", id: "3EB0AA" })
    expect(sent).toMatchObject({ id: "3EB0AA", fromMe: true, text: "hi" })
    await engine.close()
    expect(warnings).toContain("stub engine diagnostic")
  })

  it("addresses an edit and a reaction by the stored message's key", async () => {
    const engine = await stub("ok")
    const key = { chat: "120363000000000001@g.us", id: "3EB0AA", fromMe: true, sender: null }
    expect(await engine.edit(key, "fixed")).toMatchObject({ id: "3EB0AA", chat: key.chat, text: "fixed" })
    await expect(engine.react(key, null)).resolves.toBeUndefined()
    await engine.close()
  })

  it("pins and unpins by the stored message's key", async () => {
    const engine = await stub("ok")
    const key = { chat: "120363000000000001@g.us", id: "3EB0AA", fromMe: false, sender: "100000000000002@lid" }
    await expect(engine.pin(key)).resolves.toBeUndefined()
    await expect(engine.unpin(key)).resolves.toBeUndefined()
    await engine.close()
  })

  it("sends a file, forwards a stored one and writes a download where the CLI asked", async () => {
    const engine = await stub("ok")
    const sent = await engine.sendMedia({
      chat: "100000000000002@lid",
      text: "caption",
      id: "3EB0AB",
      file: { kind: "photo", path: "/nowhere/synthetic.png", name: "synthetic.png" },
    })
    const attachment = sent.attachments?.[0] as WaAttachment
    expect(attachment).toMatchObject({ kind: "photo", ref: { directPath: "/v/stub" } })
    const copy = await engine.forward({ chat: "100000000000003@lid", id: "3EB0AC", text: "", attachment })
    expect(copy.attachments).toEqual([attachment])
    const path = join(mkdtempSync(join(tmpdir(), "wa-stub-")), "file")
    await engine.download(attachment, path)
    expect(readFileSync(path, "utf8")).toBe("synthetic photo bytes")
    assertPrivate(path, 0o600)
    await engine.close()
  })

  it("asks for older history by the anchor's key, time and count, and reads the phone's answer", async () => {
    const engine = await stub("ok")
    const anchor = {
      chat: "120363000000000001@g.us",
      id: "3EB0AA",
      fromMe: true,
      sender: null,
      timestamp: "2026-09-01T00:00:00.000Z",
    }
    expect(await engine.older(anchor, 50)).toEqual({
      messages: [
        expect.objectContaining({ id: "3EB0OLDER50M", chat: anchor.chat, timestamp: "2026-08-31T23:59:59.000Z" }),
      ],
      more: true,
    })
    await expect(engine.older({ ...anchor, chat: "offline@stub" }, 50)).rejects.toMatchObject({ code: "timeout" })
    await engine.close()
  })

  it("reads the group and people answers the Go engine writes", async () => {
    const engine = await stub("ok")
    expect(await engine.group("120363000000000001@g.us", { withLink: true })).toMatchObject({
      addMode: "admin_add",
      members: [{ role: "owner" }],
    })
    expect(await engine.joinRequests("120363000000000001@g.us")).toHaveLength(2)
    expect(await engine.profile("100000000000002@lid")).toMatchObject({ about: "synthetic about", photo: null })
    expect(await engine.participants("120363000000000001@g.us", "add", ["100000000000002@lid"])).toEqual({
      notAdded: [],
    })
    await engine.close()
  })

  it("hands the connection event to a listener and resolves ready once connected", async () => {
    const engine = await stub("ok")
    const events: EngineEvent[] = []
    engine.listen(["connection"], (event) => events.push(event))
    await engine.ready(new AbortController().signal)
    expect(events).toEqual([{ event: "connection", state: "connected" }])
    await engine.close()
  })

  it("turns an engine refusal into an EngineError with its code", async () => {
    const engine = await stub("ok")
    await expect(engine.chat("100000000000002@lid")).rejects.toMatchObject({ code: "not_found" })
    await engine.close()
  })

  it("rejects at start when the lock is held, naming the holder", async () => {
    await expect(stub("refuse")).rejects.toMatchObject({
      code: "provider_unavailable",
      message: expect.stringContaining("serve"),
    })
  })

  it("refuses an engine that speaks another protocol", async () => {
    await expect(stub("old")).rejects.toMatchObject({ message: expect.stringContaining("protocol 1") })
  })

  it("shows the login code and takes the linked account as self", async () => {
    const engine = await stub("unlinked")
    expect(engine.self()).toBeNull()
    const codes: LoginCode[] = []
    await engine.link({ method: "phone", phone: "+7 000" }, (code) => codes.push(code))
    expect(codes).toEqual([{ login: "pair", code: "ABCD-EFGH" }])
    expect(engine.self()).toBe("100000000000001@lid")
    await engine.close()
  })

  it("skips an event that breaks the contract, with a warning, and goes on", async () => {
    const warnings: string[] = []
    const engine = await stub("ok", warnings)
    const heard: EngineEvent[] = []
    engine.listen(["message"], (event) => heard.push(event))
    await expect(engine.send({ chat: "x@lid", text: "garbled", id: "1" })).resolves.toMatchObject({ id: "1" })
    await engine.close()
    expect(heard).toEqual([])
    expect(warnings.some((line) => line.includes("cannot read"))).toBe(true)
  })

  it("ends listeners with a stopped connection when the engine dies, and refuses later requests", async () => {
    const engine = await stub("ok")
    const stopped = new Promise<EngineEvent>((resolve) => engine.listen(["connection"], resolve))
    await expect(engine.chat("crash@stub")).rejects.toMatchObject({
      code: "provider_unavailable",
      reason: "engine.stopped",
    })
    expect(await stopped).toEqual({ event: "connection", state: "stopped" })
    await expect(engine.me()).rejects.toMatchObject({ code: "provider_unavailable" })
  })

  it("says how to get the engine when the binary is missing", async () => {
    await expect(
      startGoEngine({ storePath: "/x", holder: "serve", command: { file: "/no/such/wa-engine", args: [] } }),
    ).rejects.toMatchObject({ message: expect.stringContaining(`${enginePackage()} is missing`) })
  })

  it("runs WA_ENGINE over an installed engine package, and a checkout's own build without either", () => {
    expect(engineBinary({ WA_ENGINE: "/opt/wa-engine" })).toBe("/opt/wa-engine")
    expect(engineBinary({})).toBe(
      fileURLToPath(
        new URL(`../../engine/bin/wa-engine${process.platform === "win32" ? ".exe" : ""}`, import.meta.url),
      ),
    )
    expect(enginePackage("win32", "arm64")).toBe("@wirecat/whatsapp-engine-win32-arm64")
  })
})

// Full validation builds the engine and sets WA_ENGINE_TESTS=required, so a missing binary fails there, not skips.
const noEngine = !existsSync(engineBinary()) && process.env.WA_ENGINE_TESTS !== "required"

describe.skipIf(noEngine)("the built Go engine", () => {
  const storePath = () => join(mkdtempSync(join(tmpdir(), "wa-engine-")), "private.db")

  it("refuses a profile that has no device, unless linking", async () => {
    await expect(startGoEngine({ storePath: storePath(), holder: "serve" })).rejects.toMatchObject({
      code: "authentication_error",
    })
    const linking = await startGoEngine({ storePath: storePath(), holder: "session start", link: true })
    expect(linking.self()).toBeNull()
    expect(await linking.directory()).toEqual([])
    await linking.close()
  })

  it("lets one process hold a device and tells the second who holds it", async () => {
    const path = storePath()
    const first = await startGoEngine({ storePath: path, holder: "serve", link: true })
    await expect(startGoEngine({ storePath: path, holder: "messages send", link: true })).rejects.toMatchObject({
      code: "provider_unavailable",
      message: expect.stringContaining("serve (pid"),
    })
    await first.close()
  })
})

describe("privacy wire contracts", () => {
  it("validates the privacy answer the Go engine writes, for a read and a change", async () => {
    const engine = await stub("ok")
    try {
      const written = {
        groupadd: "contacts",
        last: "none",
        online: "match_last_seen",
        calladd: "known",
        profile: "contact_blacklist",
        status: "",
        readreceipts: "none",
      }
      expect(await engine.privacy()).toEqual(written)
      expect(await engine.setPrivacy([{ name: "calladd", value: "known" }])).toEqual(written)
    } finally {
      await engine.close()
    }
  })
})

describe("group wire contracts", () => {
  it("validates group, request and profile answers from the real JSON-lines client", async () => {
    const engine = await stub("ok")
    try {
      const group = await engine.group("120363000000000001@g.us", { withLink: true })
      expect(group.members[0]).toMatchObject({ role: "owner" })
      expect(await engine.joinRequests(group.chat.jid)).toHaveLength(2)
      expect(await engine.profile("100000000000002@lid")).toMatchObject({ contact: true, photo: null })
      expect(await engine.participants(group.chat.jid, "remove", ["100000000000002@lid"])).toEqual({ notAdded: [] })
      await expect(engine.block("100000000000002@lid", true)).rejects.toMatchObject({ code: "validation_error" })
      await expect(engine.answerJoinRequest(group.chat.jid, "100000000000002@lid", false)).rejects.toMatchObject({
        code: "validation_error",
      })
      await expect(engine.leave(group.chat.jid)).rejects.toMatchObject({ code: "validation_error" })
      await expect(engine.lookup("+70000000001")).rejects.toMatchObject({ code: "validation_error" })
      await expect(engine.contacts()).rejects.toMatchObject({ code: "validation_error" })
      await expect(engine.createGroup("synthetic", [])).rejects.toMatchObject({ code: "validation_error" })
      await expect(engine.join("synthetic")).rejects.toMatchObject({ code: "validation_error" })
      await expect(engine.updateGroup(group.chat.jid, { approval: true })).rejects.toMatchObject({
        code: "validation_error",
      })
      await expect(engine.resetInviteLink(group.chat.jid)).rejects.toMatchObject({ code: "validation_error" })
    } finally {
      await engine.close()
    }
  })
})
