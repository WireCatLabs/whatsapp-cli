import { createHmac } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams, memoryKeyring } from "@wirecat/cli-base"
import { BotTokenStore } from "@wirecat/cli-core/cli"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { WA } from "../app.js"
import type { FetchLike } from "../bot/graph.js"
import { run } from "../program.js"

const TOKEN = "EAAtest0000made0up0token"
const APP_SECRET = "s3cret-app-made-up"
const PHONE_ID = "100000000000001"

let keyring: ReturnType<typeof memoryKeyring>
let posted: unknown[]

const graph: FetchLike = async (url, init) => {
  if (init.method === "POST") posted.push(JSON.parse(String(init.body)))
  const at = new URL(url)
  const body =
    at.pathname === `/v23.0/${PHONE_ID}` && !at.searchParams.has("fields")
      ? { success: true }
      : at.pathname.endsWith("/messages")
        ? { messages: [{ id: "wamid.reply" }] }
        : { id: PHONE_ID, verified_name: "Test Shop", webhook_configuration: {} }
  return new Response(JSON.stringify(body))
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address()
      probe.close(() => resolve(typeof address === "object" && address ? address.port : 0))
    })
  })

const environment = (streams: ReturnType<typeof captureStreams>, signal?: AbortSignal) =>
  ({
    streams,
    tty: false,
    keyring,
    botFetch: graph,
    engine: () => {
      throw new Error("a bot profile must never start the engine")
    },
    ...(signal ? { signal } : {}),
  }) as Parameters<typeof run>[1]

const delivery = (text: string, seconds: number) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "200000000000002",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "70000000009", phone_number_id: PHONE_ID },
              contacts: [{ profile: { name: "Ann" }, wa_id: "70000000001" }],
              messages: [
                {
                  from: "70000000001",
                  id: `wamid.${seconds}`,
                  timestamp: String(seconds),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  })

beforeEach(() => {
  keyring = memoryKeyring()
  posted = []
  const dir = join(tmpdir(), "config")
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify({ bot: { profiles: { shop: { phone_number_id: PHONE_ID } } } }),
  )
  const tokens = new BotTokenStore({ app: WA, profile: "shop", keyring })
  tokens.write(TOKEN)
  tokens.writeSecret("app-secret", APP_SECRET)
  tokens.writeSecret("verify-token", "s3cret-verify-made-up")
})

describe("wa <profile> bot watch --public-url", () => {
  it("**keeps a signed delivery in the store**, prints it, and later refuses a free-form reply after 24 hours", async () => {
    const port = await freePort()
    const stop = new AbortController()
    const streams = captureStreams()
    const watching = run(
      ["shop", "bot", "watch", "--jsonl", "--public-url", "https://shop.example.ts.net", "--port", String(port)],
      environment(streams, stop.signal),
    )
    await vi.waitFor(() => expect(streams.stderr.join("")).toContain("receiving at"), { interval: 5 })
    const at = new URL(`http://127.0.0.1:${port}/`)
    const handshake = await fetch(
      new URL("/?hub.mode=subscribe&hub.verify_token=s3cret-verify-made-up&hub.challenge=7", at),
    )
    const body = delivery("hello shop", 1761000000)
    const sign = (secret: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
    const forged = await fetch(at, { method: "POST", body, headers: { "x-hub-signature-256": sign("guess") } })
    const kept = await fetch(at, { method: "POST", body, headers: { "x-hub-signature-256": sign(APP_SECRET) } })
    stop.abort()

    expect(await watching).toBe(0)
    expect([handshake.status, await handshake.text(), forged.status, kept.status]).toEqual([200, "7", 401, 200])
    expect(streams.stdout.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({ id: "wamid.1761000000", text: "hello shop", chatId: "70000000001" }),
    ])

    const late = captureStreams()
    const refused = await run(["shop", "bot", "messages", "send", "70000000001", "still there?"], environment(late))
    expect(refused).not.toBe(0)
    expect(late.stderr.join("")).toContain("only a template")
    expect(posted).toEqual([])
  })
})
