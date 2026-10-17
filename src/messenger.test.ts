import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { captureStreams } from "@wirecat/cli-base"
import { repliesPathFor } from "@wirecat/cli-core/cli"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it, vi } from "vitest"
import { whatsAppAdapter } from "./adapter/adapter.js"
import { WA } from "./app.js"
import { type Environment, WHATSAPP } from "./messenger.js"
import { privateStore } from "./paths.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const STUB = fileURLToPath(new URL("./testing/engine-stub.mjs", import.meta.url))

const wa = async (argv: string[], environment: Environment = {}) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, ...environment })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const linked = (profile: string) => {
  const store = privateStore(profile)
  mkdirSync(dirname(store), { recursive: true })
  writeFileSync(store, "")
}

const stub = (mode: string): Environment => ({
  engineCommand: { file: process.execPath, args: [STUB, "--mode", mode] },
})

describe("connecting to WhatsApp", () => {
  it("starts the engine for a linked profile and sends through it", async () => {
    linked("gostub")
    const result = await wa(["gostub", "messages", "send", "100000000000002@lid", "hello", "--json"], stub("ok"))
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item.message).toMatchObject({
      text: "hello",
      outgoing: true,
      provider: "whatsapp",
    })
  })

  it("refuses while another command holds the device, naming it", async () => {
    linked("held")
    const result = await wa(["held", "messages", "send", "100000000000002@lid", "hi", "--json"], stub("refuse"))
    expect(result.code).not.toBe(0)
    expect(JSON.parse(result.stderr).error).toMatchObject({
      code: "provider_unavailable",
      message: expect.stringContaining("messages send"),
      reason: "device.in-use",
    })
  })

  it("answers a send the engine died during as outcome_unknown, never as a stopped engine to retry", async () => {
    linked("crashed")
    const result = await wa(
      ["crashed", "messages", "send", "100000000000002@lid", "crash before the answer", "--json"],
      stub("ok"),
    )
    expect(result.code).toBe(14)
    expect(JSON.parse(result.stderr.slice(result.stderr.indexOf("{"))).error).toMatchObject({
      code: "outcome_unknown",
      reason: "engine.stopped-mid-write",
      details: { operation_id: expect.any(String) },
      retry: { safe: false },
    })
    expect(result.stderr).not.toContain("crash before the answer")
  })

  it("says how to log in when the engine finds no device in the store", async () => {
    linked("emptied")
    const result = await wa(
      ["emptied", "messages", "send", "100000000000002@lid", "hi", "--json"],
      stub("unlinked-store"),
    )
    expect(result.code).toBe(4)
    expect(JSON.parse(result.stderr).error.message).toContain("wa emptied session start")
  })

  it("refuses a write when the engine has no account, and stops the engine", async () => {
    const engine = fakeEngine(seed, { linked: false })
    const result = await wa(["noaccount", "messages", "send", seed.dialog, "hi", "--json"], { engine: () => engine })
    expect(result.code).toBe(4)
    expect(JSON.parse(result.stderr).error.message).toContain("session start")
    expect(engine.closed).toBe(true)
  })

  it("names the command to look a chat up with, profile first", async () => {
    const result = await wa(["named", "messages", "send", "Nobody By This Name", "hi", "--json"], {
      engine: () => fakeEngine(seed),
    })
    expect(result.code).not.toBe(0)
    expect(JSON.parse(result.stderr).error.message).toContain("`wa named chats list`")
  })
})

describe("wa doctor", () => {
  const CHECKOUT = "/home/a/Projects/whatsapp-cli/dist/x.js"
  const doctor = async (profile: string, env: NodeJS.ProcessEnv, scriptPath = CHECKOUT) => {
    const engine = vi.fn(() => {
      throw new Error("doctor must never start the engine")
    })
    const result = await wa([profile, "doctor", "--json"], {
      env: { ...process.env, ...env },
      update: { scriptPath },
      engine,
    })
    expect(result.code).toBe(0)
    expect(engine).not.toHaveBeenCalled()
    return JSON.parse(result.stdout).item.whatsapp
  }

  it("says the engine is missing and how to get it, for a checkout and for an install", async () => {
    const env = { WA_ENGINE: `${process.env.TMPDIR}/no-such-engine` }
    expect((await doctor("noengine", env)).engine).toMatchObject({
      found: false,
      hint: expect.stringContaining("pnpm engine:build"),
    })
    const installed = await doctor("noengine", env, "/home/a/.npm-global/lib/node_modules/@wirecat/whatsapp-cli/x.js")
    expect(installed.engine.hint).toContain("WA_ENGINE")
  })

  it("finds the engine, checks the device keys' modes without opening them, and names the lock's holder", async () => {
    const binary = `${process.env.TMPDIR}/wa-engine-found`
    writeFileSync(binary, "", { mode: 0o755 })
    const store = privateStore("checked")
    mkdirSync(dirname(store), { recursive: true, mode: 0o700 })
    writeFileSync(store, "not a database", { mode: 0o644 })
    writeFileSync(`${store}.lock`, `serve (pid ${process.pid})\n`)

    const report = await doctor("checked", { WA_ENGINE: binary })
    expect(report.engine).toMatchObject({ found: true })
    expect(report.device.exists).toBe(true)
    if (process.platform === "win32") {
      expect(report.device.files).toMatchObject({ checked: false, reason: "Windows has no Unix file modes" })
    } else {
      expect(report.device.files).toMatchObject({ checked: true, ok: false })
      expect(report.device.files.problems).toEqual([
        expect.objectContaining({ path: store, mode: "0644", want: "0600" }),
      ])
    }
    expect(report.lock).toEqual({
      path: `${store}.lock`,
      holder: `serve (pid ${process.pid})`,
      pid: process.pid,
      running: true,
    })
    expect(JSON.stringify(report)).not.toContain("not a database")
  })

  it("does not count a holder whose process has ended as holding the lock", async () => {
    const store = privateStore("stale")
    mkdirSync(dirname(store), { recursive: true })
    writeFileSync(`${store}.lock`, "messages send (pid 2147483646)\n")
    expect((await doctor("stale", {})).lock).toMatchObject({ pid: 2147483646, running: false })
    expect((await doctor("unlinked", {})).lock).toMatchObject({ holder: null, running: false })
  })
})

describe("what WhatsApp lacks", () => {
  // cli-core's COMMAND_NEEDS: a method here that the adapter has would refuse a command that works.
  const COMMAND_NEEDS = [
    "updateProfile",
    "sessions",
    "endOtherSessions",
    "chatEvents",
    "inspect",
    "folders",
    "createFolder",
    "updateFolder",
    "deleteFolder",
    "addContact",
    "removeContact",
    "renameContact",
    "importContacts",
    "pin",
    "unpin",
  ]

  it("names exactly the methods of COMMAND_NEEDS the adapter does not have", () => {
    const adapter = whatsAppAdapter(fakeEngine(seed))
    for (const method of WHATSAPP.lacks ?? []) expect(adapter).not.toHaveProperty(method)
    expect([...(WHATSAPP.lacks ?? [])].sort()).toEqual(COMMAND_NEEDS.filter((method) => !(method in adapter)).sort())
  })
})

describe("automatic replies", () => {
  it("serve answers nothing by reply rules, even with replies.send at allow", async () => {
    const profile = "replying"
    expect((await wa([profile, "config", "set", "permissions.replies.send", "allow"])).code).toBe(0)
    const rule = {
      id: "away",
      on: true,
      do: ["reply"],
      where: { kinds: ["dialog"], chats: [], notChats: [] },
      when: {
        hours: null,
        words: [],
        question: false,
        mentionsMe: false,
        from: { people: [], notPeople: [], contactsOnly: false },
      },
      reply: { template: "Back soon.", model: "fill-only", asReply: false },
      limits: { perChat: "1/1d", perPerson: "1/1d" },
    }
    writeFileSync(
      repliesPathFor(WA, profile),
      JSON.stringify({ audience: { reply: "all", allow: { people: [], chats: [] } }, rules: [rule] }),
    )
    const controller = new AbortController()
    let engine: FakeEngine | undefined
    const result = await wa([profile, "serve", "--json"], {
      signal: controller.signal,
      engine: () => {
        engine = fakeEngine(seed)
        const listen = engine.listen
        engine.listen = (kinds, onEvent) => {
          const stop = listen(kinds, onEvent)
          if (kinds.includes("message"))
            setImmediate(() => {
              engine?.push({
                event: "message",
                message: {
                  id: "3EB0000000000000000R01",
                  chat: seed.dialog,
                  sender: seed.dialog,
                  senderName: "Synthetic Person",
                  fromMe: false,
                  timestamp: new Date().toISOString(),
                  editedAt: null,
                  text: "synthetic question?",
                  replyTo: null,
                },
              })
              setImmediate(() => controller.abort())
            })
          return stop
        }
        return engine
      },
    })

    expect(result.code, result.stderr).toBe(0)
    expect(engine?.sent).toEqual([])
    expect(engine?.sends).toEqual([])
    const { item } = JSON.parse(result.stdout)
    expect(item.kept).toEqual({ message: 1 })
    expect(item.replies).toBeUndefined()
    expect((await wa([profile, "--offline", "chats", "list", "--json"])).code).toBe(0)
  })
})

describe("serve and the commands it runs for others", () => {
  it("keeps its engine open while a relayed command runs, and closes it when serve stops", async () => {
    const profile = "relaying"
    const lock = join(process.env.WA_STATE_DIR ?? "", "serve", `${profile}.lock`)
    const controller = new AbortController()
    const opened: FakeEngine[] = []
    const serving = wa([profile, "serve", "--json"], {
      signal: controller.signal,
      engine: () => {
        const engine = fakeEngine(seed)
        opened.push(engine)
        return engine
      },
    })
    await vi.waitFor(() => expect(JSON.parse(readFileSync(lock, "utf8")).relay).toBeDefined(), { timeout: 5000 })

    const relayed = await wa([profile, "account", "show", "--json"], {
      engine: () => {
        throw new Error("a relayed command must not open its own engine")
      },
    })
    expect(relayed.code, relayed.stderr).toBe(0)
    expect(opened).toHaveLength(1)
    expect(opened[0]?.closed).toBe(false)

    controller.abort()
    expect((await serving).code).toBe(0)
    expect(opened[0]?.closed).toBe(true)
  })

  it("stops with the reason when WhatsApp hands the login to another connection", async () => {
    const profile = "replaced"
    const lock = join(process.env.WA_STATE_DIR ?? "", "serve", `${profile}.lock`)
    let engine: FakeEngine | undefined
    const serving = wa([profile, "serve", "--json"], {
      engine: () => {
        engine = fakeEngine(seed)
        return engine
      },
    })
    await vi.waitFor(() => expect(JSON.parse(readFileSync(lock, "utf8")).relay).toBeDefined(), { timeout: 5000 })
    engine?.push({ event: "connection", state: "replaced" })

    const result = await serving
    expect(result.code, result.stdout).toBe(12)
    expect(result.stderr).toContain("device.replaced")
    expect(engine?.closed).toBe(true)
  })
})
