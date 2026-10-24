import { mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams, memoryKeyring } from "@wirecat/cli-base"
import { BotTokenStore } from "@wirecat/cli-core/cli"
import { beforeEach, describe, expect, it } from "vitest"
import { WA } from "../app.js"
import type { FetchLike } from "../bot/graph.js"
import { run } from "../program.js"

const PHONE_ID = "100000000000001"
const WABA_ID = "200000000000002"

let keyring: ReturnType<typeof memoryKeyring>
let seen: { path: string; method: string; body: unknown }[]
let answer: unknown
let requests: URL[]

const graph: FetchLike = async (url, init) => {
  requests.push(new URL(url))
  seen.push({ path: new URL(url).pathname, method: init.method ?? "GET", body: init.body })
  return new Response(JSON.stringify(answer))
}

const wa = async (argv: string[]) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    keyring,
    botFetch: graph,
    engine: () => {
      throw new Error("a bot profile must never start the engine")
    },
  } as Parameters<typeof run>[1])
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const configure = (profile: Record<string, unknown>) => {
  const dir = join(tmpdir(), "config")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "config.json"), JSON.stringify({ bot: { profiles: { cloudtest: profile } } }))
}

beforeEach(() => {
  keyring = memoryKeyring()
  seen = []
  requests = []
  answer = { data: [], paging: { next: "https://graph.facebook.com/next" } }
  configure({ phone_number_id: PHONE_ID, waba_id: WABA_ID })
  new BotTokenStore({ app: WA, profile: "cloudtest", keyring }).write("EAAtest0000made0up0token")
})

describe("wa <profile> bot templates and media, refusals", () => {
  it("sends the name predicate to Meta without filtering its returned page", async () => {
    answer = {
      data: [{ name: "hello_world", status: "APPROVED", language: "en_US", category: "UTILITY" }],
      paging: { next: "https://graph.facebook.com/next" },
    }
    const listed = await wa(["cloudtest", "bot", "templates", "list", "name:hello_world", "--json"])
    expect(listed.code, listed.stderr).toBe(0)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.searchParams.get("name")).toBe("hello_world")
    expect(JSON.parse(listed.stdout).items).toHaveLength(1)
    expect(JSON.parse(listed.stdout).page.has_more).toBe(true)
  })

  it.each([
    { args: ["category:UTILITY"] },
    { args: ["--name", "hello_world"] },
    { args: ["name:hello_world OR name:other"] },
  ])("refuses unsupported filters and the retired flag before calling Meta: %s", async ({ args }) => {
    const listed = await wa(["cloudtest", "bot", "templates", "list", ...args, "--json"])
    expect(listed.code).toBe(2)
    expect(requests).toEqual([])
  })

  it("**says when more templates wait** behind the first page", async () => {
    const listed = await wa(["cloudtest", "bot", "templates", "list", "--json"])

    expect(listed.code).toBe(0)
    expect(JSON.parse(listed.stdout).page.has_more).toBe(true)
  })

  it("**refuses offline, without a token, without the account id, and placeholders that are not an array**", async () => {
    const offline = await wa(["cloudtest", "bot", "templates", "list", "--offline"])
    const payload = await wa(["cloudtest", "bot", "templates", "send", "70000000001", "hello_world", "--payload", "{}"])
    configure({ phone_number_id: PHONE_ID })
    const accountless = await wa(["cloudtest", "bot", "templates", "list"])
    new BotTokenStore({ app: WA, profile: "cloudtest", keyring }).remove()
    const tokenless = await wa(["cloudtest", "bot", "media", "download", "300000000000003", "--output", "x.bin"])

    expect([offline.code, payload.code, accountless.code, tokenless.code]).toEqual([2, 2, 3, 4])
    expect(accountless.stderr).toContain("config set --bot waba_id")
    expect(seen).toEqual([])
  })

  it("**refuses a media id that is not digits, and an answer with no address**", async () => {
    const typo = await wa(["cloudtest", "bot", "media", "download", "../etc", "--output", "x.bin"])
    answer = { id: "300000000000003" }
    const addressless = await wa(["cloudtest", "bot", "media", "download", "300000000000003", "--output", "x.bin"])

    expect([typo.code, addressless.code]).toEqual([2, 13])
    expect(addressless.stderr).toContain("no address")
  })
})
