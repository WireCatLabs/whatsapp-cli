import { randomBytes } from "node:crypto"
import { CliError } from "@wirecat/cli-base"
import type { Chat, Message, MessageEvent, MessageHit } from "@wirecat/cli-core"
import type {
  LiveUpdates,
  MessageEditing,
  MessageReactions,
  MessengerCore,
  PushedHistory,
  ReadState,
  SendOptions,
} from "@wirecat/cli-core/cli"
import {
  type ConnectionState,
  EngineError,
  type EngineEvent,
  type WaChat,
  type WaKey,
  type WhatsAppEngine,
} from "../engine/contract.js"
import { toChat, toMember, toMessage } from "./map.js"

export type WhatsAppAdapter = MessengerCore &
  LiveUpdates &
  PushedHistory &
  Pick<MessageEditing, "edit" | "delete"> &
  MessageReactions &
  Pick<ReadState, "markRead">

/**
 * The messages cli-core's store holds, by the account's own key. WhatsApp addresses a message by its sender and by
 * whether it is the account's own, and the engine keeps no messages, so an edit, a deletion, a reaction or a read
 * receipt looks the message up here first.
 */
export interface StoredMessages {
  message(chatId: string, messageId: string): Promise<Message | undefined>
  /** The newest message from someone else in the chat, older than `before` when it is given. */
  newestIncoming(chatId: string, before?: string): Promise<Message | undefined>
  close(): Promise<void>
}

const NOTHING_STORED: StoredMessages = {
  message: async () => undefined,
  newestIncoming: async () => undefined,
  close: async () => {},
}

// whatsmeow's EditWindow: WhatsApp clients ignore an edit that comes later.
const EDIT_WINDOW_MS = 20 * 60 * 1000

/** Options WhatsApp has no way to honour; `noPreview` is always true, since nothing here builds link previews. */
const REFUSED: (keyof SendOptions)[] = [
  "threadId",
  "silent",
  "markup",
  "formatting",
  "at",
  "attachments",
  "sticker",
  "spoiler",
  "captionAbove",
  "sendAs",
]

const translated = async <T>(work: Promise<T>): Promise<T> => {
  try {
    return await work
  } catch (error) {
    if (error instanceof EngineError) throw new CliError(error.code, error.message)
    throw error
  }
}

const hit = (chat: WaChat | undefined, message: Message): MessageHit => ({ ...message, chatTitle: chat?.name ?? null })

const ENDED: Partial<Record<ConnectionState, () => CliError>> = {
  logged_out: () =>
    new CliError("authentication_error", "WhatsApp logged this device out — log in again with `session start`"),
  replaced: () =>
    new CliError("provider_unavailable", "another process took over this WhatsApp login; only one may hold it"),
  banned: () => new CliError("permission_error", "WhatsApp has banned or restricted this account; see the phone"),
  outdated: () => new CliError("provider_unavailable", "WhatsApp no longer accepts this version of wa; update it"),
  stopped: () => new CliError("provider_unavailable", "the WhatsApp engine stopped unexpectedly"),
}

/** Hands each event on until `signal` aborts; a connection WhatsApp ended rejects with why. */
const listening = (
  engine: WhatsAppEngine,
  kinds: readonly EngineEvent["event"][],
  signal: AbortSignal,
  onEvent: (event: EngineEvent) => void,
): { done: Promise<void>; stop: () => void } => {
  let stop = () => {}
  const done = new Promise<void>((resolve, reject) => {
    const unlisten = engine.listen(kinds, (event) => {
      const ended = event.event === "connection" ? ENDED[event.state]?.() : undefined
      if (ended) reject(ended)
      else onEvent(event)
    })
    const aborted = () => resolve()
    signal.addEventListener("abort", aborted, { once: true })
    stop = () => {
      unlisten()
      signal.removeEventListener("abort", aborted)
    }
    if (signal.aborted) resolve()
  })
  return { done, stop }
}

const keyOf = (chatId: string, message: Message): WaKey => ({
  chat: chatId,
  id: message.id,
  fromMe: message.outgoing === true,
  sender: message.senderId,
})

export const whatsAppAdapter = (engine: WhatsAppEngine, stored: StoredMessages = NOTHING_STORED): WhatsAppAdapter => {
  // A guessed key would make WhatsApp drop the change without a word, so a message the store lacks is refused.
  const held = async (chatId: string, messageId: string): Promise<Message> => {
    const message = await stored.message(chatId, messageId)
    if (!message)
      throw new CliError(
        "not_found",
        "that message is not in the local store, and WhatsApp needs its sender to address it; `serve` keeps the store filled",
      )
    return message
  }

  const titled = async (): Promise<Map<string, WaChat>> =>
    new Map((await translated(engine.directory())).map((chat) => [chat.jid, chat]))

  return {
    self: () => engine.self(),

    newSendId: () => `3EB0${randomBytes(9).toString("hex").toUpperCase()}`,

    me: async () => {
      const account = await translated(engine.me())
      return { id: account.jid, name: account.name, username: null }
    },

    resolve: async (query: string): Promise<Chat> => {
      const chats = await titled()
      const byId = chats.get(query)
      if (byId) return toChat(byId)
      if (query.includes("@"))
        return {
          id: query,
          title: null,
          kind: "unknown",
          unreadCount: null,
          lastMessageAt: null,
          participantsCount: null,
        }
      const named = [...chats.values()].filter((chat) => chat.name === query)
      if (named.length === 1 && named[0]) return toChat(named[0])
      if (named.length > 1)
        throw new CliError(
          "validation_error",
          `${named.length} chats share that name — name one by its id; \`chats list\` shows them`,
        )
      throw new CliError("not_found", "no chat by that name or id; `chats list` shows the chats this profile has")
    },

    chat: async (jid: string) => {
      const card = await translated(engine.chat(jid))
      return { ...toChat(card.chat), members: card.members?.map(toMember) ?? null }
    },

    send: async (chatId: string, text: string, options: SendOptions) => {
      const refused = REFUSED.filter((option) => options[option] !== undefined && options[option] !== false)
      if (refused.length > 0) throw new CliError("validation_error", `WhatsApp cannot send with ${refused.join(", ")}`)
      const message = await translated(
        engine.send({
          chat: chatId,
          text,
          id: options.sendId,
          ...(options.replyTo === undefined ? {} : { replyTo: options.replyTo }),
        }),
      )
      return { message: toMessage(message), sendId: options.sendId }
    },

    edit: async (chatId, messageId, text, { markup, formatting }) => {
      if (markup !== undefined || formatting !== undefined)
        throw new CliError("validation_error", "WhatsApp edits plain text only here; leave out --md")
      const original = await held(chatId, messageId)
      if (!original.outgoing) throw new CliError("validation_error", "only your own messages can be edited")
      if (Date.now() - Date.parse(original.timestamp) > EDIT_WINDOW_MS)
        throw new CliError("validation_error", "WhatsApp takes an edit only within 20 minutes of sending")
      const edited = await translated(engine.edit(keyOf(chatId, original), text))
      return { ...original, text: edited.text, editedAt: edited.editedAt }
    },

    delete: async (chatId, messageIds, { forEveryone }) => {
      if (!forEveryone)
        throw new CliError(
          "validation_error",
          "wa deletes only for everyone so far; add --for-everyone, or delete it for you on the phone",
        )
      const messages = await Promise.all(messageIds.map((id) => held(chatId, id)))
      for (const message of messages) await translated(engine.revoke(keyOf(chatId, message)))
    },

    react: async (chatId, messageId, emoji) => {
      const message = await held(chatId, messageId)
      await translated(engine.react(keyOf(chatId, message), emoji))
    },

    // One receipt, for the newest message from someone else up to `until`: the account's own messages have none.
    markRead: async (chatId, until) => {
      const anchor = until === undefined ? undefined : await held(chatId, until)
      const target = anchor && !anchor.outgoing ? anchor : await stored.newestIncoming(chatId, until)
      if (target) await translated(engine.markRead(keyOf(chatId, target)))
    },

    logout: () => translated(engine.logout()),

    close: async () => {
      await Promise.all([engine.close(), stored.close()])
    },

    watch: async (onEvent: (event: MessageEvent) => void, signal: AbortSignal, onReady?: () => void) => {
      const chats = await titled()
      const live = listening(engine, ["message", "edit", "delete", "connection"], signal, (event) => {
        if (event.event === "message" || event.event === "edit")
          onEvent({ event: event.event, message: hit(chats.get(event.message.chat), toMessage(event.message)) })
        else if (event.event === "delete")
          onEvent({
            event: "delete",
            chatId: event.chat,
            chatTitle: chats.get(event.chat)?.name ?? null,
            messageId: event.id,
          })
      })
      try {
        await translated(engine.ready(signal))
        if (!signal.aborted) onReady?.()
        await live.done
      } finally {
        live.stop()
      }
    },

    feed: async (onBatch, signal) => {
      const pushes = listening(engine, ["history", "connection"], signal, (event) => {
        if (event.event !== "history") return
        const { chats, contacts, messages } = event.history
        onBatch({ chats: chats.map(toChat), people: contacts.map(toMember), messages: messages.map(toMessage) })
      })
      try {
        await pushes.done
      } finally {
        pushes.stop()
      }
    },
  }
}
