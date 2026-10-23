import { CliError } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import type { BotChatRef, BotSendOptions } from "@wirecat/cli-core/cli"
import { uploadBlob } from "@wirecat/cli-core/sends"
import type { GraphTransport } from "./graph.js"
import { mimeOf } from "./mime.js"

/** 24 hours: after a person's last message, Meta takes only a template ([pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Who a chat is, as Meta addresses them. A person Meta names by business-scoped user id is the chat
 * `user:<id>` and goes as `recipient`; one named by phone number is the digits and goes as `to`.
 */
export const addressOf = (chat: BotChatRef): Record<string, string> => {
  const trimmed = chat.trim()
  if (trimmed.startsWith("user:")) return { recipient: trimmed.slice("user:".length) }
  if (/^\d{6,15}$/.test(trimmed)) return { to: trimmed }
  throw new CliError(
    "validation_error",
    "a WhatsApp chat is a phone number in digits, or user:<id> as `bot watch` shows it",
  )
}

type Kind = "image" | "video" | "audio" | "document" | "sticker"

/** What Meta shows the file as: by its type, unless `--as-file` asked for a file to download. */
const kindOf = (upload: { kind: string; asFile?: true }, mime: string): Kind => {
  if (upload.asFile) return "document"
  if (upload.kind === "voice" || mime.startsWith("audio/")) return "audio"
  if (upload.kind === "sticker" && mime === "image/webp") return "sticker"
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  return "document"
}

const sentMessage = (
  id: string,
  chat: BotChatRef,
  sender: string,
  text: string,
  replyTo: string | undefined,
): Message => ({
  id,
  chatId: chat,
  senderId: sender,
  senderName: null,
  timestamp: new Date().toISOString(),
  editedAt: null,
  text,
  outgoing: true,
  attachments: [],
  replyTo: null,
  ...(replyTo ? { replyToId: replyTo } : {}),
  forwardedFrom: null,
  reactions: null,
})

const firstId = (answer: unknown): string => {
  const id = (answer as { messages?: { id?: string }[] }).messages?.[0]?.id
  if (!id) throw new CliError("invalid_response", "Meta accepted the message but named no message id")
  return id
}

/** `POST /<phone-number-id>/media`: the file goes up once, and a message names it by the id Meta gives back. */
export const uploadMedia = async (
  graph: GraphTransport,
  phoneNumberId: string,
  file: { blob: Blob; name: string; type: string },
): Promise<string> => {
  const form = new FormData()
  form.append("messaging_product", "whatsapp")
  form.append("type", file.type)
  form.append("file", file.blob, file.name)
  const answer = (await graph.call({
    path: `/${phoneNumberId}/media`,
    method: "POST",
    form,
    reads: false,
    operation: "uploadMedia",
  })) as { id?: string }
  if (!answer.id) throw new CliError("invalid_response", "Meta took the file but named no media id")
  return answer.id
}

export interface SendContext {
  graph: GraphTransport
  phoneNumberId: string
  /** When the person last wrote, from the local copy; `undefined` when nothing of theirs was ever kept. */
  lastInbound?: (chat: BotChatRef) => Promise<Date | undefined>
  now?: () => Date
}

/**
 * Text, a reply, and files by upload, one message each: Meta carries one media item per message, with the text as
 * the first one's caption. A free-form send more than 24 hours after the person last wrote is refused here, before
 * it leaves — only a template may go then.
 */
export const sendMessage = async (
  context: SendContext,
  chat: BotChatRef,
  text: string,
  options: BotSendOptions,
): Promise<Message> => {
  const address = addressOf(chat)
  const last = await context.lastInbound?.(chat)
  const now = (context.now ?? (() => new Date()))()
  if (last && now.getTime() - last.getTime() > SERVICE_WINDOW_MS)
    throw new CliError(
      "validation_error",
      "more than 24 hours since they last wrote: WhatsApp takes only a template now — `bot templates send`",
      { reason: "whatsapp.window_closed" },
    )
  if (options.silent) throw new CliError("validation_error", "WhatsApp has no silent message; send it without --silent")
  if (options.markup?.length || options.formatting?.length || options.html)
    throw new CliError(
      "validation_error",
      "WhatsApp formats with its own *bold* and _italic_ marks in the text; send it as plain text",
    )
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    ...address,
    ...(options.replyTo ? { context: { message_id: options.replyTo } } : {}),
  }
  const send = async (body: Record<string, unknown>) =>
    firstId(
      await context.graph.call({
        path: `/${context.phoneNumberId}/messages`,
        method: "POST",
        json: JSON.stringify({ ...base, ...body }),
        reads: false,
        operation: "sendMessage",
      }),
    )
  const files = options.attachments ?? []
  if (files.length === 0) {
    if (!text.trim()) throw new CliError("validation_error", "nothing to send")
    return sentMessage(
      await send({ type: "text", text: { body: text, preview_url: false } }),
      chat,
      context.phoneNumberId,
      text,
      options.replyTo,
    )
  }
  let first: string | undefined
  const [lead] = files
  const captioned = lead !== undefined && !["audio", "sticker"].includes(kindOf(lead, mimeOf(lead.name)))
  if (text.trim() && !captioned) first = await send({ type: "text", text: { body: text, preview_url: false } })
  for (const [index, upload] of files.entries()) {
    const type = mimeOf(upload.name)
    const kind = kindOf(upload, type)
    const media = await uploadMedia(context.graph, context.phoneNumberId, {
      blob: await uploadBlob(upload.source, type),
      name: upload.name,
      type,
    })
    const caption = index === 0 && captioned && text.trim() ? { caption: text } : {}
    const named = kind === "document" ? { filename: upload.name } : {}
    const id = await send({ type: kind, [kind]: { id: media, ...caption, ...named } })
    first ??= id
  }
  if (!first) throw new CliError("invalid_response", "Meta named no message id")
  return sentMessage(first, chat, context.phoneNumberId, text, options.replyTo)
}
