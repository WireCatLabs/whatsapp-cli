import { mkdirSync, mkdtempSync, readdirSync, readFileSync, truncateSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import type { Attachment, Message } from "@wirecat/cli-core"
import { MODELS, modelPath, modelsDirectory, VAD, vadPath } from "@wirecat/cli-core/speech"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import { EngineError, type WhatsAppEngine } from "./engine/contract.js"
import { privateStore } from "./paths.js"
import { run } from "./program.js"
import { type ExpiredFiles, type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"
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
const notes = theirs(6, "", [
  { kind: "document", name: "notes.txt", size: 24, mime: "text/plain", providerRef: ref("document", 6) },
])
const elsewhere: Message = {
  ...theirs(7, "", [
    { kind: "document", name: "minutes.txt", size: 24, mime: "text/plain", providerRef: ref("document", 7) },
  ]),
  chatId: base.dialog,
}
const expiring: Message = {
  ...theirs(12, "", [{ kind: "photo", mime: "image/jpeg", providerRef: ref("image", 12) }]),
  chatId: base.dialog,
  timestamp: new Date(Date.UTC(2026, 8, 1)).toISOString(),
}
const SYNTHETIC_VCARD = "BEGIN:VCARD\nVERSION:3.0\nFN:Ann Lee\nTEL:+00 000 000 0001\nEND:VCARD"
const placed = theirs(10, "", [
  {
    kind: "location",
    url: "geo:39.470000,-0.376000",
    title: "Synthetic Square",
    providerRef: { place: { latitude: 39.47, longitude: -0.376, name: "Synthetic Square" } },
  },
])
const card = theirs(11, "", [
  { kind: "contact", name: "Ann Lee", providerRef: { card: { name: "Ann Lee", vcard: SYNTHETIC_VCARD } } },
])
const seed = {
  ...base,
  messages: [...base.messages, photo, voice, place, keyless, plain, notes, elsewhere, placed, card, expiring],
}

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

// The phone pushes its history again on each link, with each file's path as the phone knows it.
const pushHistory = async (pushed: typeof seed) => {
  const controller = new AbortController()
  const filling = () => {
    const engine = fakeEngine(pushed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => controller.abort())
      return stop
    }
    return engine
  }
  expect((await wa(["media", "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
}

beforeAll(() => pushHistory(seed))

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

  it("refuses a file from wa's own folder, where the device keys live, without --allow-any-file", async () => {
    const path = join(dirname(privateStore("media")), "synthetic-export.txt")
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, "synthetic bytes")
    const refused = await driving(["messages", "send", base.dialog, "--file", path])
    expect(refused.code).toBe(2)
    expect(failure(refused.stderr).message).toContain("--allow-any-file")
    expect(refused.engine?.uploads ?? []).toEqual([])
    const allowed = await driving(["messages", "send", base.dialog, "--file", path, "--allow-any-file"])
    expect(allowed.code).toBe(0)
    expect(allowed.engine.uploads).toEqual([{ kind: "document", name: "synthetic-export.txt", size: 15 }])
  })

  it("sends a photo and a video as one album, the text as the first one's caption", async () => {
    const dir = folder()
    writeFileSync(join(dir, "a.png"), "synthetic png")
    writeFileSync(join(dir, "clip.mp4"), "synthetic mp4 bytes")
    const result = await driving([
      "messages",
      "send",
      base.dialog,
      "synthetic caption",
      "--photo",
      join(dir, "a.png"),
      "--file",
      join(dir, "clip.mp4"),
    ])
    expect(result.code).toBe(0)
    expect(result.engine.uploads).toEqual([
      { kind: "photo", name: "a.png", size: 13 },
      { kind: "video", name: "clip.mp4", size: 19 },
    ])
    const [album] = result.engine.sends
    expect(result.engine.sent).toEqual([
      expect.objectContaining({
        id: album?.id,
        text: "synthetic caption",
        attachments: [expect.objectContaining({ kind: "photo" })],
      }),
    ])
    expect(result.stdout).toContain(album?.id)
    expect(result.stdout).not.toContain("mediaKey")
  })

  it("refuses a photo and a document together, and sends nothing", async () => {
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
    expect(result.engine.downloadKeys).toEqual([
      { chat: base.busy, id: photo.id, fromMe: false, sender: photo.senderId },
    ])
    const [saved] = readdirSync(output).filter((name) => !name.startsWith("."))
    expect(readFileSync(join(output, saved as string), "utf8")).toBe("synthetic photo bytes")
    expect(readdirSync(tmpdir()).filter((name) => name.startsWith("wa-media-") && !name.includes("test"))).toEqual([])
  })

  it("saves each stored file of a chat with --all through the engine, newest first, and skips what has no keys", async () => {
    const output = folder()
    const result = await driving(["messages", "download", base.busy, "--all", "--pause", "1ms", "--output-dir", output])
    expect(result.code).toBe(0)
    expect(result.engine.downloads.map((attachment) => attachment.ref)).toEqual([
      ref("document", 6),
      ref("audio", 2),
      ref("image", 1),
    ])
    expect(readdirSync(output).filter((name) => !name.startsWith("."))).toHaveLength(3)
  })

  it("reads a downloaded document's text into the store with --extract", async () => {
    const result = await driving(["messages", "download", base.busy, notes.id, "--extract", "--output-dir", folder()])
    expect(result.code).toBe(0)
    expect(result.engine.downloads.map((attachment) => attachment.ref)).toEqual([ref("document", 6)])
    expect(JSON.parse(result.stdout).item.extraction).toMatchObject({
      extracted: 1,
      items: [{ name: "notes.txt", status: "extracted" }],
    })
  })

  it("fetches the files no download saved yet through the engine, for attachments extract --download", async () => {
    const engines: FakeEngine[] = []
    const argv = ["media", "attachments", "extract", "--chat", base.dialog, "--download", "--output-dir", folder()]
    const result = await wa([...argv, "--json"], () => {
      const engine = fakeEngine(seed)
      engines.push(engine)
      return engine
    })
    expect(result.code).toBe(0)
    expect(engines.flatMap((engine) => engine.downloads).map((attachment) => attachment.ref)).toContainEqual(
      ref("document", 7),
    )
    expect(engines.every((engine) => engine.closed)).toBe(true)
    const item = JSON.parse(result.stdout).item
    expect(item.not_downloaded).toBe(0)
    expect(item.files).toContainEqual(expect.objectContaining({ name: "minutes.txt", status: "extracted" }))
  })

  it.each([
    ["a place", placed.id],
    ["a contact card", card.id],
  ])("names %s as not a file, and downloads nothing", async (_, id) => {
    const result = await driving(["messages", "download", base.busy, id, "--output-dir", folder()])
    expect(result.code).toBe(6)
    expect(errorCode(result.stderr)).toBe("not_found")
    expect(result.engine.downloads).toEqual([])
  })

  it("names why the phone could not give back a file WhatsApp no longer keeps, by its reason", async () => {
    const engine = fakeEngine(seed)
    engine.download = async () => {
      throw new EngineError("timeout", "synthetic refusal", "media.phone-timeout")
    }
    const result = await wa(
      ["media", "messages", "download", base.busy, photo.id, "--output-dir", folder(), "--json"],
      () => engine,
    )
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item.batch.failures).toEqual([
      expect.objectContaining({ error: expect.objectContaining({ code: "timeout", reason: "media.phone-timeout" }) }),
    ])
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

  it("sends a stored place again, as the store kept it", async () => {
    const result = await forwarding(placed.id)
    expect(result.code).toBe(0)
    expect(result.engine.forwards).toEqual([
      expect.objectContaining({
        text: "",
        attachment: expect.objectContaining({
          kind: "location",
          ref: { place: { latitude: 39.47, longitude: -0.376, name: "Synthetic Square" } },
        }),
      }),
    ])
  })

  it("sends a stored contact card again, and never prints its vCard", async () => {
    const result = await forwarding(card.id)
    expect(result.code).toBe(0)
    expect(result.engine.forwards).toEqual([
      expect.objectContaining({
        attachment: { kind: "contact", name: "Ann Lee", ref: { card: { name: "Ann Lee", vcard: SYNTHETIC_VCARD } } },
      }),
    ])
    expect(result.stdout).toContain("Ann Lee")
    expect(result.stdout + result.stderr).not.toContain("VCARD")
  })

  it("never prints a contact card's vCard or a file's keys, even in the most detailed text view", async () => {
    const result = await wa(["media", "messages", "list", base.busy, "-vv", "--offline"])
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toContain('{"kind":"contact","name":"Ann Lee"}')
    expect(result.stdout).not.toContain("VCARD")
    expect(result.stdout).not.toContain("directPath")
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

  it.each(["--silent", "--send-as"])("does not offer %s, and never starts the engine", async (flag) => {
    const value = flag === "--send-as" ? [base.dialog] : []
    const result = await wa(
      ["media", "messages", "forward", base.busy, plain.id, "--to", base.dialog, flag, ...value, "--json"],
      () => {
        throw new Error("an option WhatsApp lacks must never start the engine")
      },
    )
    expect(result.code).toBe(2)
    expect(result.stderr).toContain(flag)
  })

  it.each([
    ["a file whose keys the store does not hold", keyless.id],
    ["a place stored before wa kept its coordinates", place.id],
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

// A model counts as downloaded when its files have their pinned sizes; sparse files cost no disk.
const withModels = (): NodeJS.ProcessEnv => {
  const state = folder()
  const directory = modelsDirectory({ WIRECAT_STATE_DIR: state })
  for (const model of MODELS)
    for (const [path, bytes] of [
      ...model.files.map((file) => [modelPath(directory, model)(file.name), file.bytes] as const),
      [vadPath(directory), VAD.bytes] as const,
    ]) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, "")
      truncateSync(path, bytes)
    }
  return { ...process.env, WIRECAT_STATE_DIR: state }
}

const tone = readFileSync(new URL("./testing/fixtures/tone.ogg", import.meta.url))

// Each on an account of its own: a transcript is kept for the account, and the next read shows it unasked.
describe("hearing voice notes with a model on this machine", () => {
  // The newest message of a chat waiting for an answer, which inbox and review show.
  const waiting: Message = {
    ...theirs(8, "", [
      { kind: "voice", size: 900, mime: "audio/ogg; codecs=opus", duration: 3, providerRef: ref("audio", 8) },
    ]),
    chatId: base.dialog,
  }
  let n = 0
  let env: NodeJS.ProcessEnv | undefined
  const listener = async () => {
    n += 1
    const profile = `heard${n}`
    const own = {
      ...seed,
      messages: [...seed.messages, waiting],
      account: { id: `1000000000000${60 + n}@lid`, name: "Synthetic owner", username: null },
    }
    const controller = new AbortController()
    const filling = () => {
      const engine = fakeEngine(own)
      const listen = engine.listen
      engine.listen = (kinds, onEvent) => {
        const stop = listen(kinds, onEvent)
        if (kinds.includes("history")) setImmediate(() => controller.abort())
        return stop
      }
      return engine
    }
    expect((await wa([profile, "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
    env ??= withModels()
    const heard: string[] = []
    return async (...argv: string[]) => {
      const streams = captureStreams()
      const engines: FakeEngine[] = []
      const code = await run([profile, ...argv, "--json"], {
        streams,
        tty: false,
        env,
        engine: () => {
          const engine = fakeEngine(own)
          engine.download = async (attachment, path) => {
            engine.downloads.push(attachment)
            writeFileSync(path, tone, { mode: 0o600, flag: "wx" })
            return null
          }
          engines.push(engine)
          return engine
        },
        recognizer: (model) => ({
          recognize: () => {
            heard.push(model.id)
            return "synthetic heard words"
          },
          free: () => {},
        }),
      })
      return {
        code,
        stdout: streams.stdout.join(""),
        stderr: streams.stderr.join(""),
        downloads: engines.flatMap((engine) => engine.downloads.map((attachment) => attachment.ref)),
        closed: engines.every((engine) => engine.closed),
        heard,
      }
    }
  }

  it("downloads the voice note through WhatsApp for messages transcribe --local, and keeps what was heard", async () => {
    const hearing = await listener()
    const first = await hearing("messages", "transcribe", base.busy, voice.id, "--local")
    expect(first.code, first.stderr).toBe(0)
    expect(first.downloads).toEqual([ref("audio", 2)])
    expect(first.closed).toBe(true)
    expect(JSON.parse(first.stdout).item).toMatchObject({ text: "synthetic heard words", via: "local" })
    expect(first.heard).toEqual(["parakeet-v3"])

    const again = await hearing("messages", "transcribe", base.busy, voice.id, "--local")
    expect(again.downloads).toEqual([])
    expect(JSON.parse(again.stdout).item).toMatchObject({ text: "synthetic heard words" })
  })

  it("hears it again with another model named by --model", async () => {
    const hearing = await listener()
    await hearing("messages", "transcribe", base.busy, voice.id, "--local")
    const other = await hearing("messages", "transcribe", base.busy, voice.id, "--model", "gigaam-v3-ctc")
    expect(other.code, other.stderr).toBe(0)
    expect(other.downloads).toEqual([ref("audio", 2)])
    expect(other.heard).toEqual(["parakeet-v3", "gigaam-v3-ctc"])
  })

  it.each([
    ["messages list", ["messages", "list", base.dialog], [8]],
    ["inbox", ["inbox", "--all"], [8]],
    ["review", ["review", "--all", "date>2026-09-30"], [2, 8]],
  ])("downloads and hears the voice notes %s shows with --transcribe --model", async (_, argv, notes) => {
    const hearing = await listener()
    const plain = await hearing(...argv)
    expect(plain.downloads).toEqual([])
    const read = await hearing(...argv, "--transcribe", "--model", "gigaam-v3")
    expect(read.code, read.stderr).toBe(0)
    expect(read.downloads).toEqual(notes.map((note) => ref("audio", note)))
    expect(read.heard).toEqual(notes.map(() => "gigaam-v3"))
    expect(read.closed).toBe(true)
    expect(read.stdout).toContain('"transcript":"synthetic heard words"')
  })
})

describe("a file the phone uploaded again", () => {
  const expired: ExpiredFiles = { paths: new Set([ref("image", 12).directPath]), asked: [] }
  const reuploaded = { ...ref("image", 12), directPath: `${ref("image", 12).directPath}-reuploaded` }
  const engines: FakeEngine[] = []
  const withPhone = (argv: string[]) =>
    wa(["media", ...argv, "--json"], () => {
      const engine = fakeEngine(seed, { expired })
      engines.push(engine)
      return engine
    })

  it("keeps the new copy's path, so a second download does not ask the phone again", async () => {
    const download = ["messages", "download", base.dialog, expiring.id]
    const first = await withPhone([...download, "--output-dir", folder()])
    expect(first.code).toBe(0)
    expect(expired.asked).toEqual([{ chat: base.dialog, id: expiring.id, fromMe: false, sender: expiring.senderId }])
    const second = await withPhone([...download, "--output-dir", folder()])
    expect(second.code).toBe(0)
    expect(expired.asked).toHaveLength(1)
    expect(engines.at(-1)?.downloads.map((attachment) => attachment.ref)).toEqual([reuploaded])
    for (const result of [first, second]) {
      expect(result.stdout).not.toContain("reuploaded")
      expect(result.stdout).not.toContain("mediaKey")
    }
  })

  it("forwards it from the new path", async () => {
    await withPhone(["messages", "download", base.dialog, expiring.id, "--output-dir", folder()])
    const result = await withPhone(["messages", "forward", base.dialog, expiring.id, "--to", base.busy])
    expect(result.code).toBe(0)
    expect(engines.at(-1)?.forwards).toEqual([
      expect.objectContaining({ attachment: expect.objectContaining({ kind: "photo", ref: reuploaded }) }),
    ])
    expect(result.stdout).not.toContain("reuploaded")
  })
})

describe("a history push after the phone uploaded a file again", () => {
  const relinked: Message = {
    ...theirs(13, "", [{ kind: "photo", mime: "image/jpeg", providerRef: ref("image", 13) }]),
    chatId: base.dialog,
  }
  const fresh: Message = {
    ...theirs(14, "", [{ kind: "photo", mime: "image/jpeg", providerRef: ref("image", 14) }]),
    chatId: base.dialog,
  }
  const expired: ExpiredFiles = { paths: new Set([ref("image", 13).directPath]), asked: [] }
  const before = { ...seed, messages: [...seed.messages, relinked] }
  const after = { ...seed, messages: [...seed.messages, relinked, fresh] }
  const downloading = async (pushed: typeof seed, message: Message) => {
    let engine: FakeEngine | undefined
    const result = await wa(
      ["media", "messages", "download", message.chatId, message.id, "--output-dir", folder(), "--json"],
      () => {
        engine = fakeEngine(pushed, { expired })
        return engine
      },
    )
    expect(result.code).toBe(0)
    return engine as FakeEngine
  }

  it("keeps the new path, and takes the path of a message the store did not hold", async () => {
    await pushHistory(before)
    await downloading(before, relinked)
    expect(expired.asked).toHaveLength(1)

    await pushHistory(after)
    const again = await downloading(after, relinked)
    expect(expired.asked).toHaveLength(1)
    expect(again.downloads.map((attachment) => attachment.ref)).toEqual([
      { ...ref("image", 13), directPath: `${ref("image", 13).directPath}-reuploaded` },
    ])
    const added = await downloading(after, fresh)
    expect(added.downloads.map((attachment) => attachment.ref)).toEqual([ref("image", 14)])
  })

  it("takes the pushed path of another file in the same place", async () => {
    const carrying = (n: number): Message => ({
      ...theirs(15, "", [{ kind: "photo", mime: "image/jpeg", providerRef: ref("image", n) }]),
      chatId: base.dialog,
    })
    await pushHistory({ ...seed, messages: [...seed.messages, carrying(15)] })
    const pushed = { ...seed, messages: [...seed.messages, carrying(16)] }
    await pushHistory(pushed)
    const engine = await downloading(pushed, carrying(16))
    expect(engine.downloads.map((attachment) => attachment.ref)).toEqual([ref("image", 16)])
  })
})

describe("a download leaves nothing readable by others", () => {
  it("writes the engine's copy 0600 in a folder only this user can open", async () => {
    let checked = false
    const engine = fakeEngine(seed)
    const download = engine.download
    engine.download = async (attachment, path, key) => {
      const answer = await download(attachment, path, key)
      assertPrivate(join(path, ".."), 0o700)
      assertPrivate(path, 0o600)
      checked = true
      return answer
    }
    const result = await wa(
      ["media", "messages", "download", base.busy, voice.id, "--output-dir", folder(), "--json"],
      () => engine,
    )
    expect(result.code).toBe(0)
    expect(checked).toBe(true)
  })
})
