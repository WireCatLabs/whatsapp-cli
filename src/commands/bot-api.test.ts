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

const graph: FetchLike = async (url, init) => {
  seen.push({ path: new URL(url).pathname, method: init.method ?? "GET", body: init.body })
  return new Response(JSON.stringify({ success: true, id: "300000000000003" }))
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
  configure({ phone_number_id: PHONE_ID, waba_id: WABA_ID })
  new BotTokenStore({ app: WA, profile: "cloudtest", keyring }).write("EAAtest0000made0up0token")
})

describe("wa <profile> bot api, beyond JSON", () => {
  it("**sends a form body as a form**, every field as text", async () => {
    const added = await wa([
      "cloudtest",
      "bot",
      "api",
      "add-assigned-user",
      "--body",
      JSON.stringify({ user: "400000000000004", tasks: ["MANAGE"] }),
    ])

    expect(added.code).toBe(0)
    expect(seen[0]?.path).toBe(`/v23.0/${WABA_ID}/assigned_users`)
    expect(String(seen[0]?.body)).toBe("user=400000000000004&tasks=%5B%22MANAGE%22%5D")
  })

  it("**uploads the file a form field names with @**, as multipart with its type", async () => {
    const file = join(tmpdir(), "voice.ogg")
    writeFileSync(file, "ogg bytes")
    const uploaded = await wa([
      "cloudtest",
      "bot",
      "api",
      "upload-media",
      "--body",
      JSON.stringify({ messaging_product: "whatsapp", file: `@${file}` }),
    ])

    expect(uploaded.code).toBe(0)
    const form = seen[0]?.body as FormData
    expect(form.get("messaging_product")).toBe("whatsapp")
    expect((form.get("file") as File).type).toBe("audio/ogg")
    expect((form.get("file") as File).name).toBe("voice.ogg")
  })

  it("**refuses a form body that is not an object of fields**, before any request", async () => {
    const refused = await wa(["cloudtest", "bot", "api", "upload-media", "--body", "[1, 2]"])

    expect(refused.code).toBe(2)
    expect(refused.stderr).toContain("a form body is a JSON object")
    expect(seen).toEqual([])
  })

  it("**refuses offline, a read-only profile's write, and a profile with no token**", async () => {
    const offline = await wa(["cloudtest", "bot", "api", "get-blocked-users", "--offline"])
    configure({ phone_number_id: PHONE_ID, permissions: { bot: "readonly" } })
    const readonly = await wa(["cloudtest", "bot", "api", "block-users", "--body", "{}"])
    configure({ phone_number_id: PHONE_ID })
    new BotTokenStore({ app: WA, profile: "cloudtest", keyring }).remove()
    const tokenless = await wa(["cloudtest", "bot", "api", "get-blocked-users"])

    expect([offline.code, readonly.code, tokenless.code]).toEqual([2, 5, 4])
    expect(tokenless.stderr).toContain("bot auth set")
    expect(seen).toEqual([])
  })

  it("**refuses a body that is not JSON**, even one the spec only warns about", async () => {
    const refused = await wa(["cloudtest", "bot", "api", "send-message", "--body", "{not json"])

    expect(refused.code).toBe(2)
    expect(seen).toEqual([])
  })
})
