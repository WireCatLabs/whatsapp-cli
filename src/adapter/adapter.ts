import { randomBytes } from "node:crypto"
import { CliError } from "@wirecat/cli-base"
import {
  bareCheck,
  type Chat,
  type MarkdownFormatting,
  type Message,
  parseMarkdownSpans,
  pickChat,
} from "@wirecat/cli-core"
import type {
  LiveUpdates,
  MessageEditing,
  MessageMedia,
  MessagePins,
  MessageReactions,
  MessageStars,
  MessengerCore,
  PassiveUpdates,
  PushedHistory,
  ReadState,
  ServerReads,
  StoredMessages,
} from "@wirecat/cli-core/cli"
import { EngineError, OLDER_MAX, type WaKey, type WhatsAppEngine } from "../engine/contract.js"
import { channelAdapter, channelHistory, channelWrites, isChannel } from "./channels.js"
import type { Words } from "./checks.js"
import { fromEngine } from "./errors.js"
import { toWhatsApp } from "./format-markdown.js"
import { type GroupAdapter, groupAdapter } from "./groups.js"
import { listenAdapter } from "./listen.js"
import { toAccount, toChat, toMember, toMessage } from "./map.js"
import { pinAdapter } from "./pins.js"
import { type PollAdapter, pollAdapter } from "./polls.js"
import { type PrivacyAdapter, privacyAdapter } from "./privacy.js"
import { onDisk, sendAdapter } from "./sends.js"
import { AFTER_EVERY_MESSAGE, type SettingsAdapter, settingsAdapter, settingsWrite } from "./settings.js"

export type WhatsAppAdapter = MessengerCore &
  LiveUpdates &
  PassiveUpdates &
  PushedHistory &
  Pick<MessageEditing, "edit" | "delete" | "forward"> &
  Pick<MessageMedia, "download"> &
  MessageReactions &
  MessageStars &
  ReadState &
  Pick<ServerReads, "history"> &
  MarkdownFormatting &
  PollAdapter &
  GroupAdapter &
  PrivacyAdapter &
  MessagePins &
  SettingsAdapter

// WhatsApp addresses a message by its sender and by whether it is the account's own, and the engine keeps no
// messages, so an edit, a deletion, a reaction or a read receipt looks the message up in cli-core's store first.
const NOTHING_STORED: StoredMessages = {
  message: async () => undefined,
  newestIncoming: async () => undefined,
  anchor: async () => undefined,
  wroteTo: async () => false,
  pollVotes: async () => [],
}

// whatsmeow's EditWindow: WhatsApp clients ignore an edit that comes later.
const EDIT_WINDOW_MS = 20 * 60 * 1000

const translated = async <T>(work: Promise<T>): Promise<T> => {
  try {
    return await work
  } catch (error) {
    if (error instanceof EngineError) throw fromEngine(error)
    if (error instanceof CliError) throw error
    const failure = new CliError("provider_error", "WhatsApp engine request failed")
    Object.defineProperty(failure, "cause", { value: error })
    throw failure
  }
}

const PHONE_CHAT = /^\d+@s\.whatsapp\.net$/

const keyOf = (chatId: string, message: Message): WaKey => ({
  chat: chatId,
  id: message.id,
  fromMe: message.outgoing === true,
  sender: message.senderId,
})

export const whatsAppAdapter = (
  engine: WhatsAppEngine,
  stored: StoredMessages = NOTHING_STORED,
  words: Words = bareCheck,
  /** Where a skipped pushed event is said — a warning, so `--quiet` drops it. The diagnostic stream if not given. */
  warn: (message: string) => void = (line) => process.stderr.write(`${line}\n`),
  now: () => number = Date.now,
): WhatsAppAdapter => {
  // A guessed key would make WhatsApp drop the change without a word, so a message the store lacks is refused.
  const held = async (chatId: string, messageId: string): Promise<Message> => {
    const message = await stored.message(chatId, messageId)
    if (!message)
      throw new CliError(
        "not_found",
        `that message is not in the local store, and WhatsApp needs its sender to address it; ${words("serve")} keeps the store filled`,
      )
    return message
  }
  // A deletion for the account alone, a star and a chat marked read are changes to its synced settings, not messages.
  const synced = settingsWrite(translated, words)

  const core: Omit<
    WhatsAppAdapter,
    keyof (GroupAdapter & PollAdapter & PrivacyAdapter & MessagePins & SettingsAdapter)
  > = {
    ...sendAdapter({ engine, stored, held, keyOf, translated, resolve: (chat) => core.resolve(chat) }),
    ...listenAdapter({ engine, stored, words, warn, translated }),
    formatMarkdown: async (text) => parseMarkdownSpans(text),

    self: () => engine.self(),

    newSendId: () => `3EB0${randomBytes(9).toString("hex").toUpperCase()}`,

    me: async () => toAccount(await translated(engine.me())),

    // A send to a phone-form chat lands under the LID the engine answers, so every later command must address that
    // chat too, or a delete, a star or a vote by the typed number misses the stored message (§5).
    resolve: async (query: string): Promise<Chat> => {
      if (query.includes("@"))
        return {
          id: PHONE_CHAT.test(query) ? await translated(engine.canonicalChat(query)) : query,
          title: null,
          kind: "unknown",
          unreadCount: null,
          lastMessageAt: null,
          participantsCount: null,
        }
      const directory = (await translated(engine.directory())).map(toChat)
      try {
        return pickChat(query, directory)
      } catch (error) {
        if (!(error instanceof CliError)) throw error
        // cli-core's refusal quotes the typed name and the matching titles; an error here names neither (WC-SECR-6).
        const candidates = error.details.candidates
        if (error.code === "validation_error" && Array.isArray(candidates))
          throw new CliError(
            "validation_error",
            `${candidates.length} chats match that name — name one by its id; ${words("chats.list")} shows them`,
          )
        if (error.code !== "not_found") throw error
        throw new CliError(
          "not_found",
          `no chat by that name or id; ${words("chats.list")} shows the chats this profile has`,
        )
      }
    },

    chat: async (jid: string) => {
      const card = await translated(engine.chat(jid))
      return { ...toChat(card.chat), members: card.members?.map(toMember) ?? null }
    },

    edit: async (chatId, messageId, text, { markup, formatting }) => {
      if (markup !== undefined) throw new CliError("validation_error", "WhatsApp cannot edit with markup")
      const original = await held(chatId, messageId)
      if (!original.outgoing) throw new CliError("validation_error", "only your own messages can be edited")
      if (now() - Date.parse(original.timestamp) > EDIT_WINDOW_MS)
        throw new CliError("validation_error", "WhatsApp takes an edit only within 20 minutes of sending")
      const edited = await translated(
        engine.edit(keyOf(chatId, original), formatting ? toWhatsApp(text, formatting) : text),
      )
      return { ...original, text: edited.text, editedAt: edited.editedAt }
    },

    delete: async (chatId, messageIds, { forEveryone }) => {
      const messages = await Promise.all(messageIds.map((id) => held(chatId, id)))
      const done: string[] = []
      for (const message of messages) {
        try {
          if (forEveryone) await translated(engine.revoke(keyOf(chatId, message)))
          else await synced(engine.deleteForMe({ ...keyOf(chatId, message), timestamp: message.timestamp }))
        } catch (error) {
          if (done.length === 0 || !(error instanceof CliError)) throw error
          // One request per message: the ones before this went, so the run as a whole is not unsent (WC-OUT-20).
          const { sent: _, ...details } = error.details
          throw new CliError(
            error.code,
            `deleted ${done.join(", ")}; ${message.id} and any after it were not, or may not have been: ${error.message}`,
            details,
          )
        }
        done.push(message.id)
      }
    },

    react: async (chatId, messageId, emoji) => {
      const message = await held(chatId, messageId)
      await translated(engine.react(keyOf(chatId, message), emoji))
    },

    star: async (chatId, messageId, starred) => {
      const message = await held(chatId, messageId)
      await synced(engine.star(keyOf(chatId, message), starred))
    },

    // The read patch takes a mark-unread off the owner's devices, which a receipt does not; it is bounded by `until`
    // or the newest stored message, either side's, so it names nothing newer than the receipt covers. It goes first,
    // so a refusal for missing settings keys leaves nothing sent. Then one receipt, for the newest message from
    // someone else up to `until`: the account's own messages have none. A chat the store holds nothing of has neither.
    markRead: async (chatId, until) => {
      const anchor = until === undefined ? await stored.anchor(chatId, AFTER_EVERY_MESSAGE) : await held(chatId, until)
      if (!anchor) return
      if (!isChannel(chatId) && !chatId.endsWith("@broadcast"))
        await synced(engine.markChatRead({ ...keyOf(chatId, anchor), timestamp: anchor.timestamp }))
      const target = until !== undefined && !anchor.outgoing ? anchor : await stored.newestIncoming(chatId, until)
      if (target) await translated(engine.markRead(keyOf(chatId, target)))
    },

    // `messages sync` pages back through this. WhatsApp keeps no history on its servers, so each page is asked of the
    // phone, counting back from a message the store holds: the oldest one on the first page, then the one the last
    // page reached (`before` is a time, `fetching.orderBy: "time"`).
    history: async (chat, { limit, before }) => {
      const { id: chatId } = await core.resolve(chat)
      if (isChannel(chatId))
        return translated(
          channelHistory(engine, stored, chatId, { limit, ...(before === undefined ? {} : { before }) }),
        )
      const anchor = await stored.anchor(chatId, before)
      if (!anchor)
        throw new CliError(
          "not_found",
          "nothing of this chat is in the local store to count back from — the phone sends messages older than one " +
            `the store holds; ${words("serve")} keeps the store filled`,
        )
      const older = await translated(
        engine.older({ ...keyOf(chatId, anchor), timestamp: anchor.timestamp }, Math.min(limit, OLDER_MAX)),
      )
      const items = older.messages.map(toMessage).sort((one, other) => one.timestamp.localeCompare(other.timestamp))
      return { items, hasMore: older.more }
    },

    close: () => engine.close(),

    // Only phone-form one-to-one chats can need a re-key, and in one request: cli-core waits at most 5 s for it.
    storedChats: async (ids, recipients = []) => {
      const phones = ids.filter((id) => PHONE_CHAT.test(id))
      const typed = recipients.filter((id) => PHONE_CHAT.test(id))
      if (phones.length > 0 || typed.length > 0)
        await translated(engine.storedChats(phones, typed.length > 0 ? typed : undefined))
    },
  }

  const polls = pollAdapter({ engine, stored, held, keyOf, translated, now })
  const groups = groupAdapter({
    engine,
    resolve: core.resolve,
    translated,
    wroteTo: (person) => stored.wroteTo(person),
    onDisk,
  })
  return {
    ...core,
    ...groups,
    ...channelAdapter({ engine, resolve: core.resolve, translated, groups }),
    ...polls,
    ...channelWrites({ ...core, ...polls }),
    ...privacyAdapter({ engine, translated }),
    ...pinAdapter({ engine, held, keyOf, translated }),
    ...settingsAdapter({ engine, translated, words, stored, keyOf, onDisk }),
  }
}
