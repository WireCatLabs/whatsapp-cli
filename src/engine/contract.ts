import * as v from "valibot"

/**
 * What the engine and the adapter say to each other, in WhatsApp's own terms. The Go engine speaks it as JSON
 * lines; `FakeEngine` speaks it in memory. Bump `PROTOCOL` on any change an older peer would misread — the
 * adapter refuses an engine whose hello names another version.
 *
 * Ids are JIDs as strings. A one-to-one chat is always in its LID form (`…@lid`) when WhatsApp has one for the
 * user, never in phone form: cli-core cannot merge two stored chats, so the engine picks the one id before it
 * emits a chat (cli-private plans/2026-10-16-whatsapp-foundation.md, decision 3). Names are what the address book or the
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

/** `outdated`: WhatsApp refuses this engine's version. `stopped`: the engine process ended without being asked. */
export const connectionState = v.picklist([
  "connected",
  "disconnected",
  "logged_out",
  "replaced",
  "banned",
  "outdated",
  "stopped",
])

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
  "permission_error",
  "not_found",
  "rate_limited",
  "timeout",
  "network_error",
  "provider_error",
  "provider_unavailable",
  "outcome_unknown",
])

export const engineError = v.strictObject({ code: engineErrorCode, message: v.string() })

/** The engine's first line: its protocol and the linked account (`self()`), or `null` before a login. */
export const hello = v.strictObject({
  protocol: v.number(),
  engine: v.string(),
  version: v.string(),
  self: v.nullable(jid),
})

export const waAccount = v.strictObject({ jid, name: v.nullable(v.string()) })

export const waChatCard = v.strictObject({ chat: waChat, members: v.nullable(v.array(waContact)) })

/**
 * A code to show while linking: `qr` is the text of a QR code to draw, `pair` the eight characters to type on the
 * phone. Either one links the account for as long as it is valid, so it is shown and never stored or logged.
 */
export const loginCode = v.strictObject({ login: v.picklist(["qr", "pair"]), code: v.pipe(v.string(), v.nonEmpty()) })

export type WaChat = v.InferOutput<typeof waChat>
export type WaContact = v.InferOutput<typeof waContact>
export type WaMessage = v.InferOutput<typeof waMessage>
export type WaHistory = v.InferOutput<typeof waHistory>
export type EngineEvent = v.InferOutput<typeof engineEvent>
export type ConnectionState = v.InferOutput<typeof connectionState>
export type EngineErrorCode = v.InferOutput<typeof engineErrorCode>
export type Hello = v.InferOutput<typeof hello>
export type WaAccount = v.InferOutput<typeof waAccount>
export type WaChatCard = v.InferOutput<typeof waChatCard>
export type LoginCode = v.InferOutput<typeof loginCode>

export interface WaLink {
  method: "qr" | "phone"
  /** International format; the phone method only. Sent to the engine on stdin, never as an argument. */
  phone?: string
}

export interface WaSend {
  chat: string
  text: string
  /** The message id WhatsApp will carry; a resend with the same id is the same message. */
  id: string
  replyTo?: string
}

/**
 * A refusal from the engine, already in the closed list of codes. Its message is fixed wording: it never repeats a
 * chat name, a JID or anything typed, since errors reach logs and run records.
 */
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
  /**
   * The linked account, from the engine's own store: no request. `null` before a login. Always the user JID in LID
   * form with no device part (`…@lid`, not `…:12@s.whatsapp.net`): the store keys the account by it, so a change of
   * form later would split the account, and the phone form would put a phone number in a stored key.
   */
  self(): string | null
  /** Resolves once the engine is connected and receiving. */
  ready(signal: AbortSignal): Promise<void>
  me(): Promise<WaAccount>
  /** Every chat the engine knows, for resolving a name. */
  directory(): Promise<WaChat[]>
  chat(jid: string): Promise<WaChatCard>
  send(request: WaSend): Promise<WaMessage>
  /**
   * Links this device to the account, showing each code through `onCode` until the phone confirms. Answers the
   * account at once when the device is already linked.
   */
  link(request: WaLink, onCode: (code: LoginCode) => void): Promise<WaAccount>
  logout(): Promise<void>
  /** Events of the given kinds until the returned function is called. */
  listen(kinds: readonly EngineEvent["event"][], onEvent: (event: EngineEvent) => void): () => void
  close(): Promise<void>
}
