import type { Account, Attachment, Chat, ChatEvent, ChatKind, ChatUpdate, Member, Message } from "@wirecat/cli-core"
import * as v from "valibot"
import {
  type WaAccount,
  type WaAttachment,
  type WaChat,
  type WaChatEvent,
  type WaContact,
  type WaMediaRef,
  type WaMessage,
  waAttachment,
  waMediaRef,
} from "../engine/contract.js"

const KINDS: Record<WaChat["kind"], ChatKind> = {
  dm: "dialog",
  self: "saved",
  group: "group",
  newsletter: "channel",
  broadcast: "unknown",
}

/** A pushed chat as the store saves it: what the engine left out keeps the stored value. */
export const toChatUpdate = (chat: WaChat): ChatUpdate => ({
  id: chat.jid,
  ...(chat.name === undefined ? {} : { title: chat.name }),
  kind: KINDS[chat.kind],
  ...(chat.unread === undefined ? {} : { unreadCount: chat.unread }),
  ...(chat.lastMessageAt === undefined ? {} : { lastMessageAt: chat.lastMessageAt }),
  ...(chat.participants === undefined ? {} : { participantsCount: chat.participants }),
  ...(chat.membershipState === undefined ? {} : { membershipState: chat.membershipState }),
  ...rest(chat),
})

export const toChat = (chat: WaChat): Chat => ({
  id: chat.jid,
  title: chat.name ?? null,
  kind: KINDS[chat.kind],
  unreadCount: chat.unread ?? null,
  lastMessageAt: chat.lastMessageAt ?? null,
  participantsCount: chat.participants ?? null,
  ...rest(chat),
})

const rest = (chat: WaChat) => ({
  ...(chat.archived === undefined ? {} : { archived: chat.archived }),
  ...(chat.muted === undefined ? {} : { muted: chat.muted }),
  // cli-core has a parent chat but no kind of chat that holds groups, so a community is a group marked as one.
  ...(chat.parent === undefined ? {} : { parentChatId: chat.parent }),
  ...(chat.community ? { providerMetadata: { community: true } } : {}),
})

// WhatsApp has no public handle, and the engine never answers the phone number.
export const toAccount = (account: WaAccount): Account => ({ id: account.jid, name: account.name, username: null })

export const toMember = (contact: WaContact): Member => ({ id: contact.jid, name: contact.name, username: null })

export const toChatEvent = ({ id, timestamp, event, by, byName, people, title }: WaChatEvent): ChatEvent => ({
  messageId: id,
  timestamp,
  event,
  by: { id: by, name: byName },
  people: people.map(({ jid, name }) => ({ id: jid, name })),
  ...(title === undefined ? {} : { title }),
})

// In the domain type's order, so an answer from the store prints byte for byte the same.
export const toAttachment = ({ kind, url, width, height, title, name, size, mime, duration, ref }: WaAttachment) => {
  const attachment: Attachment = { kind }
  if (url !== undefined) attachment.url = url
  if (width !== undefined) attachment.width = width
  if (height !== undefined) attachment.height = height
  if (title !== undefined) attachment.title = title
  if (name !== undefined) attachment.name = name
  if (size !== undefined) attachment.size = size
  if (mime !== undefined) attachment.mime = mime
  if (duration !== undefined) attachment.duration = duration
  if (ref !== undefined) attachment.providerRef = ref
  return attachment
}

export const toMessage = (message: WaMessage): Message => ({
  id: message.id,
  chatId: message.chat,
  senderId: message.sender,
  senderName: message.senderName,
  timestamp: message.timestamp,
  editedAt: message.editedAt,
  text: message.text,
  outgoing: message.fromMe,
  attachments: message.attachments?.map(toAttachment) ?? [],
  replyTo: null,
  ...(message.replyTo === null ? {} : { replyToId: message.replyTo }),
  forwardedFrom: null,
  reactions: null,
  // Kept with the message in the store: a vote names answers by text, and only the poll's message has them; a
  // channel's history is read back from a post's server id. A call is a service message, `action: "call"`, as tg
  // stores one, which keeps it out of a chat's `stats`.
  ...(message.poll === undefined && message.serverId === undefined && message.call === undefined
    ? {}
    : {
        providerMetadata: {
          ...(message.poll === undefined ? {} : { poll: message.poll }),
          ...(message.serverId === undefined ? {} : { serverId: message.serverId }),
          ...(message.call === undefined ? {} : { action: "call", ...message.call }),
        },
      }),
  ...(message.starred ? { starred: true } : {}),
})

/** Whether an attachment holds a file's keys, not a place or a contact card. */
export const isFile = (attachment: WaAttachment | undefined): attachment is WaAttachment & { ref: WaMediaRef } =>
  attachment?.ref !== undefined && "directPath" in attachment.ref

/**
 * Whether two refs name one file, wherever each says it is: the phone keeps a file's key when it uploads it again, but
 * may encrypt it again, which changes both checksums. A keyless file (a channel's) is never uploaded again, and
 * without keys two of them cannot be told apart.
 */
export const sameFile = (one: unknown, other: unknown): boolean => {
  const [a, b] = [v.safeParse(waMediaRef, one), v.safeParse(waMediaRef, other)]
  if (!a.success || !b.success || a.output.mediaKey === undefined) return false
  return a.output.media === b.output.media && a.output.mediaKey === b.output.mediaKey
}

/** A stored attachment as the engine takes it back, or `undefined` when it is not one this engine wrote. */
export const toWaAttachment = ({ providerRef, ...attachment }: Attachment): WaAttachment | undefined => {
  const parsed = v.safeParse(waAttachment, {
    kind: attachment.kind,
    ...Object.fromEntries(
      (["url", "width", "height", "title", "name", "size", "mime", "duration"] as const)
        .filter((field) => attachment[field] !== undefined && attachment[field] !== null)
        .map((field) => [field, attachment[field]]),
    ),
    ...(providerRef ? { ref: providerRef } : {}),
  })
  return parsed.success ? parsed.output : undefined
}
