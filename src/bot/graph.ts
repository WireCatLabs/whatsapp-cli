import { CliError, type CliErrorDetails } from "@wirecat/cli-base"
import type { EventSink } from "@wirecat/cli-core/cli"

const GRAPH = "https://graph.facebook.com"
const DEFAULT_TIMEOUT_MS = 30_000

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface GraphOptions {
  token: string
  /** `v23.0`; the profile's `graph_version`. */
  version: string
  fetch?: FetchLike
  timeoutMs?: number
  signal?: AbortSignal
  events?: EventSink
}

export interface GraphCall {
  /** `/<phone-number-id>/messages`, without the version. */
  path: string
  /** `path` with every id as `:id` — `/:id/messages`. What a trace line and a failed run show in its place. */
  endpoint: string
  method: "GET" | "POST" | "DELETE"
  query?: Record<string, string>
  /** JSON text, sent as written so 64-bit ids keep their digits. */
  json?: string
  /** A multipart or form body; `fetch` sets its content type. */
  form?: FormData | URLSearchParams
  /** `false` for a write: one that got no answer is `outcome_unknown`, never retried. */
  reads: boolean
  /** What the call is, for a trace line and an error: the operation id. */
  operation: string
}

/** Graph's error object ([Graph API errors](https://developers.facebook.com/docs/graph-api/guides/error-handling)). */
interface GraphError {
  message?: string
  type?: string
  code?: number
  error_subcode?: number
  error_user_msg?: string
  fbtrace_id?: string
}

/** Graph calls are never retried here, so every line is a first attempt. */
const WIRE = { level: "wire", transport: "http", attempt: 1 } as const

/** A run of digits long enough to be a phone number: Meta's words can quote the recipient, which no error may carry. */
const NUMBER = /\+?\d[\d\s-]{6,}\d/g

/**
 * Meta's Graph API over HTTPS. The token goes only in the `Authorization` header, never in an address,
 * so neither an error nor a trace line can carry it.
 */
export class GraphTransport {
  readonly #options: GraphOptions
  readonly #fetch: FetchLike

  constructor(options: GraphOptions) {
    this.#options = options
    this.#fetch = options.fetch ?? fetch
  }

  async call(call: GraphCall): Promise<unknown> {
    const { events } = this.#options
    const timeoutMs = this.#options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const url = new URL(`${GRAPH}/${this.#options.version}${call.path}`)
    for (const [name, value] of Object.entries(call.query ?? {})) url.searchParams.set(name, value)
    const http = {
      method: call.method,
      endpointTemplate: `/${this.#options.version}${call.endpoint}`,
      ...WIRE,
    }
    events?.({ event: "request", operation: call.operation, ...http })
    const started = performance.now()
    const signals = [AbortSignal.timeout(timeoutMs), ...(this.#options.signal ? [this.#options.signal] : [])]
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#options.token}`,
      Accept: "application/json",
    }
    if (call.json !== undefined) headers["Content-Type"] = "application/json"
    let response: Response
    let text: string
    try {
      response = await this.#fetch(url.toString(), {
        method: call.method,
        headers,
        ...(call.json !== undefined ? { body: call.json } : call.form ? { body: call.form } : {}),
        signal: AbortSignal.any(signals),
      })
      text = await response.text()
    } catch (error) {
      const failure = this.#unanswered(call, error, timeoutMs)
      events?.({
        event: "response",
        operation: call.operation,
        ...http,
        durationMs: Math.round(performance.now() - started),
        outcome: "error",
        errorCode: failure.code,
      })
      throw failure
    }
    const answered = {
      event: "response" as const,
      operation: call.operation,
      ...http,
      status: response.status,
      bytes: Buffer.byteLength(text),
      durationMs: Math.round(performance.now() - started),
    }
    let body: unknown
    try {
      body = text === "" ? {} : JSON.parse(text)
    } catch {
      events?.({ ...answered, outcome: "error", errorCode: "invalid_response" })
      throw new CliError("invalid_response", `Meta answered ${call.operation} with something that is not JSON`, {
        operation: call.operation,
        status: response.status,
      })
    }
    if (response.ok) {
      events?.({ ...answered, outcome: "ok" })
      return body
    }
    const refusal = refusalOf(call.operation, (body as { error?: GraphError }).error ?? {}, response.status, [
      this.#options.token,
    ])
    events?.({ ...answered, outcome: "error", errorCode: refusal.code })
    throw refusal
  }

  /** A media file from the address `GET /<media-id>` gave: it lives five minutes and needs the token too. */
  async download(address: string, operation: string): Promise<{ bytes: Uint8Array; type: string | null }> {
    const url = new URL(address)
    if (url.protocol !== "https:") throw new CliError("invalid_response", "Meta gave a media address that is not https")
    const { events } = this.#options
    // The address is Meta's signed media link: no template of it is safe to keep, so the line has the verb only.
    const http = { method: "GET", ...WIRE }
    events?.({ event: "request", operation, ...http })
    const started = performance.now()
    const durationMs = () => Math.round(performance.now() - started)
    let response: Response
    try {
      response = await this.#fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${this.#options.token}` },
        signal: AbortSignal.any([
          AbortSignal.timeout(this.#options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
          ...(this.#options.signal ? [this.#options.signal] : []),
        ]),
      })
    } catch (error) {
      const failure = this.#unanswered({ operation, reads: true }, error, this.#options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
      events?.({
        event: "response",
        operation,
        ...http,
        durationMs: durationMs(),
        outcome: "error",
        errorCode: failure.code,
      })
      throw failure
    }
    if (!response.ok) {
      const failure = new CliError(
        response.status === 404 || response.status === 410 ? "not_found" : "invalid_response",
        `Meta answered ${response.status} for the media file — its address lives five minutes; ask for it again`,
        { operation, status: response.status },
      )
      events?.({
        event: "response",
        operation,
        ...http,
        status: response.status,
        durationMs: durationMs(),
        outcome: "error",
        errorCode: failure.code,
      })
      throw failure
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    events?.({
      event: "response",
      operation,
      ...http,
      status: response.status,
      bytes: bytes.byteLength,
      durationMs: durationMs(),
      outcome: "ok",
    })
    return { bytes, type: response.headers.get("content-type") }
  }

  #unanswered(call: Pick<GraphCall, "operation" | "reads">, error: unknown, timeoutMs: number): CliError {
    const { signal } = this.#options
    if (signal?.aborted && (signal.reason as { name?: string })?.name !== "TimeoutError")
      return new CliError("cancelled", `${call.operation} was cancelled`, { operation: call.operation })
    if (!call.reads)
      return new CliError(
        "outcome_unknown",
        `${call.operation} got no answer; Meta may or may not have carried it out — check before repeating it`,
        { operation: call.operation, retryable: false },
      )
    const timedOut = (error as { name?: string })?.name === "TimeoutError"
    return new CliError(
      timedOut ? "timeout" : "network_error",
      timedOut ? `${call.operation} got no answer within ${timeoutMs} ms` : `${call.operation} could not reach Meta`,
      { operation: call.operation, retryable: true },
    )
  }
}

/** Meta's code first where it is specific, then the HTTP status. */
export const refusalOf = (operation: string, error: GraphError, status: number, secrets: string[] = []): CliError => {
  let said = error.error_user_msg ?? error.message ?? `HTTP ${status}`
  for (const secret of secrets) if (secret) said = said.split(secret).join("[redacted]")
  said = said.replace(NUMBER, "[number]")
  const details: CliErrorDetails = {
    operation,
    status,
    ...(error.code === undefined ? {} : { graph_code: error.code }),
    ...(error.error_subcode === undefined ? {} : { graph_subcode: error.error_subcode }),
    ...(error.fbtrace_id ? { request_id: error.fbtrace_id } : {}),
  }
  const message = `Meta refused ${operation}: ${said}`
  // 190: the token is invalid or expired; 4, 80007, 130429, 131048, 131056: rate and pair limits.
  if (error.code === 190 || status === 401) return new CliError("authentication_error", message, details)
  if ([4, 80007, 130429, 131048, 131056].includes(error.code ?? 0) || status === 429)
    return new CliError("rate_limited", message, { ...details, retryable: true })
  // 10, 200–299: the token lacks a permission; 131031: the account is locked.
  if (error.code === 10 || (error.code !== undefined && error.code >= 200 && error.code < 300) || status === 403)
    return new CliError("permission_error", message, details)
  // 131047: outside the 24-hour window, only a template may go.
  if (error.code === 131047)
    return new CliError(
      "validation_error",
      `${message} — more than 24 hours since they wrote; send a template`,
      details,
    )
  if (status === 404 || (error.code === 100 && error.error_subcode === 33))
    return new CliError("not_found", message, details)
  if (status >= 500) return new CliError("provider_unavailable", message, { ...details, retryable: true })
  return new CliError("validation_error", message, details)
}
