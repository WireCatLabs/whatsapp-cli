import type { Chat, ChatKind, Member, Message } from "@wirecat/cli-core"
import type { WaChat, WaContact, WaMessage } from "../engine/contract.js"

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
})

export const toMember = (contact: WaContact): Member => ({ id: contact.jid, name: contact.name, username: null })

export const toMessage = (message: WaMessage): Message => ({
  id: message.id,
  chatId: message.chat,
  senderId: message.sender,
  senderName: message.senderName,
  timestamp: message.timestamp,
  editedAt: message.editedAt,
  text: message.text,
  outgoing: message.fromMe,
  attachments: [],
  replyTo: null,
  ...(message.replyTo === null ? {} : { replyToId: message.replyTo }),
  forwardedFrom: null,
  reactions: null,
})
