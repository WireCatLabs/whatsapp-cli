import { statSync, writeFileSync } from "node:fs"
import type { Chat, Message } from "@wirecat/cli-core"
import type { IdMaker, Seed } from "@wirecat/cli-core/testing"
import * as v from "valibot"
import { toWaAttachment } from "../adapter/map.js"
import {
  EngineError,
  type EngineEvent,
  engineEvent,
  type WaAttachment,
  type WaChat,
  type WaContact,
  type WaForward,
  type WaKey,
  type WaMessage,
  type WhatsAppEngine,
} from "../engine/contract.js"
import { eventHub } from "../engine/events.js"
import { type FakeGroups, fakeGroups } from "./fake-groups.js"

/** Ids shaped like WhatsApp's: groups, LIDs and web message ids. */
export const whatsAppIds: IdMaker = (kind, n) =>
  kind === "chat"
    ? `1203630000000${String(n).padStart(5, "0")}@g.us`
    : kind === "person"
      ? `1000000000${String(n).padStart(5, "0")}@lid`
      : `3EB0${n.toString(16).toUpperCase().padStart(18, "0")}`

const KINDS: Record<Chat["kind"], WaChat["kind"]> = {
  dialog: "dm",
  saved: "self",
  group: "group",
  channel: "newsletter",
  unknown: "broadcast",
}

const waChatOf = (chat: Chat): WaChat => ({
  jid: chat.id,
  name: chat.title,
  kind: KINDS[chat.kind],
  unread: chat.unreadCount,
  lastMessageAt: chat.lastMessageAt,
  participants: chat.participantsCount,
})

const waMessageOf = (message: Message): WaMessage => ({
  id: message.id,
  chat: message.chatId,
  sender: message.senderId,
  senderName: message.senderName,
  fromMe: message.outgoing === true,
  timestamp: message.timestamp,
  editedAt: message.editedAt,
  text: message.text,
  replyTo: message.replyToId ?? null,
  ...(message.attachments.length === 0
    ? {}
    : { attachments: message.attachments.flatMap((one) => toWaAttachment(one) ?? []) }),
})

const UPLOADED: Record<string, { kind: WaAttachment["kind"]; media: "image" | "video" | "audio" | "document" }> = {
  photo: { kind: "photo", media: "image" },
  video: { kind: "video", media: "video" },
  voice: { kind: "voice", media: "audio" },
  document: { kind: "document", media: "document" },
}

/** The bytes the fake engine "downloads": synthetic, named after the file's kind. */
export const syntheticBytes = (attachment: WaAttachment): Buffer => Buffer.from(`synthetic ${attachment.kind} bytes`)

export interface FakeEngine extends WhatsAppEngine, FakeGroups {
  /** Pushes an event as the engine would, checked against the contract first. */
  push(event: EngineEvent): void
  sent: WaMessage[]
  /** Each file sent, as the engine read it from disk. */
  uploads: { kind: string; name: string; size: number }[]
  /** Each file written for a download, by the attachment it was asked for. */
  downloads: WaAttachment[]
  forwards: WaForward[]
  /** Every edit, deletion, reaction and read receipt, in order, with the key it was addressed by. */
  actions: { op: "edit" | "revoke" | "react" | "read"; key: WaKey; text?: string; emoji?: string | null }[]
  closed: boolean
  loggedOut: boolean
}

/**
 * The engine in memory, filled from cli-core's contract seed. It pushes the seed's history once, as the phone does
 * right after linking, and drops a repeated message id as WhatsApp does.
 */
export const fakeEngine = (seed: Seed, { linked = true }: { linked?: boolean } = {}): FakeEngine => {
  const hub = eventHub()
  let self = linked ? (seed.account?.id ?? null) : null
  const chats = seed.chats.map(waChatOf)
  const messages = seed.messages.map(waMessageOf)
  const contactsOf = (jid: string): WaContact[] | null =>
    seed.members[jid]?.map((member) => ({ jid: member.id, name: member.name })) ?? null
  const sent: WaMessage[] = []

  const push = (event: EngineEvent) => hub.emit(v.parse(engineEvent, event))

  const pushHistory = () =>
    push({
      event: "history",
      history: {
        kind: "bootstrap",
        chats,
        contacts: seed.people.map((person) => ({ jid: person.id, name: person.name })),
        messages,
      },
    })

  if (linked) pushHistory()

  const actions: FakeEngine["actions"] = []
  const uploads: FakeEngine["uploads"] = []
  const downloads: WaAttachment[] = []
  const forwards: WaForward[] = []

  const post = (chat: string, id: string, text: string, attachments: WaAttachment[], replyTo?: string): WaMessage => {
    const message: WaMessage = {
      id,
      chat,
      sender: seed.account?.id ?? null,
      senderName: seed.account?.name ?? null,
      fromMe: true,
      timestamp: new Date().toISOString(),
      editedAt: null,
      text,
      replyTo: replyTo ?? null,
      attachments,
    }
    sent.push(message)
    return message
  }

  const engine: FakeEngine = {
    ...fakeGroups(seed, chats),
    sent,
    actions,
    uploads,
    downloads,
    forwards,
    closed: false,
    loggedOut: false,
    push,
    self: () => self,
    ready: async () => {},
    me: async () => {
      if (!seed.account) throw new EngineError("authentication_error", "not linked")
      return { jid: seed.account.id, name: seed.account.name }
    },
    directory: async () => chats,
    chat: async (jid) => {
      const chat = chats.find((one) => one.jid === jid)
      if (!chat) throw new EngineError("not_found", `no chat ${jid}`)
      return { chat, members: contactsOf(jid) }
    },
    send: async ({ chat, text, id, replyTo }) => {
      const again = sent.find((message) => message.id === id && message.chat === chat)
      if (again) return again
      const message: WaMessage = {
        id,
        chat,
        sender: seed.account?.id ?? null,
        senderName: seed.account?.name ?? null,
        fromMe: true,
        timestamp: new Date().toISOString(),
        editedAt: null,
        text,
        replyTo: replyTo ?? null,
      }
      sent.push(message)
      return message
    },
    edit: async (key, text) => {
      actions.push({ op: "edit", key, text })
      const now = new Date().toISOString()
      return {
        id: key.id,
        chat: key.chat,
        sender: seed.account?.id ?? null,
        senderName: seed.account?.name ?? null,
        fromMe: true,
        timestamp: now,
        editedAt: now,
        text,
        replyTo: null,
      }
    },
    revoke: async (key) => {
      actions.push({ op: "revoke", key })
    },
    react: async (key, emoji) => {
      actions.push({ op: "react", key, emoji })
    },
    markRead: async (key) => {
      actions.push({ op: "read", key })
    },
    sendMedia: async ({ chat, text, id, replyTo, file }) => {
      const again = sent.find((message) => message.id === id && message.chat === chat)
      if (again) return again
      const size = statSync(file.path).size
      uploads.push({ kind: file.kind, name: file.name, size })
      const { kind, media } = UPLOADED[file.kind] as (typeof UPLOADED)[string]
      const ref = { media, directPath: `/v/fake/${id}`, mediaKey: Buffer.from(id).toString("base64") }
      return post(chat, id, text, [{ kind, size, ...(kind === "document" ? { name: file.name } : {}), ref }], replyTo)
    },
    download: async (attachment, path) => {
      if (!attachment.ref) throw new EngineError("validation_error", "the store does not hold this file's keys")
      downloads.push(attachment)
      writeFileSync(path, syntheticBytes(attachment), { mode: 0o600, flag: "wx" })
    },
    forward: async (request) => {
      const again = sent.find((message) => message.id === request.id && message.chat === request.chat)
      if (again) return again
      forwards.push(request)
      return post(request.chat, request.id, request.text, request.attachment ? [request.attachment] : [])
    },
    link: async (request, onCode) => {
      if (!seed.account) throw new EngineError("authentication_error", "not linked")
      if (self === null) {
        onCode({ login: request.method === "qr" ? "qr" : "pair", code: "FAKECODE" })
        self = seed.account.id
        setImmediate(pushHistory)
      }
      return { jid: seed.account.id, name: seed.account.name }
    },
    logout: async () => {
      engine.loggedOut = true
      self = null
    },
    listen: (kinds, onEvent) => hub.listen(kinds, onEvent),
    close: async () => {
      engine.closed = true
    },
  }
  return engine
}
