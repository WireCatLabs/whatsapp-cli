import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { PassThrough, Readable } from "node:stream"
import { stripVTControlCharacters } from "node:util"
import { CliError, captureStreams } from "@wirecat/cli-base"
import { installSkill } from "@wirecat/cli-base/skill"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EngineError } from "../engine/contract.js"
import type { EngineRequest, Environment } from "../messenger.js"
import { privateStore } from "../paths.js"
import { run } from "../program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "../testing/fake-engine.js"

const input = vi.hoisted(() => ({ answers: [] as string[], prompts: [] as string[], cancel: false, wait: false }))

vi.mock("@wirecat/cli-core", async (original) => ({
  ...(await original<typeof import("@wirecat/cli-core")>()),
  readSecret: async (prompt: string, options: { signal?: AbortSignal }) => {
    input.prompts.push(prompt)
    if (input.cancel) throw new CliError("cancelled", "cancelled")
    if (input.wait)
      return new Promise<string>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new CliError("cancelled", "cancelled")), { once: true })
      })
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
const QUICK = { firstMs: 200, quietMs: 50 }

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
  input.cancel = false
  input.wait = false
  vi.mocked(installSkill).mockClear()
})

const linkedDevice = (profile = "default") => {
  const path = privateStore(profile, env)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, "")
  return path
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

  it("links through a QR image, keeps the pushed history, checks five chats and installs the skill", async () => {
    const qrFile = join(env.WA_CACHE_DIR ?? "", "login.png")
    mkdirSync(dirname(qrFile), { recursive: true })
    const result = await execute(["setup", "--qr-file", qrFile, "--agent", "codex", "--json"], {}, unlinked())
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
    expect(existsSync(qrFile)).toBe(false)
    expect(result.stderr).toContain(qrFile)
    expect(result.requests[0]).toMatchObject({ link: true, holder: "setup" })
    expect(result.engine.closed).toBe(true)
    expect(installSkill).toHaveBeenCalledWith(expect.anything(), expect.any(URL), { targets: ["agents"], env })
    for (let step = 1; step <= 5; step++) expect(result.stderr).toContain(`${step}/5`)
  })

  it("reuses a linked device without a question, also from an agent without a terminal", async () => {
    linkedDevice()
    const engine = fakeEngine(seed)
    engine.link = async () => {
      throw new Error("a linked device is never linked again")
    }
    const result = await execute(["setup", "--agent", "claude", "--json"], {}, engine)
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({ device: { reused: true }, history: { messages: 0 } })
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
    input.answers = [" GEMINI "]
    const result = await execute(["setup"], { tty: true, stdin: terminal() })
    expect(result.code).toBe(0)
    expect(input.prompts).toEqual([expect.stringContaining("Agent")])
    const out = stripVTControlCharacters(result.stdout)
    expect(out).toContain("WhatsApp is ready")
    expect(out).toContain("installed for gemini")
    expect(out).toMatch(/For an agent +wa default skill show/)
    for (let step = 1; step <= 5; step++) expect(result.stderr).toMatch(new RegExp(`\\[${step}/5\\] `))
    expect(result.stderr).toContain("      ✓ local directories ready")
  })

  it("an empty agent choice skips installation", async () => {
    linkedDevice()
    const result = await execute(["setup"], { tty: true, stdin: terminal() })
    expect(result.code).toBe(0)
    expect(stripVTControlCharacters(result.stdout)).toMatch(/Agent skill +skipped/)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("never asks about agents in machine mode and defaults to no installation", async () => {
    linkedDevice()
    const result = await execute(["setup", "--json"], { stdin: terminal() })
    expect(result.code).toBe(0)
    expect(input.prompts).toEqual([])
    expect(installSkill).not.toHaveBeenCalled()
    expect(JSON.parse(result.stdout).item.next.mcp).toBe("wa default mcp config")
  })

  it("rejects an unknown agent choice without installing a skill", async () => {
    linkedDevice()
    input.answers = ["unknown"]
    const result = await execute(["setup"], { tty: true, stdin: terminal() })
    expect(result.code).toBe(2)
    expect(result.stdout).toBe("")
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("refuses a first link without a terminal before starting the engine", async () => {
    const result = await execute(["setup", "--agent", "none", "--json"])
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("--qr-file")
    expect(result.requests).toEqual([])
  })

  it("refuses a store an unfinished link left without a device, when nobody can scan", async () => {
    linkedDevice()
    const result = await execute(["setup", "--agent", "none", "--json"], {}, unlinked())
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
    expect(result.stderr).toContain("Link with phone number instead")
    expect(result.stdout).not.toContain("+0 000")
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

  it.each([{ flags: ["--offline"] }, { flags: ["--method", "phone", "--qr-file", "login.png"] }])(
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
    engine.me = () => {
      asked += 1
      // The first is the link step finding the device linked; the second is the account step.
      if (asked === 1) return linkCheck()
      return new Promise((_resolve, reject) => {
        rejectRequest = reject
      })
    }
    let closedWhileAsking = false
    engine.close = async () => {
      if (rejectRequest) closedWhileAsking = true
      rejectRequest?.(new EngineError("provider_unavailable", "the WhatsApp engine stopped unexpectedly"))
    }
    const result = await execute(["setup", "--agent", "codex", "--timeout", "100ms", "--json"], {}, engine)
    expect(result.code).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toMatch(/timeout|did not finish within/)
    expect(asked).toBe(2)
    expect(closedWhileAsking).toBe(true)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it("cancels cleanly at the agent choice and keeps the device", async () => {
    const path = linkedDevice()
    input.cancel = true
    const result = await execute(["setup"], { tty: true, stdin: terminal() })
    expect(result.code).not.toBe(0)
    expect(result.stdout).toBe("")
    expect(existsSync(path)).toBe(true)
    expect(installSkill).not.toHaveBeenCalled()
  })

  it.each(["--json", "--jsonl", "--no-input"])(
    "refuses a first link with %s even on a terminal, before starting the engine",
    async (flag) => {
      const result = await execute(["setup", "--agent", "none", flag], { tty: true, stdin: terminal() })
      expect(result.code).toBe(2)
      expect(input.prompts).toEqual([])
      expect(result.requests).toEqual([])
    },
  )

  it("cancels a pending agent choice on the whole-command deadline", async () => {
    linkedDevice()
    input.wait = true
    const result = await execute(["setup", "--timeout", "100ms"], { tty: true, stdin: terminal() })
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("did not finish within 100ms")
    expect(installSkill).not.toHaveBeenCalled()
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
