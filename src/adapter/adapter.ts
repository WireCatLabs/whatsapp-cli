import { randomBytes } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve as absolute, extname, join } from "node:path"
import { CliError } from "@wirecat/cli-base"
import {
  type Chat,
  type MarkdownFormatting,
  type Message,
  type MessageEvent,
  type MessageHit,
  parseMarkdownSpans,
} from "@wirecat/cli-core"
import type {
  LiveUpdates,
  MessageEditing,
  MessageMedia,
  MessageReactions,
  MessengerCore,
  PushedHistory,
  ReadState,
  RemoteFile,
  SendOptions,
  ServerReads,
  StoredMessages,
} from "@wirecat/cli-core/cli"
import type { Upload, UploadSource } from "@wirecat/cli-core/sends"
import {
  type ConnectionState,
  EngineError,
  type EngineEvent,
  OLDER_MAX,
  type WaAttachment,
  type WaChat,
  type WaKey,
  type WaSendMedia,
  type WhatsAppEngine,
} from "../engine/contract.js"
import { bareCheck, type Words } from "./checks.js"
import { fromEngine } from "./errors.js"
import { toWhatsApp } from "./format-markdown.js"
import { type GroupAdapter, groupAdapter } from "./groups.js"
import { toChat, toMember, toMessage, toWaAttachment } from "./map.js"
import { type PollAdapter, pollAdapter, toHistoryVote, toVoteEvent } from "./polls.js"

export type WhatsAppAdapter = MessengerCore &
  LiveUpdates &
  PushedHistory &
  Pick<MessageEditing, "edit" | "delete" | "forward"> &
  Pick<MessageMedia, "download"> &
  MessageReactions &
  ReadState &
  Pick<ServerReads, "history"> &
  MarkdownFormatting &
  PollAdapter &
  GroupAdapter

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

/** Options WhatsApp has no way to honour; `noPreview` is always true, since nothing here builds link previews. */
const REFUSED: (keyof SendOptions)[] = ["threadId", "markup", "sticker", "spoiler", "captionAbove"]

const translated = async <T>(work: Promise<T>): Promise<T> => {
  try {
    return await work
  } catch (error) {
    if (error instanceof EngineError) throw fromEngine(error)
    throw error
  }
}

const hit = (chat: WaChat | undefined, message: Message): MessageHit => ({ ...message, chatTitle: chat?.name ?? null })

const ENDED: Partial<Record<ConnectionState, (words: Words) => CliError>> = {
  logged_out: (words) =>
    fromEngine(
      new EngineError(
        "authentication_error",
        `WhatsApp logged this device out — log in again with ${words("session.start")}`,
        "device.logged-out",
      ),
    ),
  replaced: () =>
    fromEngine(
      new EngineError(
        "provider_unavailable",
        "another process took over this WhatsApp login; only one may hold it",
        "device.replaced",
      ),
    ),
  banned: () =>
    fromEngine(
      new EngineError(
        "permission_error",
        "WhatsApp has banned or restricted this account; see the phone",
        "account.banned",
      ),
    ),
  outdated: () =>
    fromEngine(
      new EngineError(
        "provider_unavailable",
        "WhatsApp no longer accepts this version of wa; update it",
        "client.outdated",
      ),
    ),
  stopped: () =>
    fromEngine(new EngineError("provider_unavailable", "the WhatsApp engine stopped unexpectedly", "engine.stopped")),
}

/** Hands each event on until `signal` aborts; a connection WhatsApp ended rejects with why. */
const listening = (
  engine: WhatsAppEngine,
  kinds: readonly EngineEvent["event"][],
  signal: AbortSignal,
  words: Words,
  onEvent: (event: EngineEvent) => void,
): { done: Promise<void>; stop: () => void } => {
  let stop = () => {}
  const done = new Promise<void>((resolve, reject) => {
    const unlisten = engine.listen(kinds, (event) => {
      const ended = event.event === "connection" ? ENDED[event.state]?.(words) : undefined
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

const VIDEO = new Set([".mp4", ".m4v", ".mov"])

/** As tg sends them: a photo as a photo, a voice as a voice, a video as a video unless `--as-file`, the rest as files. */
const uploadKind = ({ kind, name, asFile }: Upload): WaSendMedia["file"]["kind"] =>
  kind === "photo" || kind === "voice" ? kind : !asFile && VIDEO.has(extname(name).toLowerCase()) ? "video" : "document"

/** A folder only this user can read, gone when `work` ends: the engine writes a download into it, or reads bytes made in memory. */
const inPrivateFolder = async <T>(work: (folder: string) => Promise<T>): Promise<T> => {
  const folder = await mkdtemp(join(tmpdir(), "wa-media-"))
  try {
    return await work(folder)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

const onDisk = async <T>(source: UploadSource, work: (path: string) => Promise<T>): Promise<T> => {
  if (source.kind === "file") return work(absolute(source.path))
  return inPrivateFolder(async (folder) => {
    const path = join(folder, "upload")
    await writeFile(path, source.bytes, { mode: 0o600, flag: "wx" })
    return work(path)
  })
}

const quoted = (message: Message) => ({
  id: message.id,
  senderId: message.senderId,
  senderName: message.senderName,
  timestamp: message.timestamp,
  text: message.text,
  attachments: message.attachments,
  outgoing: message.outgoing ?? null,
})

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

  async function* fetched(attachment: WaAttachment): AsyncIterable<Uint8Array> {
    const folder = await mkdtemp(join(tmpdir(), "wa-media-"))
    try {
      const path = join(folder, "file")
      await translated(engine.download(attachment, path))
      yield* createReadStream(path)
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  }

  const titled = async (): Promise<Map<string, WaChat>> =>
    new Map((await translated(engine.directory())).map((chat) => [chat.jid, chat]))

  const core: Omit<WhatsAppAdapter, keyof GroupAdapter | keyof PollAdapter> = {
    formatMarkdown: async (text) => parseMarkdownSpans(text),

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
          `${named.length} chats share that name — name one by its id; ${words("chats.list")} shows them`,
        )
      throw new CliError(
        "not_found",
        `no chat by that name or id; ${words("chats.list")} shows the chats this profile has`,
      )
    },

    chat: async (jid: string) => {
      const card = await translated(engine.chat(jid))
      return { ...toChat(card.chat), members: card.members?.map(toMember) ?? null }
    },

    send: async (chatId: string, text: string, options: SendOptions) => {
      const refused = REFUSED.filter((option) => options[option] !== undefined && options[option] !== false)
      if (refused.length > 0) throw new CliError("validation_error", `WhatsApp cannot send with ${refused.join(", ")}`)
      const [upload, ...more] = options.attachments ?? []
      if (more.length > 0) throw new CliError("validation_error", "WhatsApp sends one file per message here")
      if (upload?.kind === "voice" && text.trim() !== "")
        throw new CliError("validation_error", "WhatsApp sends a voice message alone, without text")
      // A reply to a message the store lacks still goes, with its id alone.
      const answered = options.replyTo === undefined ? undefined : await stored.message(chatId, options.replyTo)
      const request = {
        chat: chatId,
        text: options.formatting ? toWhatsApp(text, options.formatting) : text,
        id: options.sendId,
        ...(options.replyTo === undefined ? {} : { replyTo: options.replyTo }),
        ...(answered
          ? { quoted: { fromMe: answered.outgoing === true, sender: answered.senderId, text: answered.text } }
          : {}),
      }
      const message = await translated(
        upload
          ? onDisk(upload.source, (path) =>
              engine.sendMedia({ ...request, file: { kind: uploadKind(upload), path, name: upload.name } }),
            )
          : engine.send(request),
      )
      return { message: toMessage(message), sendId: options.sendId }
    },

    forward: async (fromChatId, messageId, toChatId, { sendId, threadId }) => {
      if (threadId !== undefined) throw new CliError("validation_error", "WhatsApp forwards without a topic")
      const original = await held(fromChatId, messageId)
      const attachments = original.attachments.map(toWaAttachment)
      const [attachment] = attachments
      if (attachments.length > 1 || (attachments.length === 1 && !attachment?.ref))
        throw new CliError(
          "validation_error",
          "the local store does not hold this message's content whole, so it cannot be forwarded; forward it on the phone",
        )
      if (!attachment && original.text === "")
        throw new CliError("validation_error", "that message has nothing to forward")
      const copy = await translated(
        engine.forward({ chat: toChatId, id: sendId, text: original.text, attachment: attachment ?? null }),
      )
      return { ...toMessage(copy), forwardedFrom: quoted(original) }
    },

    // From the keys in the store: WhatsApp has no request for an old message. A file that is not one (a place, a
    // contact card) or that the store has no keys for is named in `skipped`.
    download: async (chat, messageId) => {
      const { id: chatId } = await core.resolve(chat)
      const message = await held(chatId, messageId)
      const files: RemoteFile[] = []
      const skipped: string[] = []
      message.attachments.forEach((stored, position) => {
        const attachment = toWaAttachment(stored)
        if (!attachment?.ref) {
          skipped.push(stored.kind)
          return
        }
        files.push({
          kind: attachment.kind,
          ...(attachment.name === undefined ? {} : { name: attachment.name }),
          ...(attachment.mime === undefined ? {} : { mime: attachment.mime }),
          ...(attachment.size === undefined ? {} : { size: attachment.size }),
          position,
          bytes: () => fetched(attachment),
        })
      })
      return { files, skipped }
    },

    edit: async (chatId, messageId, text, { markup, formatting }) => {
      if (markup !== undefined) throw new CliError("validation_error", "WhatsApp cannot edit with markup")
      const original = await held(chatId, messageId)
      if (!original.outgoing) throw new CliError("validation_error", "only your own messages can be edited")
      if (Date.now() - Date.parse(original.timestamp) > EDIT_WINDOW_MS)
        throw new CliError("validation_error", "WhatsApp takes an edit only within 20 minutes of sending")
      const edited = await translated(
        engine.edit(keyOf(chatId, original), formatting ? toWhatsApp(text, formatting) : text),
      )
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

    // `messages sync` pages back through this. WhatsApp keeps no history on its servers, so each page is asked of the
    // phone, counting back from a message the store holds: the oldest one on the first page, then the one the last
    // page reached (`before` is a time, `fetching.orderBy: "time"`).
    history: async (chat, { limit, before }) => {
      const { id: chatId } = await core.resolve(chat)
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

    logout: () => translated(engine.logout()),

    close: () => engine.close(),

    watch: async (onEvent: (event: MessageEvent) => void, signal: AbortSignal, onReady?: () => void) => {
      const chats = await titled()
      const handed = async (event: EngineEvent) => {
        if (event.event === "message")
          onEvent({ event: "message", message: hit(chats.get(event.message.chat), toMessage(event.message)) })
        else if (event.event === "edit")
          onEvent({ event: "edit", message: hit(chats.get(event.message.chat), toMessage(event.message)) })
        else if (event.event === "delete")
          onEvent({
            event: "delete",
            chatId: event.chat,
            chatTitle: chats.get(event.chat)?.name ?? null,
            messageId: event.id,
          })
        else if (event.event === "vote") {
          const vote = await toVoteEvent(event.vote, chats.get(event.vote.chat)?.name ?? null, stored)
          if (vote) onEvent(vote)
        }
      }
      // In arrival order: a vote reads its poll from the store, and nothing after it may overtake it.
      let queue = Promise.resolve()
      const live = listening(engine, ["message", "edit", "delete", "vote", "connection"], signal, words, (event) => {
        queue = queue.then(() => handed(event))
      })
      try {
        await translated(engine.ready(signal))
        if (!signal.aborted) onReady?.()
        await live.done
      } finally {
        live.stop()
        await queue
      }
    },

    feed: async (onBatch, signal) => {
      const pushes = listening(engine, ["history", "connection"], signal, words, (event) => {
        if (event.event !== "history") return
        const { chats, contacts, messages, votes } = event.history
        onBatch({
          chats: chats.map(toChat),
          people: contacts.map(toMember),
          messages: messages.map(toMessage),
          votes: votes.flatMap((vote) => toHistoryVote(vote) ?? []),
        })
      })
      try {
        await pushes.done
      } finally {
        pushes.stop()
      }
    },
  }

  return {
    ...core,
    ...groupAdapter({ engine, resolve: core.resolve, translated, wroteTo: (person) => stored.wroteTo(person) }),
    ...pollAdapter({ engine, stored, held, keyOf, translated }),
  }
}
