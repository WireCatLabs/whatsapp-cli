import { mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams, memoryKeyring } from "@wirecat/cli-base"
import { BotTokenStore } from "@wirecat/cli-core/cli"
import { beforeEach, describe, expect, it } from "vitest"
import { WA } from "../app.js"
import type { FetchLike } from "../bot/graph.js"
import { run } from "../program.js"

const TOKEN = "EAAtest0000made0up0token"
const PHONE_ID = "100000000000001"

interface Seen {
  url: URL
  method: string
  authorization: string | null
  body: unknown
}

let keyring: ReturnType<typeof memoryKeyring>
let seen: Seen[]
let answer: (url: URL) => { status: number; body: unknown }

const graph: FetchLike = async (url, init) => {
  const at = new URL(url)
  const headers = new Headers(init.headers)
  seen.push({ url: at, method: init.method ?? "GET", authorization: headers.get("authorization"), body: init.body })
  const { status, body } = answer(at)
  return new Response(JSON.stringify(body), { status })
}

const noEngine = () => {
  throw new Error("a bot profile must never start the engine")
}

const wa = async (argv: string[]) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    keyring,
    botFetch: graph,
    engine: noEngine,
  } as Parameters<typeof run>[1])
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const configure = (settings: Record<string, string>) => {
  const dir = join(tmpdir(), "config")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "config.json"), JSON.stringify({ bot: { profiles: { cloudtest: settings } } }))
}

beforeEach(() => {
  keyring = memoryKeyring()
  seen = []
  answer = () => ({
    status: 200,
    body: { id: PHONE_ID, display_phone_number: "+1 555 000 0000", verified_name: "Test Shop" },
  })
  configure({ phone_number_id: PHONE_ID, waba_id: "200000000000002" })
  new BotTokenStore({ app: WA, profile: "cloudtest", keyring }).write(TOKEN)
})

describe("wa <profile> bot", () => {
  it("**asks Meta who the number is** with the token in the header only, never in the address", async () => {
    const me = await wa(["cloudtest", "bot", "me", "--json"])

    expect(me.code).toBe(0)
    expect(JSON.parse(me.stdout).item).toMatchObject({ id: PHONE_ID, name: "Test Shop" })
    expect(seen[0]?.url.pathname).toBe(`/v23.0/${PHONE_ID}`)
    expect(seen[0]?.authorization).toBe(`Bearer ${TOKEN}`)
    expect(seen.every((one) => !one.url.toString().includes(TOKEN))).toBe(true)
    expect(me.stdout + me.stderr).not.toContain(TOKEN)
  })

  it("**fills the phone number id and the Graph version from the profile's settings**", async () => {
    configure({ phone_number_id: PHONE_ID, graph_version: "v26.0" })
    answer = () => ({ status: 200, body: { data: [] } })
    const listed = await wa(["cloudtest", "bot", "api", "get-blocked-users", "--json"])

    expect(listed.code).toBe(0)
    expect(seen[0]?.url.pathname).toBe(`/v26.0/${PHONE_ID}/block_users`)
  })

  it("**refuses without a phone number id**, saying which setting to add", async () => {
    configure({})
    const refused = await wa(["cloudtest", "bot", "api", "get-blocked-users"])

    expect(refused.code).not.toBe(0)
    expect(refused.stderr).toContain("config set --bot phone_number_id")
    expect(seen).toEqual([])
  })

  it("**sends a body the spec refuses**, with a warning: Meta's file lags the live API", async () => {
    answer = () => ({ status: 200, body: { messages: [{ id: "wamid.made-up" }] } })
    const body = JSON.stringify({
      messaging_product: "whatsapp",
      recipient: "US.made-up-business-scoped-id",
      type: "text",
      text: { body: "hello" },
    })
    const sent = await wa(["cloudtest", "bot", "api", "send-message", "--body", body, "--json"])

    expect(sent.code).toBe(0)
    expect(sent.stderr).toContain("sent anyway")
    expect(seen[0]?.method).toBe("POST")
    expect(seen[0]?.url.pathname).toBe(`/v23.0/${PHONE_ID}/messages`)
    expect(JSON.parse(String(seen[0]?.body))).toMatchObject({ recipient: "US.made-up-business-scoped-id" })
  })

  it("**turns Graph's error object into an error** without the number it may quote", async () => {
    answer = () => ({
      status: 400,
      body: { error: { message: "Recipient +1 555 000 1234 not in allowed list", code: 131030, fbtrace_id: "trace1" } },
    })
    const refused = await wa(["cloudtest", "bot", "api", "get-blocked-users", "--json"])

    expect(refused.code).not.toBe(0)
    expect(refused.stderr + refused.stdout).toContain("Meta refused")
    expect(refused.stderr + refused.stdout).not.toContain("555 000 1234")
  })

  it("**asks before a destructive operation**, and never registers a number unasked", async () => {
    const refused = await wa([
      "cloudtest",
      "bot",
      "api",
      "register-phone-number",
      "--body",
      JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }),
    ])

    expect(refused.code).not.toBe(0)
    expect(seen.filter((one) => one.url.pathname.endsWith("/register"))).toEqual([])
  })

  it("**never offers the Graph version or a token as a flag**", async () => {
    const help = await wa(["cloudtest", "bot", "api", "send-message", "--help"])
    expect(help.stdout).not.toContain("--version <")
    expect(help.stdout).not.toContain("--authorization")
  })

  it("**takes the ids and the body as flags** over the profile's settings", async () => {
    answer = () => ({ status: 200, body: { messages: [{ id: "wamid.made-up" }] } })
    const file = join(tmpdir(), "body.json")
    writeFileSync(
      file,
      JSON.stringify({ messaging_product: "whatsapp", to: "70000000001", type: "text", text: { body: "hi" } }),
    )
    const listed = await wa(["cloudtest", "bot", "api", "get-blocked-users", "--phone-number-id", "100000000000009"])
    const sent = await wa([
      "cloudtest",
      "bot",
      "api",
      "send-message",
      "--phone-number-id",
      "100000000000009",
      "--body-file",
      file,
    ])

    expect([listed.code, sent.code]).toEqual([0, 0])
    expect(seen.map((one) => one.url.pathname)).toEqual([
      "/v23.0/100000000000009/block_users",
      "/v23.0/100000000000009/messages",
    ])
  })
})
