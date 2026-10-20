import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { PassThrough, Readable } from "node:stream"
import { stripVTControlCharacters } from "node:util"
import { captureStreams } from "@wirecat/cli-base"
import { installSkill } from "@wirecat/cli-base/skill"
import { plainQr } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EngineError } from "../engine/contract.js"
import type { EngineRequest, Environment } from "../messenger.js"
import { privateStore } from "../paths.js"
import { run } from "../program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "../testing/fake-engine.js"
import { BAN_WARNING } from "./session.js"

const input = vi.hoisted(() => ({
  answers: [] as string[],
  prompts: [] as string[],
}))

vi.mock("@wirecat/cli-core", async (original) => ({
  ...(await original<typeof import("@wirecat/cli-core")>()),
  readSecret: async (prompt: string) => {
    input.prompts.push(prompt)
    return input.answers.shift() ?? ""
  },
}))
vi.mock("@wirecat/cli-base/skill", async (original) => ({
  ...(await original<typeof import("@wirecat/cli-base/skill")>()),
  installSkill: vi.fn((_app, _skill, options: { targets: string[] }) =>
    options.targets.map((target) => join(process.env.TMPDIR ?? "", target, "whatsapp-cli", "SKILL.md")),
  ),
}))

const seed = contractSeed({ ids: whatsAppIds })
// The fake phone pushes its history in one batch, so the wait can end the moment it lands.
const QUICK = { firstMs: 5_000, quietMs: 0 }

let env: NodeJS.ProcessEnv
beforeEach(() => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "", "setup-"))
  env = {
    ...process.env,
    CI: "",
    WA_CONFIG_DIR: join(root, "config"),
    WA_STATE_DIR: join(root, "state"),
    WA_CACHE_DIR: join(root, "cache"),
    MESSAGING_STORE: join(root, "messages.db"),
    WIRECAT_STATE_DIR: join(root, "wirecat"),
  }
  input.answers = []
  input.prompts = []
  vi.mocked(installSkill).mockClear()
})
afterEach(() => vi.useRealTimers())

const linkedDevice = (profile = "default") => {
  const path = privateStore(profile, env)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, "")
  return path
}
const prompted = () => {
  const stderr = new PassThrough()
  let text = ""
  stderr.on("data", (chunk) => {
    text += String(chunk)
  })
  return { stderr, text: () => stripVTControlCharacters(text) }
}
const headless = () => Object.assign(Readable.from([]), { isTTY: false })
const terminal = (typed = "") => {
  const stdin = Object.assign(new PassThrough(), { isTTY: true })
  if (typed) stdin.end(typed)
  return stdin
}

/** One engine for the whole command, as the device is one: linked unless `linked: false`. */
const execute = async (argv: string[], environment: Environment = {}, engine = fakeEngine(seed)) => {
  const streams = captureStreams()
  const requests: EngineRequest[] = []
  const code = await run(argv, {
    streams,
    tty: false,
    stdin: headless(),
    env,
    historyWait: QUICK,
    engine: (request) => {
      requests.push(request)
      return engine
    },
    ...environment,
  })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("\n"), requests, engine }
}
const unlinked = (): FakeEngine => fakeEngine(seed, { linked: false })

describe("wa setup", () => {
  it("**needs a profile name on a new computer**, and says which command to run", async () => {
    const { WA_PROFILE: _, ...unnamed } = env
    const result = await execute(["setup", "--json"], { env: unnamed })
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("wa personal setup")
    expect(result.requests).toEqual([])
  })

  it("links through a QR code printed as text, keeps the pushed history, checks five chats and installs the skill", async () => {
    const result = await execute(["setup", "--agent", "codex", "--json"], {}, unlinked())
    expect(result.code).toBe(0)
    const answer = JSON.parse(result.stdout).item
    expect(answer).toMatchObject({
      profile: "default",
      device: { path: privateStore("default", env), reused: false },
      account: { id: seed.account?.id },
      history: { messages: seed.messages.length },
      chats: { checked: Math.min(5, seed.chats.length) },
      agent: { name: "codex" },
    })
    expect(answer.next).toMatchObject({ inbox: "wa default inbox --limit 5", receive: "wa default server install" })
    expect(result.stderr).toContain(plainQr("FAKECODE"))
    expect(result.stderr.indexOf(BAN_WARNING)).toBeGreaterThan(-1)
    expect(result.stderr.indexOf(BAN_WARNING)).toBeLessThan(result.stderr.indexOf(plainQr("FAKECODE")))
    expect(result.stdout).not.toContain("ban")
    expect(result.requests[0]).toMatchObject({ link: true, holder: "setup" })
    expect(result.engine.closed).toBe(true)
    expect(installSkill).toHaveBeenCalledWith(expect.anything(), expect.any(URL), { targets: ["agents"], env })
    for (let step = 1; step <= 5; step++) expect(result.stderr).toContain(`${step}/5`)
  })

  it("a cancel during the history wait ends only the wait, and setup finishes with exit 0", async () => {
    const stop = new AbortController()
    const engine = unlinked()
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const unlisten = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => stop.abort())
      return unlisten
    }
    const result = await execute(
      ["setup", "--agent", "none", "--json"],
      { signal: stop.signal, historyWait: { firstMs: 60_000, quietMs: 60_000 } },
      engine,
    )
    expect(result.code, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).item.history.messages).toBe(seed.messages.length)
    expect(result.engine.closed).toBe(true)
  })

  it("a cancel after the history wait still ends setup and closes the engine", async () => {
    const stop = new AbortController()
    const engine = unlinked()
    engine.me = () => {
      stop.abort()
      return new Promise(() => {})
    }
    const result = await execute(["setup", "--agent", "none", "--json"], { signal: stop.signal }, engine)
    expect(result.code).toBe(130)
    expect(result.engine.closed).toBe(true)
  })

  it("reuses a linked device without a question, also from an agent without a terminal", async () => {
    linkedDevice()
    const engine = fakeEngine(seed)
    engine.link = async () => {
      throw new Error("a linked device is never linked again")
    }
    const result = await execute(["setup", "--agent", "claude", "--json"], {}, engine)
    expect(result.code).toBe(0)
    const answer = JSON.parse(result.stdout).item
    expect(answer).toMatchObject({ device: { reused: true } })
    expect(result.stderr).toContain("2/5 — Link this device")
    expect(answer).not.toHaveProperty("history")
    expect(result.stderr).not.toContain(BAN_WARNING)
    expect(input.prompts).toEqual([])
    expect(installSkill).toHaveBeenCalledWith(expect.anything(), expect.any(URL), { targets: ["claude"], env })
  })

  it.each(["cursor", "gemini", "all"])("maps %s to supported skill targets", async (agent) => {
    linkedDevice()
    const result = await execute(["setup", "--agent", agent, "--json"])
    expect(result.code).toBe(0)
    expect(installSkill).toHaveBeenCalledWith(expect.anything(), expect.any(URL), {
      targets: agent === "all" ? ["claude", "agents"] : ["agents"],
      env,
    })
  })

  it("asks a person for their agent and prints a readable completion, each step a heading", async () => {
    linkedDevice()
    const asked = prompted()
    const result = await execute(["setup"], { tty: true, stdin: terminal(" GEMINI \n"), stderr: asked.stderr })
    expect(result.code).toBe(0)
    expect(asked.text()).toContain("      Agent [codex/cursor/claude/gemini/all/none] (none): ")
    const out = stripVTControlCharacters(result.stdout)
    expect(out).toContain("WhatsApp is ready")
    expect(out).toContain("installed for gemini")
    expect(out).toMatch(/For an agent +wa default skill show/)
    for (let step = 1; step <= 5; step++) expect(result.stderr).toMatch(new RegExp(`\\[${step}/5\\] `))
    expect(result.stderr).toContain("      ✓ local directories ready")
  })

  it("an empty agent choice skips installation", async () => {
    linkedDevice()
    const result = await execute(["setup"], { tty: true, stdin: terminal("\n") })
    expect(result.code).toBe(0)
    expect(stripVTControlCharacters(result.stdout)).toMatch(/Agent skill +skipped/)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("never asks about agents in machine mode and defaults to no installation", async () => {
    linkedDevice()
    const result = await execute(["setup", "--json"], { stdin: terminal() })
    expect(result.code).toBe(0)
    expect(installSkill).not.toHaveBeenCalled()
    expect(JSON.parse(result.stdout).item.next.mcp).toBe("wa default mcp config")
  })

  it("rejects an unknown agent choice without installing a skill", async () => {
    linkedDevice()
    const result = await execute(["setup"], { tty: true, stdin: terminal("unknown\n") })
    expect(result.code).toBe(2)
    expect(result.stdout).toBe("")
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("refuses a first link by phone without a terminal before starting the engine", async () => {
    const result = await execute(["setup", "--agent", "none", "--method", "phone", "--json"])
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error).toMatchObject({ reason: "input.required" })
    expect(JSON.parse(result.stderr).error.message).toContain("needs a terminal")
    expect(result.requests).toEqual([])
  })

  it("refuses under WA_READ_ONLY before starting the engine, also with a linked device", async () => {
    linkedDevice()
    const result = await execute(["setup", "--agent", "claude", "--json"], { env: { ...env, WA_READ_ONLY: "1" } })
    expect(result.code).toBe(5)
    expect(JSON.parse(result.stderr).error.message).toContain("cannot log in or out")
    expect(result.requests).toEqual([])
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("refuses a phone link for a store an unfinished link left without a device, when nobody can type", async () => {
    linkedDevice()
    const result = await execute(["setup", "--agent", "none", "--method", "phone", "--json"], {}, unlinked())
    expect(result.code).toBe(2)
    expect(result.engine.closed).toBe(true)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("links with a pairing code at a terminal, the number asked under the step", async () => {
    input.answers = ["+0 000 000 0000"]
    const result = await execute(
      ["setup", "--method", "phone", "--agent", "none"],
      { tty: true, stdin: terminal() },
      unlinked(),
    )
    expect(result.code).toBe(0)
    expect(input.prompts).toEqual([expect.stringMatching(/^ {6}phone number/)])
    expect(result.stderr).toContain("[2/5] Link this device")
    expect(result.stderr).not.toMatch(/scan/i)
    expect(result.stderr).toContain("Link with phone number instead")
    const warning = BAN_WARNING.replace(/^/gm, "      ")
    expect(result.stderr.indexOf(warning)).toBeGreaterThan(result.stderr.indexOf("[2/5] Link"))
    expect(result.stderr.indexOf(warning)).toBeLessThan(result.stderr.indexOf("pairing code:"))
    expect(result.stdout).not.toContain("+0 000")
    expect(result.stderr).not.toContain("+0 000")
  })

  it.each(["account.show", "chats.list"])("respects a denied %s permission before connecting", async (permission) => {
    linkedDevice()
    mkdirSync(env.WA_CONFIG_DIR ?? "", { recursive: true })
    writeFileSync(
      join(env.WA_CONFIG_DIR ?? "", "config.json"),
      JSON.stringify({ profiles: {}, defaults: { permissions: { [permission]: "deny" } } }),
    )
    const result = await execute(["setup", "--agent", "none", "--json"])
    expect(result.code).toBe(5)
    expect(result.requests).toEqual([])
  })

  it.each([{ flags: ["--offline"] }, { flags: ["--qr-file", "login.png"] }])(
    "refuses incompatible flags: %s",
    async ({ flags }) => {
      const result = await execute(["setup", "--agent", "none", ...flags])
      expect(result.code).toBe(2)
      expect(result.requests).toEqual([])
    },
  )

  it("ends a stalled account check on timeout, closes the engine and installs nothing", async () => {
    linkedDevice()
    const engine = fakeEngine(seed)
    const linkCheck = engine.me
    let asked = 0
    let rejectRequest: ((error: Error) => void) | undefined
    let stalled = () => {}
    const stalling = new Promise<void>((resolve) => {
      stalled = resolve
    })
    engine.me = () => {
      asked += 1
      // The first is the link step finding the device linked; the second is the account step.
      if (asked === 1) return linkCheck()
      return new Promise((_resolve, reject) => {
        rejectRequest = reject
        stalled()
      })
    }
    let closedWhileAsking = false
    engine.close = async () => {
      if (rejectRequest) closedWhileAsking = true
      rejectRequest?.(new EngineError("provider_unavailable", "the WhatsApp engine stopped unexpectedly"))
    }
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const running = execute(["setup", "--agent", "codex", "--timeout", "100ms", "--json"], {}, engine)
    await stalling
    await vi.advanceTimersByTimeAsync(1_100)
    const result = await running
    expect(result.code).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toMatch(/timeout|did not finish within/)
    expect(asked).toBe(2)
    expect(closedWhileAsking).toBe(true)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("gives the steps after the history wait a deadline of their own", async () => {
    const stdin = terminal()
    const asked = prompted()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    let settled = false
    const running = execute(
      ["setup", "--timeout", "2s"],
      { tty: true, stdin, stderr: asked.stderr },
      unlinked(),
    ).finally(() => {
      settled = true
    })
    for (let step = 0; step < 300 && stdin.listenerCount("data") === 0; step++) await vi.advanceTimersByTimeAsync(10)
    expect(stdin.listenerCount("data")).toBeGreaterThan(0)
    expect(settled).toBe(false)
    expect(asked.text()).toContain("Agent [codex/cursor/claude/gemini/all/none]")
    const listening = stdin.listenerCount("data")
    await vi.advanceTimersByTimeAsync(2_100)
    const result = await running
    expect(result.code).toBe(9)
    expect(result.stderr).toContain("did not finish within 2000ms")
    expect(stdin.listenerCount("data")).toBe(listening - 1)
    expect(result.engine.closed).toBe(true)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("cancels cleanly at the agent choice and keeps the device", async () => {
    const path = linkedDevice()
    const stdin = terminal()
    stdin.end()
    const result = await execute(["setup"], { tty: true, stdin })
    expect(result.code).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(existsSync(path)).toBe(true)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it.each(["--json", "--jsonl", "--no-input"])(
    "refuses a first phone link with %s even on a terminal, before starting the engine",
    async (flag) => {
      const result = await execute(["setup", "--agent", "none", "--method", "phone", flag], {
        tty: true,
        stdin: terminal(),
      })
      expect(result.code).toBe(2)
      expect(input.prompts).toEqual([])
      expect(result.requests).toEqual([])
    },
  )

  it("cancels a pending agent choice on the whole-command deadline", async () => {
    linkedDevice()
    const stdin = terminal()
    const asked = prompted()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const running = execute(["setup", "--timeout", "100ms"], { tty: true, stdin, stderr: asked.stderr })
    for (let step = 0; step < 300 && stdin.listenerCount("data") === 0; step++) await vi.advanceTimersByTimeAsync(10)
    expect(asked.text()).toContain("Agent [codex/cursor/claude/gemini/all/none]")
    const listening = stdin.listenerCount("data")
    await vi.advanceTimersByTimeAsync(1_100)
    const result = await running
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("did not finish within 100ms")
    expect(stdin.listenerCount("data")).toBe(listening - 1)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("on Windows names npm.cmd in next commands and says how to get past a PowerShell block", async () => {
    linkedDevice()
    const result = await execute(["setup", "--agent", "none", "--json"], {
      platform: "win32",
      update: { scriptPath: "/home/test/.npm/_npx/key/node_modules/@wirecat/whatsapp-cli/dist/bin/wa.js" },
    })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item.next.inbox).toMatch(/^npm\.cmd exec --yes /)
    expect(result.stderr).toContain("Windows: use wa.cmd or npm.cmd")
  })

  it("--quiet hides the step headings from a person and still prints the result", async () => {
    linkedDevice()
    const result = await execute(["setup", "--quiet", "--agent", "none"], { tty: true, stdin: terminal() })
    expect(result.code).toBe(0)
    expect(result.stderr).not.toMatch(/\[\d\/5\]/)
    expect(result.stderr).not.toContain("local directories ready")
    expect(stripVTControlCharacters(result.stdout)).toContain("WhatsApp is ready")
  })

  it("counts one chat in the singular and verifies an account that has no name", async () => {
    const chat = seed.chats[0]
    if (!chat || !seed.account) throw new Error("the contract seed has a chat and an account")
    const single = {
      ...seed,
      account: { ...seed.account, name: null },
      chats: [chat],
      messages: seed.messages.filter((message) => message.chatId === chat.id),
    }
    const result = await execute(
      ["setup", "--agent", "none"],
      { tty: true, stdin: terminal() },
      fakeEngine(single, { linked: false }),
    )
    expect(result.code, result.stderr).toBe(0)
    expect(result.stderr).toMatch(/✓ linked; 1 chat and \d+ messages kept/)
    expect(result.stderr).toContain("✓ verified")
    expect(stripVTControlCharacters(result.stdout)).toContain("1 chat checked")
  })

  it("keeps the profile in next commands when running through npm exec", async () => {
    linkedDevice("work")
    const result = await execute(["work", "setup", "--agent", "none", "--json"], {
      update: { scriptPath: "/home/test/.npm/_npx/key/node_modules/@wirecat/whatsapp-cli/dist/bin/wa.js" },
    })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item.next.inbox).toMatch(
      /npm(?:\.cmd)? exec --yes --package=@wirecat\/whatsapp-cli -- wa work inbox --limit 5/,
    )
  })
})
