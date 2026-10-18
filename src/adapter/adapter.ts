import { randomBytes } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve as absolute, extname, join } from "node:path"
import { CliError } from "@wirecat/cli-base"
import {
  bareCheck,
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
  MessagePins,
  MessageReactions,
  MessageStars,
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
  type WaKey,
  type WaMediaRef,
  type WaSendMedia,
  type WhatsAppEngine,
} from "../engine/contract.js"
import { channelAdapter, channelHistory, channelWrites, isChannel, refuseChannelPost } from "./channels.js"
import type { Words } from "./checks.js"
import { fromEngine } from "./errors.js"
import { toWhatsApp } from "./format-markdown.js"
import { type GroupAdapter, groupAdapter } from "./groups.js"
import { isFile, sameFile, toAccount, toChat, toChatEvent, toMember, toMessage, toWaAttachment } from "./map.js"
import { pinAdapter } from "./pins.js"
import { type PollAdapter, pollAdapter, toHistoryVote, toVoteEvent } from "./polls.js"
import { type PrivacyAdapter, privacyAdapter } from "./privacy.js"
import { AFTER_EVERY_MESSAGE, type SettingsAdapter, settingsAdapter, settingsWrite } from "./settings.js"

export type WhatsAppAdapter = MessengerCore &
  LiveUpdates &
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

const hit = (message: Message): MessageHit => ({ ...message, chatTitle: null })

const ENDED: Partial<Record<ConnectionState, (words: Words, until?: string) => CliError>> = {
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
  banned: (_words, until) =>
    fromEngine(
      new EngineError(
        "permission_error",
        "WhatsApp has banned or restricted this account; see the phone",
        "account.banned",
        until,
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
      const ended = event.event === "connection" ? ENDED[event.state]?.(words, event.until) : undefined
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

const allOnDisk = async <F extends { upload: Upload }, T>(
  files: F[],
  work: (placed: (F & { path: string })[]) => Promise<T>,
  placed: (F & { path: string })[] = [],
): Promise<T> => {
  const [next, ...rest] = files
  if (!next) return work(placed)
  return onDisk(next.upload.source, (path) => allOnDisk(rest, work, [...placed, { ...next, path }]))
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
  // A push after a re-link carries the path the file had then, and the store may hold the one the phone uploaded
  // again. cli-core keeps a stored ref only when the pushed file has none, so the pushed one is left off when it names
  // the same file; another file keeps its own. Only a message with a ref costs a store read; one that fails hands the
  // message on as pushed, never loses it.
  const withoutKeptRefs = async (message: Message): Promise<Message> => {
    if (!message.attachments.some((file) => file.providerRef)) return message
    const kept = await stored.message(message.chatId, message.id).catch(() => undefined)
    if (!kept?.attachments.some((file) => file.providerRef)) return message
    return {
      ...message,
      attachments: message.attachments.map((file, position) => {
        if (!sameFile(file.providerRef, kept.attachments[position]?.providerRef)) return file
        const { providerRef: _pushed, ...rest } = file
        return rest
      }),
    }
  }
  // A deletion for the account alone, a star and a chat marked read are changes to its synced settings, not messages.
  const synced = settingsWrite(translated, words)

  // The phone's new upload replaces the whole stored ref on `file`, so cli-core saves it and a later download or a
  // forward uses the live path; a second read of the same file in this run uses it too.
  async function* fetched(
    file: RemoteFile,
    attachment: WaAttachment & { ref: WaMediaRef },
    key: WaKey,
  ): AsyncIterable<Uint8Array> {
    const folder = await mkdtemp(join(tmpdir(), "wa-media-"))
    try {
      const path = join(folder, "file")
      const renewed = await translated(engine.download(attachment, path, key))
      if (renewed) {
        attachment.ref = { ...attachment.ref, directPath: renewed.directPath }
        file.providerRef = attachment.ref
      }
      yield* createReadStream(path)
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  }

  const core: Omit<
    WhatsAppAdapter,
    keyof (GroupAdapter & PollAdapter & PrivacyAdapter & MessagePins & SettingsAdapter)
  > = {
    formatMarkdown: async (text) => parseMarkdownSpans(text),

    self: () => engine.self(),

    newSendId: () => `3EB0${randomBytes(9).toString("hex").toUpperCase()}`,

    me: async () => toAccount(await translated(engine.me())),

    resolve: async (query: string): Promise<Chat> => {
      if (query.includes("@"))
        return {
          id: query,
          title: null,
          kind: "unknown",
          unreadCount: null,
          lastMessageAt: null,
          participantsCount: null,
        }
      const named = (await translated(engine.directory())).filter((chat) => chat.name === query)
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
      const uploads = options.attachments ?? []
      const [upload] = uploads
      const files = uploads.map((one) => ({ upload: one, kind: uploadKind(one) }))
      if (files.length > 1 && files.some(({ kind }) => kind !== "photo" && kind !== "video"))
        throw new CliError(
          "validation_error",
          "a WhatsApp album holds photos and videos only; send a document in a message of its own",
        )
      if (upload?.kind === "voice" && text.trim() !== "")
        throw new CliError("validation_error", "WhatsApp sends a voice message alone, without text")
      const { stickerFile } = options
      // Untried on a live channel, where a post carries a URL and no key.
      if (stickerFile && isChannel(chatId))
        throw new CliError("validation_error", "wa does not post stickers to a WhatsApp channel yet")
      if (isChannel(chatId))
        await refuseChannelPost(engine, translated, chatId, {
          files: files.length,
          reply: options.replyTo !== undefined,
        })
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
        files.length > 1
          ? allOnDisk(files, (placed) =>
              engine.sendAlbum({
                ...request,
                files: placed.map(({ upload, kind, path }) => ({ kind, path, name: upload.name })),
              }),
            )
          : upload
            ? onDisk(upload.source, (path) =>
                engine.sendMedia({ ...request, file: { kind: uploadKind(upload), path, name: upload.name } }),
              )
            : stickerFile
              ? onDisk(stickerFile.source, (path) =>
                  engine.sendMedia({ ...request, file: { kind: "sticker", path, name: stickerFile.name } }),
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
      // A channel's files carry no key, and a chat's recipient cannot open a file without one.
      if (isChannel(fromChatId) && attachment?.ref && "directPath" in attachment.ref)
        throw new CliError(
          "validation_error",
          "a WhatsApp channel's file is not encrypted, so a forward would arrive as a file that does not open; " +
            "save it on the phone and send it as a new file",
          { reason: "media.channel-file-forward" },
        )
      const copy = await translated(
        engine.forward({ chat: toChatId, id: sendId, text: original.text, attachment: attachment ?? null }),
      )
      return { ...toMessage(copy), forwardedFrom: quoted(original) }
    },

    // From the keys in the store: WhatsApp has no request for an old message. A file that is not one (a place, a
    // contact card) or that the store has no keys for is named in `skipped`. The message's key goes along, so the
    // engine can ask the phone for a file WhatsApp no longer keeps.
    download: async (chat, messageId) => {
      const { id: chatId } = await core.resolve(chat)
      const message = await held(chatId, messageId)
      const files: RemoteFile[] = []
      const skipped: string[] = []
      message.attachments.forEach((stored, position) => {
        const attachment = toWaAttachment(stored)
        if (!isFile(attachment)) {
          skipped.push(stored.kind)
          return
        }
        const file: RemoteFile = {
          kind: attachment.kind,
          ...(attachment.name === undefined ? {} : { name: attachment.name }),
          ...(attachment.mime === undefined ? {} : { mime: attachment.mime }),
          ...(attachment.size === undefined ? {} : { size: attachment.size }),
          position,
          bytes: () => fetched(file, attachment, keyOf(chatId, message)),
        }
        files.push(file)
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

    logout: () => translated(engine.logout()),

    close: () => engine.close(),

    watch: async (onEvent: (event: MessageEvent) => void, signal: AbortSignal, onReady?: () => void) => {
      const handed = async (event: EngineEvent) => {
        if (event.event === "message") onEvent({ event: "message", message: hit(toMessage(event.message)) })
        else if (event.event === "edit") onEvent({ event: "edit", message: hit(toMessage(event.message)) })
        else if (event.event === "delete")
          onEvent({
            event: "delete",
            chatId: event.chat,
            chatTitle: null,
            messageId: event.id,
          })
        else if (event.event === "star")
          onEvent({
            event: "star",
            chatId: event.chat,
            chatTitle: null,
            messageId: event.id,
            starred: event.starred,
          })
        else if (event.event === "vote") {
          const vote = await toVoteEvent(event.vote, stored)
          if (vote) onEvent(vote)
        } else if (event.event === "chat_event")
          onEvent({
            event: "chat_event",
            chatId: event.change.chat,
            chatTitle: null,
            change: toChatEvent(event.change),
          })
      }
      // In arrival order: a vote reads its poll from the store, and nothing after it may overtake it.
      let queue = Promise.resolve()
      const live = listening(
        engine,
        ["message", "edit", "delete", "vote", "star", "chat_event", "connection"],
        signal,
        words,
        (event) => {
          queue = queue.then(() => handed(event))
        },
      )
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
      // In arrival order: a push waits for its store reads, and a re-key after it must not overtake it.
      let queue = Promise.resolve()
      const handed = async (event: EngineEvent) => {
        if (event.event === "rekey") onBatch({ rekeys: [{ from: event.from, to: event.to }] })
        if (event.event !== "history") return
        const { rekeys, chats, contacts, messages, votes, events } = event.history
        onBatch({
          rekeys: rekeys ?? [],
          chats: chats.map(toChat),
          people: contacts.map(toMember),
          messages: await Promise.all(messages.map((message) => withoutKeptRefs(toMessage(message)))),
          votes: votes.flatMap((vote) => toHistoryVote(vote) ?? []),
          events: (events ?? []).map((change) => ({ chatId: change.chat, change: toChatEvent(change) })),
        })
      }
      const pushes = listening(engine, ["history", "rekey", "connection"], signal, words, (event) => {
        queue = queue.then(() => handed(event))
      })
      try {
        await pushes.done
      } finally {
        pushes.stop()
        await queue
      }
    },
  }

  const polls = pollAdapter({ engine, stored, held, keyOf, translated })
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
