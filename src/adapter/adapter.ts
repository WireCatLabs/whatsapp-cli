import { randomBytes } from "node:crypto"
import { CliError } from "@wirecat/cli-base"
import type { Chat, Message, MessageEvent, MessageHit } from "@wirecat/cli-core"
import type { LiveUpdates, MessengerCore, PushedHistory, SendOptions } from "@wirecat/cli-core/cli"
import {
  type ConnectionState,
  EngineError,
  type EngineEvent,
  type WaChat,
  type WhatsAppEngine,
} from "../engine/contract.js"
import { toChat, toMember, toMessage } from "./map.js"

export type WhatsAppAdapter = MessengerCore & LiveUpdates & PushedHistory

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

export const whatsAppAdapter = (engine: WhatsAppEngine): WhatsAppAdapter => {
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

    logout: () => translated(engine.logout()),

    close: () => engine.close(),

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
