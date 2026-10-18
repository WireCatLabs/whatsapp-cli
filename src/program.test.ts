import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed, mcpOverStdio } from "@wirecat/cli-core/testing"
import { afterAll, describe, expect, it, vi } from "vitest"
import { EngineError, type WhatsAppEngine } from "./engine/contract.js"
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

  it("answers chats events from the store without connecting", async () => {
    const controller = new AbortController()
    await wa(["events", "watch", "--jsonl"], pushedThenStopped(controller), controller.signal)

    const result = await wa(["events", "chats", "events", seed.busy, "--json"], () => {
      throw new Error("chats events must never start the engine")
    })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).items).toEqual([])
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
    return { ...result, sent: engine?.sent ?? [], sends: engine?.sends ?? [] }
  }

  it.each([["--silent"], ["--send-as", seed.person], ["--at-time", "1h"]])(
    "does not offer %s, which WhatsApp cannot honour, and never starts the engine",
    async (...option) => {
      const result = await wa(["options", "messages", "send", seed.dialog, "hi", ...option, "--json"], () => {
        throw new Error("an option WhatsApp lacks must never start the engine")
      })
      expect(result.code).toBe(2)
      expect(result.stderr).toContain(option[0])
    },
  )

  it("writes --md in WhatsApp's own marks", async () => {
    let engine: FakeEngine | undefined
    const markdown = "**Agenda**\n- one _item_\n> [notes](https://example.test/n)"
    const result = await wa(["options", "messages", "send", seed.dialog, markdown, "--md", "--json"], () => {
      engine = fakeEngine(seed)
      return engine
    })
    expect(result.code).toBe(0)
    expect(engine?.sent.map((message) => message.text)).toEqual([
      "*Agenda*\n- one _item_\n> notes (https://example.test/n)",
    ])
  })

  it("sends with --no-preview, since nothing here builds link previews", async () => {
    const result = await sending("--no-preview")
    expect(result.code).toBe(0)
    expect(result.sent).toHaveLength(1)
  })

  it("answers a message the store lacks with --reply-to, by its id alone", async () => {
    // A store of its own: a `watch` elsewhere in this file stores the seed, and the message would then be quoted.
    const env = { ...process.env, MESSAGING_STORE: join(mkdtempSync(join(tmpdir(), "wa-reply-")), "messages.db") }
    const engine = fakeEngine(seed)
    const argv = ["options", "messages", "send", seed.dialog, "hi", "--reply-to", seed.messages[0]?.id ?? "", "--json"]
    const streams = captureStreams()
    expect(await run(argv, { streams, tty: false, env, engine: () => engine })).toBe(0)
    expect(engine.sent[0]?.replyTo).toBe(seed.messages[0]?.id)
    expect(engine.sends[0]?.quoted).toBeUndefined()
  })

  it("repeats a send with --operation-id as the same WhatsApp message", async () => {
    const result = await sending("--operation-id", "3EB0000000000000000001")
    expect(result.code).toBe(0)
    expect(result.sent[0]?.id).toBe("3EB0000000000000000001")
  })

  it("reports a send WhatsApp did not confirm as outcome_unknown, never as sent, and keeps its text out", async () => {
    const marker = "synthetic text 7f3a9c"
    const engine = fakeEngine(seed)
    engine.send = async () => {
      throw new EngineError("outcome_unknown", "WhatsApp did not confirm the message; it may have been sent")
    }
    const result = await wa(["unconfirmed", "messages", "send", seed.dialog, marker, "--json"], () => engine)
    expect(result.code).toBe(14)
    expect(result.stdout).toBe("")
    expect(JSON.parse(result.stderr).error).toMatchObject({
      code: "outcome_unknown",
      details: { operation_id: expect.any(String) },
      retry: { safe: false },
    })
    expect(result.stderr).not.toContain(marker)
  })

  it("checks a send with --dry-run without starting the engine", async () => {
    const result = await wa(["dry", "--dry-run", "messages", "send", seed.dialog, "hi", "--json"], () => {
      throw new Error("--dry-run must never start the engine")
    })
    expect(result.code).toBe(0)
  })

  it("refuses an agent's at_time, silent or anonymous as unknown, and sends nothing", async () => {
    for (const key of ["messages.send", "polls.create"])
      expect((await wa(["agent", "config", "set", `permissions.${key}`, "allow"])).code).toBe(0)
    const engines: FakeEngine[] = []
    const mcp = await mcpOverStdio((streams) =>
      run(["agent", "mcp"], {
        streams: captureStreams(),
        tty: false,
        ...streams,
        engine: () => {
          const engine = fakeEngine(seed)
          engines.push(engine)
          return engine
        },
      }),
    )
    const send = { chat: seed.dialog, text: "hi" }
    const poll = { chat: seed.busy, question: "Pizza?", answers: ["yes", "no"] }
    const refused = [
      await mcp.call("wa_write", { command: "messages send", arguments: { ...send, at_time: "1h" } }),
      await mcp.call("wa_write", { command: "messages send", arguments: { ...send, silent: true } }),
      await mcp.call("wa_write", { command: "polls create", arguments: { ...poll, anonymous: true } }),
    ]
    const sentBefore = engines.flatMap((engine) => engine.sent)
    const allowed = await mcp.call("wa_write", { command: "messages send", arguments: send })
    await mcp.close()

    for (const answer of refused)
      expect(answer.body).toMatchObject({ error: { code: "validation_error", reason: "input.invalid" } })
    expect(sentBefore).toEqual([])
    expect(allowed.isError).toBe(false)
  })
})

describe("reads from the store", () => {
  const filled = async (profile: string) => {
    const controller = new AbortController()
    await wa([profile, "watch", "--jsonl", "--events"], pushedThenStopped(controller), controller.signal)
  }
  const never = vi.fn((): WhatsAppEngine => {
    throw new Error("a read must never start the engine")
  })
  afterAll(() => expect(never).not.toHaveBeenCalled())

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

describe("commands WhatsApp has no counterpart for", () => {
  const message = seed.messages.find((one) => one.chatId === seed.busy)?.id ?? ""
  const card = join(mkdtempSync(join(tmpdir(), "wa-vcard-")), "people.vcf")
  writeFileSync(card, "BEGIN:VCARD\nVERSION:3.0\nFN:Synthetic Person\nTEL:+10000000000\nEND:VCARD\n")
  it.each([
    ["account", "sessions", "list"],
    ["account", "sessions", "end", "--others"],
    ["chats", "inspect", "https://chat.whatsapp.com/FAKE0000000000000000AA"],
    ["chats", "folders", "list"],
    ["chats", "folders", "show", "Work"],
    ["chats", "folders", "create", "Work"],
    ["chats", "folders", "update", "Work", "--title", "Play"],
    ["chats", "folders", "delete", "Work"],
    ["contacts", "add", seed.person],
    ["contacts", "remove", seed.person],
    ["contacts", "rename", seed.person, "Synthetic"],
    ["contacts", "import", card],
  ])("refuses `%s %s` before starting the engine", async (...argv) => {
    const result = await wa(["unsupported", ...argv, "--json"], () => {
      throw new Error("a command WhatsApp lacks must never start the engine")
    })
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr.slice(result.stderr.indexOf("{"))).error.code).toBe("validation_error")
  })

  it("does not offer chats send-as, messages scheduled or replies", async () => {
    const result = await wa(["commands", "--json"])
    interface Listed {
      path: string[]
      commands: Listed[]
    }
    const pathsOf = (commands: Listed[]): string[] =>
      commands.flatMap((command) => [command.path.join(" "), ...pathsOf(command.commands)])
    const paths = pathsOf(JSON.parse(result.stdout).commands)
    expect(paths).toContain("messages send")
    for (const missing of ["chats send-as", "messages scheduled", "replies", "replies add"])
      expect(paths).not.toContain(missing)
  })

  it("keeps linking, unlinking and setup off MCP servers", async () => {
    const result = await wa(["commands", "--json"])
    interface Listed {
      path: string[]
      mcp?: false
      commands: Listed[]
    }
    const flat = (commands: Listed[]): Listed[] => commands.flatMap((command) => [command, ...flat(command.commands)])
    const offMcp = flat(JSON.parse(result.stdout).commands)
      .filter((command) => command.mcp === false)
      .map((command) => command.path.join(" "))
    expect(offMcp).toEqual(expect.arrayContaining(["session", "session start", "session end", "setup"]))
  })

  it.each([
    ["chats", "moderate", seed.busy],
    ["messages", "comments", seed.busy, message],
  ])("refuses `%s %s` as invalid, writes nothing and closes what it started", async (...argv) => {
    let engine: FakeEngine | undefined
    const result = await wa(["unsupported", ...argv, "--json"], () => {
      engine = fakeEngine(seed)
      return engine
    })
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr.slice(result.stderr.indexOf("{"))).error.code).toBe("validation_error")
    expect([...(engine?.sends ?? []), ...(engine?.actions ?? []), ...(engine?.groupActions ?? [])]).toEqual([])
    expect(engine?.closed ?? true).toBe(true)
  })
})
