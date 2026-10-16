import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })

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

/** An engine that stops the command once it has handed over its history, as Ctrl+C would. */
const pushedThenStopped = (controller: AbortController) => (): FakeEngine => {
  const engine = fakeEngine(seed)
  const listen = engine.listen
  engine.listen = (kinds, onEvent) => {
    const stop = listen(kinds, onEvent)
    if (kinds.includes("history")) setImmediate(() => controller.abort())
    return stop
  }
  return engine
}

describe("wa", () => {
  it("prints its version", async () => {
    const result = await wa(["--version"])
    expect(result).toMatchObject({ code: 0, stdout: "0.1.0" })
  })

  it("refuses a read before anything was recorded, and says how to fill the store", async () => {
    const result = await wa(["readsempty", "chats", "list", "--json"], () => {
      throw new Error("a read must never start the engine")
    })
    expect(result.code).toBe(6)
    expect(result.stdout).toBe("")
    expect(JSON.parse(result.stderr).error.code).toBe("not_found")
  })

  it("keeps what the phone pushes, and answers reads from it without connecting", async () => {
    const controller = new AbortController()
    const watched = await wa(["pushed", "watch", "--jsonl"], pushedThenStopped(controller), controller.signal)
    expect(watched.code).toBe(0)

    const listed = await wa(["pushed", "chats", "list", "--json"], () => {
      throw new Error("a read must never start the engine")
    })
    expect(listed.code).toBe(0)
    const titles = JSON.parse(listed.stdout).items.map((chat: { title: string }) => chat.title)
    expect(titles).toEqual(expect.arrayContaining(["Book club", "Ann Lee"]))
  })

  it("sends through the engine with the send id as WhatsApp's message id", async () => {
    let engine: FakeEngine | undefined
    const result = await wa(["sender", "messages", "send", seed.dialog, "see you there", "--json"], () => {
      engine = fakeEngine(seed)
      return engine
    })
    expect(result.code).toBe(0)
    expect(engine?.sent.map((message) => message.text)).toEqual(["see you there"])
    expect(engine?.sent[0]?.id).toMatch(/^3EB0[0-9A-F]{18}$/)
    expect(engine?.closed).toBe(true)
  })

  it("refuses a send without a linked device, naming the login command", async () => {
    const result = await wa(["unlinked", "messages", "send", seed.dialog, "hi", "--json"])
    expect(result.code).toBe(4)
    expect(JSON.parse(result.stderr).error.message).toContain("wa unlinked session start")
  })
})

describe("wa messages send", () => {
  const sending = async (...options: string[]) => {
    let engine: FakeEngine | undefined
    const result = await wa(["options", "messages", "send", seed.dialog, "hi", ...options, "--json"], () => {
      engine = fakeEngine(seed)
      return engine
    })
    return { ...result, sent: engine?.sent ?? [] }
  }

  it.each([["--silent"], ["--send-as", seed.person], ["--at-time", "1h"], ["--md"]])(
    "refuses %s, which WhatsApp cannot honour, and sends nothing",
    async (...option) => {
      const result = await sending(...option)
      expect(result.code).toBe(2)
      expect(JSON.parse(result.stderr).error.code).toBe("validation_error")
      expect(result.sent).toEqual([])
    },
  )

  it.each([["--file"], ["--photo"], ["--voice"], ["--as-file", "--file"], ["--allow-any-file", "--file"]])(
    "refuses an attachment (%s) until media sending exists, and sends nothing",
    async (...option) => {
      const result = await sending(...option, "package.json")
      expect(result.code).toBe(2)
      expect(result.sent).toEqual([])
    },
  )

  it("sends with --no-preview, since nothing here builds link previews", async () => {
    const result = await sending("--no-preview")
    expect(result.code).toBe(0)
    expect(result.sent).toHaveLength(1)
  })

  it("answers a message with --reply-to", async () => {
    const result = await sending("--reply-to", seed.messages[0]?.id ?? "")
    expect(result.code).toBe(0)
    expect(result.sent[0]?.replyTo).toBe(seed.messages[0]?.id)
  })

  it("repeats a send with --operation-id as the same WhatsApp message", async () => {
    const result = await sending("--operation-id", "3EB0000000000000000001")
    expect(result.code).toBe(0)
    expect(result.sent[0]?.id).toBe("3EB0000000000000000001")
  })

  it("checks a send with --dry-run without starting the engine", async () => {
    const result = await wa(["dry", "--dry-run", "messages", "send", seed.dialog, "hi", "--json"], () => {
      throw new Error("--dry-run must never start the engine")
    })
    expect(result.code).toBe(0)
  })
})

describe("reads from the store", () => {
  const filled = async (profile: string) => {
    const controller = new AbortController()
    await wa([profile, "watch", "--jsonl", "--events"], pushedThenStopped(controller), controller.signal)
  }
  const never = () => {
    throw new Error("a read must never start the engine")
  }

  it("pages chats with --limit and --page, and lists them all with --all", async () => {
    await filled("paging")
    const first = JSON.parse((await wa(["paging", "chats", "list", "--limit", "2", "--json"], never)).stdout)
    const second = JSON.parse(
      (await wa(["paging", "chats", "list", "--limit", "2", "--page", "2", "--json"], never)).stdout,
    )
    const all = JSON.parse((await wa(["paging", "chats", "list", "--all", "--json"], never)).stdout)
    expect(first.items).toHaveLength(2)
    expect(second.items.map((chat: { id: string }) => chat.id)).not.toEqual(
      first.items.map((chat: { id: string }) => chat.id),
    )
    expect(all.items.length).toBe(seed.chats.length)
  })

  it("answers --offline from the store", async () => {
    await filled("offline")
    const result = await wa(["offline", "--offline", "chats", "list", "--json"], never)
    expect(result.code).toBe(0)
  })
})
