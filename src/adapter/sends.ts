import { createReadStream } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve as absolute, extname, join } from "node:path"
import { CliError } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import type {
  MessageEditing,
  MessageMedia,
  MessengerCore,
  RemoteFile,
  SendOptions,
  StoredMessages,
} from "@wirecat/cli-core/cli"
import type { Upload, UploadSource } from "@wirecat/cli-core/sends"
import type { WaAttachment, WaKey, WaMediaRef, WaSendMedia, WhatsAppEngine } from "../engine/contract.js"
import { isChannel, refuseChannelPost } from "./channels.js"
import { toWhatsApp } from "./format-markdown.js"
import { isFile, toMessage, toWaAttachment } from "./map.js"

const REFUSED: (keyof SendOptions)[] = ["threadId", "markup", "sticker", "spoiler", "captionAbove"]

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

export const onDisk = async <T>(source: UploadSource, work: (path: string) => Promise<T>): Promise<T> => {
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

export const sendAdapter = ({
  engine,
  stored,
  held,
  keyOf,
  translated,
  resolve,
}: {
  engine: WhatsAppEngine
  stored: StoredMessages
  held: (chatId: string, messageId: string) => Promise<Message>
  keyOf: (chatId: string, message: Message) => WaKey
  translated: <T>(work: Promise<T>) => Promise<T>
  resolve: MessengerCore["resolve"]
}): Pick<MessengerCore, "send"> & Pick<MessageEditing, "forward"> & Pick<MessageMedia, "download"> => {
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
        // The old URL names the dead copy; without one, the engine builds it from the new path.
        const { url: _dead, ...kept } = attachment.ref
        attachment.ref = { ...kept, ...renewed }
        file.providerRef = attachment.ref
      }
      yield* createReadStream(path)
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  }

  return {
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
      const { id: chatId } = await resolve(chat)
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
  }
}
