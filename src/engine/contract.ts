import * as v from "valibot"

/**
 * What the engine and the adapter say to each other, in WhatsApp's own terms. The Go engine speaks it as JSON
 * lines; `FakeEngine` speaks it in memory. Bump `PROTOCOL` on any change an older peer would misread — the
 * adapter refuses an engine whose hello names another version.
 *
 * Ids are JIDs as strings. A one-to-one chat is always in its LID form (`…@lid`) when WhatsApp has one for the
 * user, never in phone form: cli-core cannot merge two stored chats, so the engine picks the one id before it
 * emits a chat (docs_ai/plans/2026-10-16-foundation.md, decision 3). Names are what the address book or the
 * person set; a phone number is never a name.
 */
export const PROTOCOL = 1

const jid = v.pipe(v.string(), v.includes("@"))
const time = v.pipe(v.string(), v.isoTimestamp())

export const waChat = v.strictObject({
  jid,
  name: v.nullable(v.string()),
  kind: v.picklist(["dm", "self", "group", "newsletter", "broadcast"]),
  unread: v.nullable(v.number()),
  lastMessageAt: v.nullable(time),
  participants: v.nullable(v.number()),
  archived: v.optional(v.boolean()),
  muted: v.optional(v.boolean()),
})

export const waContact = v.strictObject({ jid, name: v.nullable(v.string()) })

export const waMessage = v.strictObject({
  id: v.pipe(v.string(), v.nonEmpty()),
  chat: jid,
  sender: v.nullable(jid),
  senderName: v.nullable(v.string()),
  fromMe: v.boolean(),
  timestamp: time,
  editedAt: v.nullable(time),
  text: v.string(),
  replyTo: v.nullable(v.string()),
})

/** One push from the phone. `kind` follows whatsmeow's sync types; the adapter treats them all alike. */
export const waHistory = v.strictObject({
  kind: v.picklist(["bootstrap", "recent", "full", "on_demand", "push_name", "other"]),
  chats: v.array(waChat),
  contacts: v.array(waContact),
  messages: v.array(waMessage),
})

export const connectionState = v.picklist(["connected", "disconnected", "logged_out", "replaced", "banned"])

export const engineEvent = v.variant("event", [
  v.strictObject({ event: v.literal("history"), history: waHistory }),
  v.strictObject({ event: v.literal("message"), message: waMessage }),
  v.strictObject({ event: v.literal("edit"), message: waMessage }),
  v.strictObject({ event: v.literal("delete"), chat: jid, id: v.string() }),
  v.strictObject({ event: v.literal("connection"), state: connectionState }),
])

export const engineErrorCode = v.picklist([
  "validation_error",
  "authentication_error",
  "not_found",
  "rate_limited",
  "timeout",
  "network_error",
  "provider_error",
  "provider_unavailable",
  "outcome_unknown",
])

export const engineError = v.strictObject({ code: engineErrorCode, message: v.string() })

export const hello = v.strictObject({
  protocol: v.number(),
  engine: v.string(),
  version: v.string(),
})

export type WaChat = v.InferOutput<typeof waChat>
export type WaContact = v.InferOutput<typeof waContact>
export type WaMessage = v.InferOutput<typeof waMessage>
export type WaHistory = v.InferOutput<typeof waHistory>
export type EngineEvent = v.InferOutput<typeof engineEvent>
export type ConnectionState = v.InferOutput<typeof connectionState>
export type EngineErrorCode = v.InferOutput<typeof engineErrorCode>
export type Hello = v.InferOutput<typeof hello>

export interface WaAccount {
  jid: string
  name: string | null
}

export interface WaChatCard {
  chat: WaChat
  members: WaContact[] | null
}

export interface WaSend {
  chat: string
  text: string
  /** The message id WhatsApp will carry; a resend with the same id is the same message. */
  id: string
  replyTo?: string
}

/** A refusal from the engine, already in the closed list of codes. */
export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/**
 * The engine as the adapter sees it. `GoEngine` runs whatsmeow in a child process; `FakeEngine` serves tests.
 * An event nobody listens for yet is kept and handed to the first listener of its kind, so a history push that
 * comes right after connecting is not lost to a `feed` that started a moment after `watch`.
 */
export interface WhatsAppEngine {
  /** The linked account, from the engine's own store: no request. `null` before a login. */
  self(): string | null
  /** Resolves once the engine is connected and receiving. */
  ready(signal: AbortSignal): Promise<void>
  me(): Promise<WaAccount>
  /** Every chat the engine knows, for resolving a name. */
  directory(): Promise<WaChat[]>
  chat(jid: string): Promise<WaChatCard>
  send(request: WaSend): Promise<WaMessage>
  logout(): Promise<void>
  /** Events of the given kinds until the returned function is called. */
  listen(kinds: readonly EngineEvent["event"][], onEvent: (event: EngineEvent) => void): () => void
  close(): Promise<void>
}
