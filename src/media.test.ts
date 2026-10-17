import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import type { Attachment, Message } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"
import { assertPrivate } from "./testing/private-files.js"

const base = contractSeed({ ids: whatsAppIds })
const ref = (media: string, n: number) => ({
  media,
  directPath: `/v/t62/synthetic-${n}`,
  mediaKey: Buffer.alloc(32, n).toString("base64"),
  fileSha256: Buffer.alloc(32, n + 1).toString("base64"),
  fileEncSha256: Buffer.alloc(32, n + 2).toString("base64"),
})
const theirs = (n: number, text: string, attachments: Attachment[]): Message => ({
  id: `3EB0000000000000000E0${n}`,
  chatId: base.busy,
  senderId: base.people[0]?.id ?? null,
  senderName: base.people[0]?.name ?? null,
  timestamp: new Date(Date.UTC(2026, 9, 1, 10, n)).toISOString(),
  editedAt: null,
  text,
  outgoing: false,
  attachments,
  replyTo: null,
  forwardedFrom: null,
  reactions: null,
})
const photo = theirs(1, "synthetic caption", [
  { kind: "photo", width: 640, height: 480, size: 1200, mime: "image/jpeg", providerRef: ref("image", 1) },
])
const voice = theirs(2, "", [
  { kind: "voice", size: 900, mime: "audio/ogg; codecs=opus", duration: 7, providerRef: ref("audio", 2) },
])
const place = theirs(3, "", [{ kind: "location", url: "geo:39.470000,-0.376000", title: "Synthetic Square" }])
const keyless = theirs(4, "", [{ kind: "photo", mime: "image/jpeg" }])
const plain = theirs(5, "synthetic plain text", [])
const seed = { ...base, messages: [...base.messages, photo, voice, place, keyless, plain] }

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    ...(engine ? { engine } : {}),
    ...(signal ? { signal } : {}),
  })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const driving = async (argv: string[]) => {
  let engine: FakeEngine | undefined
  const result = await wa(["media", ...argv, "--json"], () => {
    engine = fakeEngine(seed)
    return engine
  })
  return { ...result, engine: engine as FakeEngine }
}

const failure = (stderr: string) => JSON.parse(stderr.slice(stderr.indexOf("{"))).error
const errorCode = (stderr: string) => failure(stderr).code

const folder = () => mkdtempSync(join(tmpdir(), "wa-media-test-"))

beforeAll(async () => {
  const controller = new AbortController()
  const filling = () => {
    const engine = fakeEngine(seed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => controller.abort())
      return stop
    }
    return engine
  }
  expect((await wa(["media", "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
})

describe("attachments in the store", () => {
  it("lists a message's attachments and keeps the file's keys out of the answer", async () => {
    const result = await wa(["media", "messages", "list", base.busy, "--json"])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('"photo"')
    expect(result.stdout).not.toContain("mediaKey")
    expect(result.stdout).not.toContain("directPath")
  })
})

describe("wa messages send with a file", () => {
  it("sends a photo with the text as its caption", async () => {
    const path = join(folder(), "synthetic.png")
    writeFileSync(path, Buffer.from("synthetic png bytes"))
    const result = await driving(["messages", "send", base.dialog, "synthetic caption", "--photo", path])
    expect(result.code).toBe(0)
    expect(result.engine.uploads).toEqual([{ kind: "photo", name: "synthetic.png", size: 19 }])
    expect(result.engine.sent[0]).toMatchObject({ text: "synthetic caption", attachments: [{ kind: "photo" }] })
    expect(result.stdout).not.toContain("mediaKey")
  })

  it.each([
    ["a video as a video", "clip.mp4", [], "video"],
    ["a video as a file with --as-file", "clip.mp4", ["--as-file"], "document"],
    ["any other file as a document, named as --filename says", "notes.txt", ["--filename", "shown.txt"], "document"],
  ])("sends %s", async (_, name, options, kind) => {
    const path = join(folder(), name)
    writeFileSync(path, "synthetic bytes")
    const result = await driving(["messages", "send", base.dialog, "--file", path, ...options])
    expect(result.code).toBe(0)
    expect(result.engine.uploads[0]?.kind).toBe(kind)
    if (options.includes("--filename")) expect(result.engine.uploads[0]?.name).toBe("shown.txt")
  })

  it("sends a voice note alone", async () => {
    const path = join(folder(), "note.ogg")
    writeFileSync(path, "OggS synthetic")
    const result = await driving(["messages", "send", base.dialog, "--voice", path])
    expect(result.code).toBe(0)
    expect(result.engine.uploads).toEqual([{ kind: "voice", name: "note.ogg", size: 14 }])
  })

  it("refuses a photo and a file together, and sends nothing", async () => {
    const dir = folder()
    writeFileSync(join(dir, "a.png"), "x")
    writeFileSync(join(dir, "b.txt"), "x")
    const result = await driving([
      "messages",
      "send",
      base.dialog,
      "--photo",
      join(dir, "a.png"),
      "--file",
      join(dir, "b.txt"),
    ])
    expect(result.code).toBe(2)
    expect(result.engine.sent).toEqual([])
  })
})

describe("wa messages download", () => {
  it("saves a stored photo through the engine, by the keys the store holds", async () => {
    const output = folder()
    const result = await driving(["messages", "download", base.busy, photo.id, "--output-dir", output])
    expect(result.code).toBe(0)
    expect(result.engine.downloads).toEqual([
      { kind: "photo", width: 640, height: 480, size: 1200, mime: "image/jpeg", ref: ref("image", 1) },
    ])
    const [saved] = readdirSync(output).filter((name) => !name.startsWith("."))
    expect(readFileSync(join(output, saved as string), "utf8")).toBe("synthetic photo bytes")
    expect(readdirSync(tmpdir()).filter((name) => name.startsWith("wa-media-") && !name.includes("test"))).toEqual([])
  })

  it("saves each stored file of a chat with --all through the engine, newest first, and skips what has no keys", async () => {
    const output = folder()
    const result = await driving(["messages", "download", base.busy, "--all", "--pause", "1ms", "--output-dir", output])
    expect(result.code).toBe(0)
    expect(result.engine.downloads.map((attachment) => attachment.ref)).toEqual([ref("audio", 2), ref("image", 1)])
    expect(readdirSync(output).filter((name) => !name.startsWith("."))).toHaveLength(2)
  })

  it("names a place as not a file, and downloads nothing", async () => {
    const result = await driving(["messages", "download", base.busy, place.id, "--output-dir", folder()])
    expect(result.code).toBe(6)
    expect(errorCode(result.stderr)).toBe("not_found")
    expect(result.engine.downloads).toEqual([])
  })

  it("refuses a message the store does not hold", async () => {
    const result = await driving([
      "messages",
      "download",
      base.busy,
      "3EB0000000000000000DEAD",
      "--output-dir",
      folder(),
    ])
    expect(result.code).toBe(6)
    expect(result.engine.downloads).toEqual([])
  })
})

describe("wa messages forward", () => {
  const forwarding = (id: string) => driving(["messages", "forward", base.busy, id, "--to", base.dialog])

  it("sends a stored photo again, with its caption and its keys", async () => {
    const result = await forwarding(photo.id)
    expect(result.code).toBe(0)
    expect(result.engine.forwards).toEqual([
      expect.objectContaining({
        chat: base.dialog,
        text: "synthetic caption",
        attachment: expect.objectContaining({ kind: "photo", ref: ref("image", 1) }),
      }),
    ])
    expect(result.stdout).not.toContain("mediaKey")
  })

  it("sends stored text again", async () => {
    const result = await forwarding(plain.id)
    expect(result.code).toBe(0)
    expect(result.engine.forwards).toEqual([
      expect.objectContaining({ text: "synthetic plain text", attachment: null }),
    ])
  })

  it("forwards with --operation-id as that WhatsApp message id, and a repeat as the same message", async () => {
    let engine: FakeEngine | undefined
    const once = () => {
      engine ??= fakeEngine(seed)
      return engine
    }
    const id = "3EB0000000000000000F0F"
    const argv = ["media", "messages", "forward", base.busy, plain.id, "--to", base.dialog, "--operation-id", id]
    expect((await wa([...argv, "--json"], once)).code).toBe(0)
    expect((await wa([...argv, "--json"], once)).code).toBe(0)
    expect(engine?.forwards).toEqual([expect.objectContaining({ id, chat: base.dialog })])
  })

  it.each(["--silent", "--send-as"])("refuses %s, which WhatsApp has no counterpart for", async (flag) => {
    const value = flag === "--send-as" ? [base.dialog] : []
    const result = await driving(["messages", "forward", base.busy, plain.id, "--to", base.dialog, flag, ...value])
    expect(result.code).toBe(2)
    expect(errorCode(result.stderr)).toBe("validation_error")
    expect(result.engine.forwards).toEqual([])
  })

  it.each([
    ["a file whose keys the store does not hold", keyless.id],
    ["a place, which cannot be rebuilt", place.id],
  ])("refuses %s, and sends nothing", async (_, id) => {
    const result = await forwarding(id)
    expect(result.code).toBe(2)
    expect(errorCode(result.stderr)).toBe("validation_error")
    expect(result.engine.forwards).toEqual([])
  })
})

describe("transcribing a voice note", () => {
  it("asks for a model on this machine, since WhatsApp has no speech recognition", async () => {
    const result = await driving(["messages", "transcribe", base.busy, voice.id])
    expect(errorCode(result.stderr)).toBe("not_found")
    expect(failure(result.stderr).message).toContain("models audio download")
  })

  it("lists the speech models", async () => {
    const result = await wa(["media", "models", "audio", "list", "--json"])
    expect(result.code).toBe(0)
  })
})

describe("a download leaves nothing readable by others", () => {
  it("writes the engine's copy 0600 in a folder only this user can open", async () => {
    let checked = false
    const engine = fakeEngine(seed)
    const download = engine.download
    engine.download = async (attachment, path) => {
      await download(attachment, path)
      assertPrivate(join(path, ".."), 0o700)
      assertPrivate(path, 0o600)
      checked = true
    }
    const result = await wa(
      ["media", "messages", "download", base.busy, voice.id, "--output-dir", folder(), "--json"],
      () => engine,
    )
    expect(result.code).toBe(0)
    expect(checked).toBe(true)
  })
})
