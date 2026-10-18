import type { Attachment, Chat, ChatKind, Member, Message } from "@wirecat/cli-core"
import * as v from "valibot"
import { type WaAttachment, type WaChat, type WaContact, type WaMessage, waAttachment } from "../engine/contract.js"

const KINDS: Record<WaChat["kind"], ChatKind> = {
  dm: "dialog",
  self: "saved",
  group: "group",
  newsletter: "channel",
  broadcast: "unknown",
}

export const toChat = (chat: WaChat): Chat => ({
  id: chat.jid,
  title: chat.name,
  kind: KINDS[chat.kind],
  unreadCount: chat.unread,
  lastMessageAt: chat.lastMessageAt,
  participantsCount: chat.participants,
  ...(chat.archived === undefined ? {} : { archived: chat.archived }),
  ...(chat.muted === undefined ? {} : { muted: chat.muted }),
  // cli-core has a parent chat but no kind of chat that holds groups, so a community is a group marked as one.
  ...(chat.parent === undefined ? {} : { parentChatId: chat.parent }),
  ...(chat.community ? { providerMetadata: { community: true } } : {}),
})

export const toMember = (contact: WaContact): Member => ({ id: contact.jid, name: contact.name, username: null })

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
  // Kept with the message in the store: a vote names answers by text, and only the poll's message has them.
  ...(message.poll === undefined ? {} : { providerMetadata: { poll: message.poll } }),
})

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
