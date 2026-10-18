import * as v from "valibot"
import type { GroupEngine } from "./groups.js"
import type { PrivacyEngine } from "./privacy.js"
import type { SettingsEngine } from "./settings.js"

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
export const PROTOCOL = 19

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
  /** The community a group is linked to. */
  parent: v.optional(jid),
  /** A community itself: a group that holds other groups. */
  community: v.optional(v.literal(true)),
})

export const waContact = v.strictObject({ jid, name: v.nullable(v.string()) })

/**
 * What whatsmeow needs to fetch and decrypt a file again, base64 where it is bytes. Stored as the attachment's opaque
 * `providerRef`, so a download or a forward needs only the store. A channel's files are not encrypted and have no keys.
 */
export const waMediaRef = v.strictObject({
  media: v.picklist(["image", "video", "audio", "document", "sticker"]),
  directPath: v.pipe(v.string(), v.nonEmpty()),
  mediaKey: v.optional(v.string()),
  fileSha256: v.optional(v.string()),
  fileEncSha256: v.optional(v.string()),
})

/**
 * cli-core's Attachment in WhatsApp's terms: `photo`, `video`, `voice`, `audio`, `document`, `sticker`, `location`
 * (`url` is a `geo:` link), `contact` (its name only — the card holds a phone number). `ref` only for a file.
 */
export const waAttachment = v.strictObject({
  kind: v.picklist(["photo", "video", "voice", "audio", "document", "sticker", "location", "contact"]),
  url: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  title: v.optional(v.string()),
  name: v.optional(v.string()),
  size: v.optional(v.number()),
  mime: v.optional(v.string()),
  duration: v.optional(v.number()),
  ref: v.optional(waMediaRef),
})

/**
 * A poll as its message carries it. An answer's `id` is the start of the SHA-256 of its text, which is what a vote
 * names on the wire. Votes arrive later, live as `vote` events or in a history push's `votes`; cli-core's store
 * counts them.
 */
export const waPoll = v.strictObject({
  question: v.string(),
  answers: v.array(v.strictObject({ id: v.pipe(v.string(), v.nonEmpty()), text: v.string() })),
  multiple: v.boolean(),
})

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
  attachments: v.optional(v.array(waAttachment)),
  poll: v.optional(waPoll),
})

/**
 * One person's newest choice in a poll: `selected` is the full SHA-256 of each chosen answer's text, and none takes
 * the vote back. `voter` is in LID form like a sender, and the account's own vote is under `self()`. A vote in a
 * history push carries its `poll`, since the push may not hold that poll; a live `vote` event has none. `votedAt` is
 * when the voter cast it, by WhatsApp's clock: the store keeps a voter's newest vote by it.
 */
export const waVote = v.strictObject({
  chat: jid,
  message: v.pipe(v.string(), v.nonEmpty()),
  voter: jid,
  voterName: v.nullable(v.string()),
  selected: v.array(v.string()),
  votedAt: time,
  poll: v.optional(waPoll),
})

/**
 * One push from the phone. `kind` follows whatsmeow's sync types; the adapter treats them all alike. `votes` are the
 * votes in the pushed polls, which the store saves with the push, not as `vote` events.
 */
export const waHistory = v.strictObject({
  kind: v.picklist(["bootstrap", "recent", "full", "on_demand", "push_name", "other"]),
  chats: v.array(waChat),
  contacts: v.array(waContact),
  messages: v.array(waMessage),
  votes: v.array(waVote),
})

/**
 * The phone's answer to `older`: the chat's messages sent before the anchor, as many as were asked or fewer. No
 * messages and `more: false` is the chat's start. The engine never answers no messages with `more: true`: a batch of
 * only messages the contract skips is asked past, since cli-core reads any empty page as the start.
 */
export const waOlder = v.strictObject({ messages: v.array(waMessage), more: v.boolean() })

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
  v.strictObject({ event: v.literal("vote"), vote: waVote }),
  /** `until`: when a temporary ban ends, if WhatsApp said. */
  v.strictObject({ event: v.literal("connection"), state: connectionState, until: v.optional(time) }),
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

/**
 * Why, for the refusals an agent recovers from differently than their code says: another process holds the device
 * (`device.in-use`), WhatsApp handed the login to another connection (`device.replaced`), logged the device out, refuses
 * this version (`client.outdated`), banned the account, or asked it to slow down (`account.rate-limited`, never the
 * engine's own lookup pace), or has not yet sent the keys a settings change is sealed with (`settings.keys-missing`).
 * The CLI registers each one (`src/reasons.ts`).
 */
export const engineReason = v.picklist([
  "device.in-use",
  "device.replaced",
  "device.logged-out",
  "client.outdated",
  "account.banned",
  "account.rate-limited",
  "settings.keys-missing",
])

export const engineError = v.strictObject({
  code: engineErrorCode,
  message: v.string(),
  reason: v.optional(engineReason),
  /** When a temporary ban ends, if WhatsApp said. */
  until: v.optional(time),
})

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
export type WaPoll = v.InferOutput<typeof waPoll>
export type WaVote = v.InferOutput<typeof waVote>
export type WaMediaRef = v.InferOutput<typeof waMediaRef>
export type WaAttachment = v.InferOutput<typeof waAttachment>
export type WaHistory = v.InferOutput<typeof waHistory>
export type EngineEvent = v.InferOutput<typeof engineEvent>
export type ConnectionState = v.InferOutput<typeof connectionState>
export type EngineErrorCode = v.InferOutput<typeof engineErrorCode>
export type EngineReason = v.InferOutput<typeof engineReason>
/** The engine's reasons, and the client's own for an engine that ended, before a request or during a write. */
export type WaReason = EngineReason | "engine.stopped" | "engine.stopped-mid-write"
export type Hello = v.InferOutput<typeof hello>
export type WaAccount = v.InferOutput<typeof waAccount>
export type WaChatCard = v.InferOutput<typeof waChatCard>
export type LoginCode = v.InferOutput<typeof loginCode>
export type WaOlder = v.InferOutput<typeof waOlder>

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
  /** The replied-to message as the store holds it; without it, phones show the quote as unavailable. */
  quoted?: WaQuote
}

export interface WaQuote {
  fromMe: boolean
  sender: string | null
  text: string
}

/** One file from this machine, sent with `text` as its caption. `kind` is decided as tg decides it. */
export interface WaSendMedia extends WaSend {
  file: { kind: "photo" | "video" | "voice" | "document"; path: string; name: string }
}

/** Photos and videos sent as one album, `text` as the first one's caption. */
export interface WaSendAlbum extends WaSend {
  files: WaSendMedia["file"][]
}

/** A poll to send; `multiple` lets a voter pick any number of answers, else one. */
export interface WaNewPoll {
  chat: string
  id: string
  question: string
  answers: string[]
  multiple: boolean
}

/** A stored message sent again, marked forwarded: its text and its one file, by the keys the store holds. */
export interface WaForward {
  chat: string
  id: string
  text: string
  attachment: WaAttachment | null
}

/**
 * A message the account already has, as WhatsApp addresses one: whatsmeow keeps no messages, so whether it is the
 * account's own and who sent it come from cli-core's store. A wrong key is not refused — WhatsApp drops the reaction
 * or the deletion silently — so the adapter sends one only for a message the store holds.
 */
export interface WaKey {
  chat: string
  id: string
  fromMe: boolean
  /** Who sent it; in a group, required for someone else's message. */
  sender: string | null
}

/** The most messages one `older` request asks the phone for, as WhatsApp's own clients ask. */
export const OLDER_MAX = 50

/** A stored message the phone counts back from: WhatsApp needs its id, whether it is the account's own, and its time. */
export interface WaAnchor extends WaKey {
  timestamp: string
}

/**
 * A refusal from the engine, already in the closed list of codes. Its message is fixed wording: it never repeats a
 * chat name, a JID or anything typed, since errors reach logs and run records.
 */
export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
    readonly reason?: WaReason,
    /** When a temporary ban ends, if WhatsApp said. */
    readonly until?: string,
  ) {
    super(message)
  }
}

/**
 * The engine as the adapter sees it. `GoEngine` runs whatsmeow in a child process; `FakeEngine` serves tests.
 * An event nobody listens for yet is kept and handed to the first listener of its kind, so a history push that
 * comes right after connecting is not lost to a `feed` that started a moment after `watch`.
 */
export interface WhatsAppEngine extends GroupEngine, PrivacyEngine, SettingsEngine {
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
  /** New text for one of the account's own messages; the answer carries the new text and when it changed. */
  edit(key: WaKey, text: string): Promise<WaMessage>
  /** Deletes a message for everyone: the account's own, or another's in a group the account administers. */
  revoke(key: WaKey): Promise<void>
  /** The account's reaction on a message; `null` takes it off. */
  react(key: WaKey, emoji: string | null): Promise<void>
  /** A read receipt for someone else's message; the sender sees it. Only a command that asked for it calls this. */
  markRead(key: WaKey): Promise<void>
  /** Uploads the file, then sends it; a failed upload sent nothing. */
  sendMedia(request: WaSendMedia): Promise<WaMessage>
  /**
   * Uploads every file, then sends the album and each file tied to it. The answer is the first file's message, under
   * the send id; the others carry ids derived from it, so a repeat sends the same ones.
   */
  sendAlbum(request: WaSendAlbum): Promise<WaMessage>
  /** Writes a stored file to `path`, which must not exist yet; the engine creates it readable by this user alone. */
  download(attachment: WaAttachment, path: string): Promise<void>
  forward(request: WaForward): Promise<WaMessage>
  createPoll(request: WaNewPoll): Promise<WaMessage>
  /** The account's vote in a poll, by the answers' texts; none takes it back. Everyone in the chat sees it. */
  vote(key: WaKey, answers: string[]): Promise<void>
  /**
   * Pins the message for everyone in the chat: WhatsApp has no pin only the account sees. `duration` is 86400,
   * 604800 or 2592000 seconds; the engine pins for 7 days without one.
   */
  pin(key: WaKey, duration?: number): Promise<void>
  unpin(key: WaKey): Promise<void>
  /**
   * Asks the phone for up to `count` of the chat's messages sent before `anchor`, and waits for its answer. WhatsApp
   * keeps no history on its servers: the phone answers only while it is online, and a phone that does not answer in
   * time is a `timeout`.
   */
  older(anchor: WaAnchor, count: number): Promise<WaOlder>
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
