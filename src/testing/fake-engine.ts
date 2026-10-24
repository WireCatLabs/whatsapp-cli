import { createHash } from "node:crypto"
import { statSync, writeFileSync } from "node:fs"
import type { Chat, Message } from "@wirecat/cli-core"
import type { IdMaker, Seed } from "@wirecat/cli-core/testing"
import * as v from "valibot"
import { isFile, toWaAttachment } from "../adapter/map.js"
import type { WaChannel } from "../engine/channels.js"
import {
  EngineError,
  type EngineEvent,
  engineEvent,
  type WaAnchor,
  type WaAttachment,
  type WaChat,
  type WaContact,
  type WaForward,
  type WaKey,
  type WaMessage,
  type WaSend,
  type WhatsAppEngine,
  waPoll,
} from "../engine/contract.js"
import { eventHub } from "../engine/events.js"
import type { WaPrivacy } from "../engine/privacy.js"
import type { WaProfileChange } from "../engine/settings.js"
import { type FakeChannels, fakeChannels } from "./fake-channels.js"
import { type FakeGroups, fakeGroups } from "./fake-groups.js"
import { type FakePrivacy, fakePrivacy } from "./fake-privacy.js"

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
  ...(chat.unreadCount === null ? {} : { unread: chat.unreadCount }),
  ...(chat.lastMessageAt === null ? {} : { lastMessageAt: chat.lastMessageAt }),
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
  ...(message.threadId === undefined ? {} : { thread: message.threadId }),
  ...(message.attachments.length === 0
    ? {}
    : { attachments: message.attachments.flatMap((one) => toWaAttachment(one) ?? []) }),
  ...(message.providerMetadata?.poll === undefined ? {} : { poll: v.parse(waPoll, message.providerMetadata.poll) }),
})

const UPLOADED: Record<
  string,
  { kind: WaAttachment["kind"]; media: "image" | "video" | "audio" | "document" | "sticker" }
> = {
  photo: { kind: "photo", media: "image" },
  video: { kind: "video", media: "video" },
  voice: { kind: "voice", media: "audio" },
  document: { kind: "document", media: "document" },
  sticker: { kind: "sticker", media: "sticker" },
}

/** The bytes the fake engine "downloads": synthetic, named after the file's kind. */
export const syntheticBytes = (attachment: WaAttachment): Buffer => Buffer.from(`synthetic ${attachment.kind} bytes`)

/**
 * Files WhatsApp no longer keeps, by their direct path, and each time the phone was asked to upload one again. Shared
 * by the engines of several runs, as the phone and WhatsApp's servers outlive each one.
 */
export interface ExpiredFiles {
  paths: Set<string>
  asked: WaKey[]
  /** The checksums of a copy the phone encrypted again; without them the new copy is the stored one. */
  reencrypted?: { fileSha256: string; fileEncSha256: string }
}

export interface FakeEngine extends WhatsAppEngine, FakeGroups, FakePrivacy, FakeChannels {
  /** Pushes an event as the engine would, checked against the contract first. */
  push(event: EngineEvent): void
  sent: WaMessage[]
  /** Each send and file send, as the adapter asked for it. */
  sends: WaSend[]
  /** Each file sent, as the engine read it from disk. */
  uploads: { kind: string; name: string; size: number }[]
  /** Each file written for a download, by the attachment it was asked for. */
  downloads: WaAttachment[]
  /** The message each download named, for the engine to ask the phone about a file WhatsApp no longer keeps. */
  downloadKeys: WaKey[]
  forwards: WaForward[]
  /** Each request for older history, by the anchor and count it was asked with. */
  olderAsked: { anchor: WaAnchor; count: number }[]
  /** Every edit, deletion, reaction, star, read receipt, vote and pin, in order, with the key it was addressed by. */
  actions: {
    op: "edit" | "revoke" | "deleteForMe" | "react" | "read" | "vote" | "pin" | "unpin" | "star"
    /** A deletion for the account alone also carries the message's time. */
    key: WaKey | WaAnchor
    text?: string
    emoji?: string | null
    answers?: string[]
    duration?: number
    starred?: boolean
  }[]
  /** Each mute and unmute, in order. */
  mutes: { jid: string; until: string | null }[]
  /** Each change of the own name, about or photo, in order; the photo's path is a temporary one, so only its presence. */
  profileChanges: (Omit<WaProfileChange, "path"> & { photo?: true })[]
  /** Each chat deletion and clear, in order, with the newest message it was bounded by. */
  chatDeletions: { op: "deleteChat" | "clearChat"; last: WaAnchor }[]
  /** Each archive and unarchive, in order, with the newest message it was bounded by. */
  archives: { last: WaAnchor; archived: boolean }[]
  /** Each chat pin and unpin, in order; not message pins. */
  chatPins: { jid: string; pinned: boolean }[]
  /** Each chat marked unread, by the newest message it was bounded by. */
  markedUnread: WaAnchor[]
  /** Each read patch, by the message it was bounded by; the read receipts are in `actions`. */
  markedRead: WaAnchor[]
  /** Each `storedChats` request, by the chat ids it carried. */
  storedAsked: string[][]
  /** Each `storedChats` request's recipient ids, empty when it carried none. */
  recipientsAsked: string[][]
  /** Each id `canonicalChat` was asked for. */
  canonicalAsked: string[]
  contactWrites: { jid: string; contactName: string; firstName?: string; phonebook?: boolean }[]
  closed: boolean
  loggedOut: boolean
}

/**
 * The engine in memory, filled from cli-core's contract seed. It pushes the seed's history once, as the phone does
 * right after linking, and drops a repeated message id as WhatsApp does. `phone` is what the phone still holds and
 * sends when asked for older history; without it the phone is offline and every such request times out. With
 * `channel`, the account follows one channel in that role; the directory names it, and connecting pushes it as the
 * Go engine does. A download of a path in `expired` asks the phone, which uploads it again under a new path. `lids` is
 * the LID map whatsmeow holds, by phone-form chat: a stored chat in it is re-keyed as `storedChats` names it.
 */
export const fakeEngine = (
  seed: Seed,
  {
    linked = true,
    phone,
    privacy,
    settingsKeys = true,
    channel,
    expired,
    lids = {},
  }: {
    linked?: boolean
    phone?: WaMessage[]
    privacy?: WaPrivacy
    settingsKeys?: boolean
    channel?: WaChannel["role"]
    expired?: ExpiredFiles
    lids?: Record<string, string>
  } = {},
): FakeEngine => {
  const hub = eventHub()
  let self = linked ? (seed.account?.id ?? null) : null
  const chats = seed.chats.map(waChatOf)
  const messages = seed.messages.map(waMessageOf)
  const contactsOf = (jid: string): WaContact[] | null =>
    seed.members[jid]?.map((member) => ({ jid: member.id, name: member.name })) ?? null
  const sent: WaMessage[] = []
  const sends: WaSend[] = []

  const push = (event: EngineEvent) => hub.emit(v.parse(engineEvent, event))

  const pushHistory = () =>
    push({
      event: "history",
      history: {
        kind: "bootstrap",
        chats,
        contacts: seed.people.map((person) => ({ jid: person.id, name: person.name })),
        messages,
        votes: [],
      },
    })

  if (linked) pushHistory()

  const actions: FakeEngine["actions"] = []
  const uploads: FakeEngine["uploads"] = []
  const downloads: WaAttachment[] = []
  const downloadKeys: WaKey[] = []
  const forwards: WaForward[] = []
  const olderAsked: FakeEngine["olderAsked"] = []
  const mutes: FakeEngine["mutes"] = []
  const profileChanges: FakeEngine["profileChanges"] = []
  let ownName = seed.account?.name ?? null
  const chatDeletions: FakeEngine["chatDeletions"] = []
  const archives: FakeEngine["archives"] = []
  const chatPins: FakeEngine["chatPins"] = []
  const markedUnread: WaAnchor[] = []
  const markedRead: WaAnchor[] = []
  const storedAsked: string[][] = []
  const recipientsAsked: string[][] = []
  const canonicalAsked: string[] = []
  const keysMissing = () =>
    new EngineError(
      "provider_unavailable",
      "WhatsApp has not sent the settings keys yet; keep serve running a few minutes and try again",
      "settings.keys-missing",
    )

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

  const channels = fakeChannels(channel)
  let channelsPushed = false
  // As the Go engine, which asks WhatsApp for the followed channels only once connected.
  let connected = false

  const engine: FakeEngine = {
    ...fakeGroups(seed, chats),
    commentGroup: async (jid) => {
      if (!seed.chats.some((chat) => chat.id === jid && chat.providerMetadata?.announcement === true))
        throw new EngineError("validation_error", "comments exist only in community announcement groups")
      return true
    },
    contactWrites: [],
    saveContact: async (jid, contactName, options = {}) => {
      engine.contactWrites.push({ jid, contactName, ...options })
    },
    folders: async () => [],
    devices: async () => [
      { id: 0, current: false },
      { id: 7, current: true },
    ],
    inspect: async (link) => {
      const channelLink = /^https:\/\/whatsapp\.com\/channel\/([A-Za-z0-9]+)$/.exec(link)
      const groupLink = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(link)
      if (!channelLink && !groupLink) throw new EngineError("validation_error", "not a WhatsApp invite link")
      const chat = chats.find((one) => one.kind === (channelLink ? "newsletter" : "group"))
      if (!chat) throw new EngineError("not_found", "WhatsApp has no such chat")
      return {
        jid: chat.jid,
        kind: channelLink ? "newsletter" : "group",
        name: chat.name ?? null,
        description: null,
        participants: chat.participants ?? null,
        member: null,
        approval: false,
      }
    },
    ...fakePrivacy(privacy),
    ...channels,
    sent,
    sends,
    actions,
    uploads,
    downloads,
    downloadKeys,
    forwards,
    olderAsked,
    mutes,
    profileChanges,
    chatDeletions,
    archives,
    chatPins,
    markedUnread,
    markedRead,
    storedAsked,
    recipientsAsked,
    canonicalAsked,
    closed: false,
    loggedOut: false,
    push,
    self: () => self,
    ready: async () => {
      connected = true
      const followed = channels.followed()
      if (!channelsPushed && followed.length > 0) {
        channelsPushed = true
        push({ event: "history", history: { kind: "other", chats: followed, contacts: [], messages: [], votes: [] } })
      }
    },
    me: async () => {
      if (!seed.account) throw new EngineError("authentication_error", "not linked")
      return { jid: seed.account.id, name: ownName }
    },
    directory: async () => [...chats, ...(connected ? channels.followed() : [])],
    chat: async (jid) => {
      const chat = chats.find((one) => one.jid === jid)
      if (!chat) throw new EngineError("not_found", `no chat ${jid}`)
      return { chat, members: contactsOf(jid) }
    },
    send: async (request) => {
      const { chat, text, id, replyTo } = request
      sends.push(request)
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
    sendMedia: async (request) => {
      const { chat, text, id, replyTo, file } = request
      sends.push(request)
      const again = sent.find((message) => message.id === id && message.chat === chat)
      if (again) return again
      const size = statSync(file.path).size
      uploads.push({ kind: file.kind, name: file.name, size })
      const { kind, media } = UPLOADED[file.kind] as (typeof UPLOADED)[string]
      const key = chat.endsWith("@newsletter") ? {} : { mediaKey: Buffer.from(id).toString("base64") }
      const ref = { media, directPath: `/v/fake/${id}`, url: `https://mmg.whatsapp.net/v/fake/${id}`, ...key }
      return post(chat, id, text, [{ kind, size, ...(kind === "document" ? { name: file.name } : {}), ref }], replyTo)
    },
    sendAlbum: async (request) => {
      const { chat, text, id, replyTo, files } = request
      sends.push(request)
      const again = sent.find((message) => message.id === id && message.chat === chat)
      if (again) return again
      const attachments = files.map((file, position) => {
        const size = statSync(file.path).size
        uploads.push({ kind: file.kind, name: file.name, size })
        const { kind, media } = UPLOADED[file.kind] as (typeof UPLOADED)[string]
        return { kind, size, ref: { media, directPath: `/v/fake/${id}/${position}`, mediaKey: "AAAA" } }
      })
      return post(chat, id, text, attachments.slice(0, 1), replyTo)
    },
    download: async (attachment, path, key) => {
      if (!isFile(attachment)) throw new EngineError("validation_error", "the store does not hold this file's keys")
      downloads.push(attachment)
      downloadKeys.push(key)
      writeFileSync(path, syntheticBytes(attachment), { mode: 0o600, flag: "wx" })
      if (!expired?.paths.has(attachment.ref.directPath)) return null
      expired.asked.push(key)
      return { directPath: `${attachment.ref.directPath}-reuploaded`, ...expired.reencrypted }
    },
    forward: async (request) => {
      const again = sent.find((message) => message.id === request.id && message.chat === request.chat)
      if (again) return again
      forwards.push(request)
      return post(request.chat, request.id, request.text, request.attachment ? [request.attachment] : [])
    },
    older: async (anchor, count) => {
      olderAsked.push({ anchor, count })
      if (!phone) throw new EngineError("timeout", "the phone did not send older messages in time")
      const before = phone
        .filter((message) => message.chat === anchor.chat && message.timestamp < anchor.timestamp)
        .sort((one, other) => one.timestamp.localeCompare(other.timestamp))
        .slice(-count)
      return { messages: before, more: before.length > 0 }
    },
    createPoll: async ({ chat, id, question, answers, multiple }) => {
      const again = sent.find((message) => message.id === id && message.chat === chat)
      if (again) return again
      const message = post(chat, id, question, [])
      message.poll = {
        question,
        answers: answers.map((text) => ({ id: createHash("sha256").update(text).digest("hex").slice(0, 8), text })),
        multiple,
      }
      return message
    },
    vote: async (key, answers) => {
      actions.push({ op: "vote", key, answers })
    },
    pin: async (key, duration) => {
      actions.push({ op: "pin", key, ...(duration === undefined ? {} : { duration }) })
    },
    unpin: async (key) => {
      actions.push({ op: "unpin", key })
    },
    mute: async (jid, until) => {
      if (!settingsKeys)
        throw new EngineError(
          "provider_unavailable",
          "WhatsApp has not sent the settings keys yet; keep serve running a few minutes and try again",
          "settings.keys-missing",
        )
      mutes.push({ jid, until })
    },
    updateProfile: async (change) => {
      if (!seed.account) throw new EngineError("authentication_error", "not linked")
      if (change.pushName !== undefined && !settingsKeys)
        throw new EngineError(
          "provider_unavailable",
          "WhatsApp has not sent the settings keys yet; keep serve running a few minutes and try again",
          "settings.keys-missing",
        )
      const { path, ...named } = change
      profileChanges.push(path === undefined ? named : { ...named, photo: true })
      if (change.pushName !== undefined) ownName = change.pushName
      return { jid: seed.account.id, name: ownName }
    },
    deleteChat: async (last) => {
      if (!settingsKeys) throw keysMissing()
      chatDeletions.push({ op: "deleteChat", last })
    },
    clearChat: async (last) => {
      if (!settingsKeys) throw keysMissing()
      chatDeletions.push({ op: "clearChat", last })
    },
    deleteForMe: async (message) => {
      if (!settingsKeys) throw keysMissing()
      actions.push({ op: "deleteForMe", key: message })
    },
    star: async (message, starred) => {
      if (!settingsKeys) throw keysMissing()
      actions.push({ op: "star", key: message, starred })
    },
    archiveChat: async (last, archived) => {
      if (!settingsKeys) throw keysMissing()
      archives.push({ last, archived })
    },
    pinChat: async (jid, pinned) => {
      if (!settingsKeys) throw keysMissing()
      chatPins.push({ jid, pinned })
    },
    markChatRead: async (last) => {
      if (!settingsKeys) throw keysMissing()
      markedRead.push(last)
    },
    markChatUnread: async (last) => {
      if (!settingsKeys) throw keysMissing()
      markedUnread.push(last)
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
    canonicalChat: async (jid) => {
      canonicalAsked.push(jid)
      return lids[jid] ?? jid
    },
    storedChats: async (chats, recipients = []) => {
      storedAsked.push(chats)
      recipientsAsked.push(recipients)
      for (const chat of [...chats, ...recipients]) {
        const lid = lids[chat]
        if (lid) push({ event: "rekey", from: chat, to: lid })
      }
    },
    listen: (kinds, onEvent) => hub.listen(kinds, onEvent),
    close: async () => {
      engine.closed = true
    },
  }
  return engine
}
