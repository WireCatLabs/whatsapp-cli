import type { Chat, Message } from "@wirecat/cli-core"
import type { IdMaker, Seed } from "@wirecat/cli-core/testing"
import * as v from "valibot"
import {
  EngineError,
  type EngineEvent,
  engineEvent,
  type WaChat,
  type WaContact,
  type WaMessage,
  type WhatsAppEngine,
} from "../engine/contract.js"
import { eventHub } from "../engine/events.js"

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
})

export interface FakeEngine extends WhatsAppEngine {
  /** Pushes an event as the engine would, checked against the contract first. */
  push(event: EngineEvent): void
  sent: WaMessage[]
  closed: boolean
}

/**
 * The engine in memory, filled from cli-core's contract seed. It pushes the seed's history once, as the phone does
 * right after linking, and drops a repeated message id as WhatsApp does.
 */
export const fakeEngine = (seed: Seed): FakeEngine => {
  const hub = eventHub()
  const chats = seed.chats.map(waChatOf)
  const messages = seed.messages.map(waMessageOf)
  const contactsOf = (jid: string): WaContact[] | null =>
    seed.members[jid]?.map((member) => ({ jid: member.id, name: member.name })) ?? null
  const sent: WaMessage[] = []

  const push = (event: EngineEvent) => hub.emit(v.parse(engineEvent, event))

  push({
    event: "history",
    history: {
      kind: "bootstrap",
      chats,
      contacts: seed.people.map((person) => ({ jid: person.id, name: person.name })),
      messages,
    },
  })

  const engine: FakeEngine = {
    sent,
    closed: false,
    push,
    self: () => seed.account?.id ?? null,
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
    logout: async () => {},
    listen: (kinds, onEvent) => hub.listen(kinds, onEvent),
    close: async () => {
      engine.closed = true
    },
  }
  return engine
}
