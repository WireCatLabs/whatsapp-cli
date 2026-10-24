import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
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

  it("**sends text with the shared bot messages send** to a number in digits, as a reply", async () => {
    answer = () => ({ status: 200, body: { messages: [{ id: "wamid.sent" }] } })
    const sent = await wa([
      "cloudtest",
      "bot",
      "messages",
      "send",
      "70000000001",
      "hello",
      "--reply-to",
      "wamid.A",
      "--json",
    ])

    expect(sent.code).toBe(0)
    expect(JSON.parse(String(seen[0]?.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "70000000001",
      context: { message_id: "wamid.A" },
      type: "text",
      text: { body: "hello", preview_url: false },
    })
  })

  it("**sends a template** by name and language, to user:<id> as recipient", async () => {
    answer = () => ({ status: 200, body: { messages: [{ id: "wamid.tpl" }] } })
    const sent = await wa(["cloudtest", "bot", "templates", "send", "user:900000000000009", "hello_world", "--json"])

    expect(sent.code).toBe(0)
    expect(JSON.parse(String(seen[0]?.body))).toMatchObject({
      recipient: "900000000000009",
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    })
    expect(JSON.parse(sent.stdout).item).toMatchObject({ id: "wamid.tpl" })
  })

  it("**lists templates** of the profile's business account", async () => {
    answer = () => ({
      status: 200,
      body: { data: [{ name: "hello_world", status: "APPROVED", language: "en_US", category: "UTILITY" }] },
    })
    const listed = await wa(["cloudtest", "bot", "templates", "list", "--json"])

    expect(listed.code).toBe(0)
    expect(seen[0]?.url.pathname).toBe("/v23.0/200000000000002/message_templates")
    expect(JSON.parse(listed.stdout).items).toEqual([
      { name: "hello_world", status: "APPROVED", language: "en_US", category: "UTILITY" },
    ])
  })

  it("**fills a template's placeholders** in the language given", async () => {
    answer = () => ({ status: 200, body: { messages: [{ id: "wamid.tpl2" }] } })
    const payload = JSON.stringify([{ type: "body", parameters: [{ type: "text", text: "42" }] }])
    const sent = await wa([
      "cloudtest",
      "bot",
      "templates",
      "send",
      "70000000001",
      "order_ready",
      "es",
      "--payload",
      payload,
    ])

    expect(sent.code).toBe(0)
    expect(JSON.parse(String(seen[0]?.body)).template).toEqual({
      name: "order_ready",
      language: { code: "es" },
      components: [{ type: "body", parameters: [{ type: "text", text: "42" }] }],
    })
  })

  it("**saves a received file** from the short-lived address, with the token in the header", async () => {
    answer = (url) =>
      url.hostname === "graph.facebook.com"
        ? { status: 200, body: { url: "https://lookaside.example/media/abc", mime_type: "image/jpeg" } }
        : { status: 200, body: "bytes" }
    const output = join(tmpdir(), "photo.jpg")
    const saved = await wa(["cloudtest", "bot", "media", "download", "300000000000003", "--output", output, "--json"])

    expect(saved.code).toBe(0)
    expect(seen.map((one) => `${one.url.hostname}${one.url.pathname}`)).toEqual([
      "graph.facebook.com/v23.0/300000000000003",
      "lookaside.example/media/abc",
    ])
    expect(seen.every((one) => one.authorization === `Bearer ${TOKEN}`)).toBe(true)
    expect(readFileSync(output, "utf8")).toBe('"bytes"')
  })

  it("**uploads a file once, then sends it by media id** with the text as its caption", async () => {
    answer = (url) =>
      url.pathname.endsWith("/media")
        ? { status: 200, body: { id: "300000000000004" } }
        : { status: 200, body: { messages: [{ id: "wamid.file" }] } }
    const photo = join(tmpdir(), "receipt.jpg")
    writeFileSync(photo, "jpeg bytes")
    const sent = await wa([
      "cloudtest",
      "bot",
      "messages",
      "send",
      "70000000001",
      "your receipt",
      "--file",
      photo,
      "--json",
    ])

    expect(sent.code).toBe(0)
    expect(seen.map((one) => one.url.pathname)).toEqual([`/v23.0/${PHONE_ID}/media`, `/v23.0/${PHONE_ID}/messages`])
    expect(seen[0]?.body).toBeInstanceOf(FormData)
    expect(JSON.parse(String(seen[1]?.body))).toMatchObject({
      type: "image",
      image: { id: "300000000000004", caption: "your receipt" },
    })
  })

  it("**refuses what WhatsApp has no way to send**: a silent message", async () => {
    const refused = await wa(["cloudtest", "bot", "messages", "send", "70000000001", "psst", "--silent"])

    expect(refused.code).not.toBe(0)
    expect(seen).toEqual([])
  })

  it("**lists templates by name**", async () => {
    answer = () => ({ status: 200, body: { data: [] } })
    await wa(["cloudtest", "bot", "templates", "list", "name:hello_world"])

    expect(seen[0]?.url.searchParams.get("name")).toBe("hello_world")
  })

  it("**overrides the number's callback** with the kept verify token, and never prints it", async () => {
    new BotTokenStore({ app: WA, profile: "cloudtest", keyring }).writeSecret("verify-token", "s3cret-verify-made-up")
    answer = (url) =>
      url.searchParams.get("fields") === "webhook_configuration"
        ? { status: 200, body: { webhook_configuration: {} } }
        : { status: 200, body: { success: true } }
    const set = await wa(["cloudtest", "bot", "webhooks", "set", "https://shop.example.ts.net/", "--json"])

    expect(set.code).toBe(0)
    const posted = seen.find((one) => one.method === "POST")
    expect(JSON.parse(String(posted?.body))).toEqual({
      webhook_configuration: {
        override_callback_uri: "https://shop.example.ts.net/",
        verify_token: "s3cret-verify-made-up",
      },
    })
    expect(set.stdout + set.stderr).not.toContain("s3cret-verify-made-up")
  })

  it("**lists, refuses and removes the number's webhook**", async () => {
    answer = (url) =>
      url.searchParams.get("fields") === "webhook_configuration"
        ? { status: 200, body: { webhook_configuration: { phone_number: "https://shop.example.ts.net/" } } }
        : { status: 200, body: { success: true } }
    const listed = await wa(["cloudtest", "bot", "webhooks", "list", "--json"])
    const typed = await wa([
      "cloudtest",
      "bot",
      "webhooks",
      "set",
      "https://shop.example.ts.net/",
      "--types",
      "messages",
    ])
    const tokenless = await wa(["cloudtest", "bot", "webhooks", "set", "https://shop.example.ts.net/"])
    const removed = await wa(["cloudtest", "bot", "webhooks", "delete", "https://shop.example.ts.net/", "--json"])

    expect(JSON.parse(listed.stdout).items).toEqual([{ url: "https://shop.example.ts.net/" }])
    expect([typed.code, tokenless.code, removed.code]).toEqual([2, 3, 0])
    expect(tokenless.stderr).toContain("--secret verify-token")
    expect(JSON.parse(String(seen.filter((one) => one.method === "POST").at(-1)?.body))).toEqual({
      webhook_configuration: { override_callback_uri: "" },
    })
  })

  it("**prints the bot's MCP server entry**, which runs `wa <profile> bot mcp`", async () => {
    const printed = await wa(["cloudtest", "bot", "mcp", "config", "--json"])

    expect(printed.code).toBe(0)
    expect(JSON.parse(printed.stdout).item.config.mcpServers["wa-bot-cloudtest"].args.slice(-3)).toEqual([
      "cloudtest",
      "bot",
      "mcp",
    ])
    expect(seen).toEqual([])
  })
})
