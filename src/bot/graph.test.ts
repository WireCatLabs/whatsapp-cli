import { describe, expect, it } from "vitest"
import { type FetchLike, GraphTransport, refusalOf } from "./graph.js"

const TOKEN = "EAAtest0000made0up0token"

const transport = (fetch: FetchLike, more: { signal?: AbortSignal; timeoutMs?: number } = {}) => {
  const events: { event: string; outcome?: string; errorCode?: string }[] = []
  const graph = new GraphTransport({
    token: TOKEN,
    version: "v23.0",
    fetch,
    events: (event) => events.push(event),
    ...more,
  })
  return { graph, events }
}

const read = { path: "/100000000000001", method: "GET" as const, reads: true, operation: "getPhoneNumber" }
const write = {
  path: "/100000000000001/messages",
  method: "POST" as const,
  json: "{}",
  reads: false,
  operation: "sendMessage",
}

describe("the Graph transport", () => {
  it("sends the token only in the header, the query in the address, and records the answer", async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const { graph, events } = transport(async (url, init) => {
      seen = { url, init }
      return new Response("")
    })
    expect(await graph.call({ ...read, query: { fields: "id" } })).toEqual({})
    expect(seen?.url).toBe("https://graph.facebook.com/v23.0/100000000000001?fields=id")
    expect(new Headers(seen?.init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`)
    expect(events.map((one) => one.outcome ?? one.event)).toEqual(["request", "ok"])
  })

  it("sends a form as it is, without a JSON content type", async () => {
    let init: RequestInit | undefined
    const { graph } = transport(async (_url, given) => {
      init = given
      return new Response("{}")
    })
    const form = new URLSearchParams({ user: "1" })
    await graph.call({ ...write, json: undefined, form })
    expect(init?.body).toBe(form)
    expect(new Headers(init?.headers).has("content-type")).toBe(false)
  })

  it("calls an answer that is not JSON an invalid response", async () => {
    const { graph, events } = transport(async () => new Response("<html>"))
    await expect(graph.call(read)).rejects.toMatchObject({ code: "invalid_response" })
    expect(events.at(-1)).toMatchObject({ errorCode: "invalid_response" })
  })

  it("never calls a write that got no answer anything but unknown, and lets a read be retried", async () => {
    const down: FetchLike = async () => {
      throw new TypeError("fetch failed")
    }
    await expect(transport(down).graph.call(write)).rejects.toMatchObject({ code: "outcome_unknown" })
    await expect(transport(down).graph.call(read)).rejects.toMatchObject({
      code: "network_error",
      details: { retryable: true },
    })
    const slow: FetchLike = async () => {
      throw Object.assign(new Error("slow"), { name: "TimeoutError" })
    }
    await expect(transport(slow).graph.call(read)).rejects.toMatchObject({ code: "timeout" })
  })

  it("says a stopped command was cancelled", async () => {
    const stop = new AbortController()
    stop.abort()
    const { graph } = transport(
      async () => {
        throw new Error("aborted")
      },
      { signal: stop.signal },
    )
    await expect(graph.call(read)).rejects.toMatchObject({ code: "cancelled" })
  })

  it("turns Graph's error object into an error, never repeating the token", async () => {
    const { graph } = transport(
      async () =>
        new Response(JSON.stringify({ error: { message: `bad token ${TOKEN}`, code: 190 } }), { status: 401 }),
    )
    const refusal = await graph.call(read).catch((error: Error) => error)
    expect(refusal).toMatchObject({ code: "authentication_error" })
    expect((refusal as Error).message).not.toContain(TOKEN)
  })

  it("downloads a media file over https with the token, and says when its address has expired", async () => {
    const seen: string[] = []
    const { graph } = transport(async (url, init) => {
      seen.push(new Headers(init.headers).get("authorization") ?? "")
      return url.endsWith("/gone")
        ? new Response("", { status: 404 })
        : new Response("bytes", { headers: { "content-type": "image/jpeg" } })
    })
    expect(await graph.download("https://lookaside.example/ok", "downloadMedia")).toMatchObject({ type: "image/jpeg" })
    await expect(graph.download("https://lookaside.example/gone", "downloadMedia")).rejects.toMatchObject({
      code: "not_found",
    })
    await expect(graph.download("http://lookaside.example/plain", "downloadMedia")).rejects.toMatchObject({
      code: "invalid_response",
    })
    expect(seen).toEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`])
    const down = transport(async () => {
      throw new TypeError("fetch failed")
    })
    await expect(down.graph.download("https://lookaside.example/ok", "downloadMedia")).rejects.toMatchObject({
      code: "network_error",
    })
    const broken = transport(async () => new Response("", { status: 500 }))
    await expect(broken.graph.download("https://lookaside.example/ok", "downloadMedia")).rejects.toMatchObject({
      code: "invalid_response",
    })
  })
})

describe("Graph's refusals", () => {
  it.each([
    [{ code: 190 }, 400, "authentication_error"],
    [{ code: 4 }, 400, "rate_limited"],
    [{}, 429, "rate_limited"],
    [{ code: 10 }, 400, "permission_error"],
    [{ code: 200 }, 400, "permission_error"],
    [{}, 403, "permission_error"],
    [{ code: 131047 }, 400, "validation_error"],
    [{ code: 100, error_subcode: 33 }, 400, "not_found"],
    [{}, 404, "not_found"],
    [{}, 503, "provider_unavailable"],
    [{ code: 100 }, 400, "validation_error"],
  ])("maps %o with HTTP %i to %s", (error, status, code) => {
    expect(refusalOf("sendMessage", error, status).code).toBe(code)
  })

  it("keeps Meta's code and trace id, prefers its words for people, and masks a number it quotes", () => {
    const refusal = refusalOf(
      "sendMessage",
      {
        error_user_msg: "Recipient +1 555 000 1234 is not allowed",
        code: 131030,
        error_subcode: 2,
        fbtrace_id: "Atrace",
      },
      400,
    )
    expect(refusal.message).toBe("Meta refused sendMessage: Recipient [number] is not allowed")
    expect(refusal.details).toMatchObject({ graph_code: 131030, graph_subcode: 2, request_id: "Atrace" })
    expect(refusalOf("getMedia", {}, 500).message).toContain("HTTP 500")
  })
})
