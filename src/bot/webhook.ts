import { createHmac, timingSafeEqual } from "node:crypto"
import { CliError } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import type { BotEvent, BotWebhookAnswer, BotWebhookIntake, BotWebhookRequest } from "@wirecat/cli-core/cli"

/** The two secrets the receiver checks Meta by, kept with `bot auth set --secret <name>`. */
export interface WebhookSecrets {
  /** App settings → Basic: the key of every delivery's `X-Hub-Signature-256`. */
  appSecret: string | undefined
  /** Any string the owner chose and typed in the App Dashboard too; Meta echoes it in the handshake. */
  verifyToken: string | undefined
}

const equal = (a: string, b: string) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

interface Contact {
  wa_id?: string
  user_id?: string
  profile?: { name?: string }
}

interface Incoming {
  id?: string
  from?: string
  from_user_id?: string
  timestamp?: string
  type?: string
  context?: { id?: string }
  text?: { body?: string }
  reaction?: { emoji?: string; message_id?: string }
  button?: { text?: string }
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } }
  location?: { name?: string; address?: string; latitude?: number; longitude?: number }
  [media: string]: unknown
}

interface Status {
  id?: string
  status?: string
  timestamp?: string
  recipient_id?: string
  recipient_user_id?: string
}

interface Value {
  metadata?: { phone_number_id?: string }
  contacts?: Contact[]
  messages?: Incoming[]
  statuses?: Status[]
}

const MEDIA = ["image", "video", "audio", "document", "sticker"] as const
const KIND: Record<(typeof MEDIA)[number], string> = {
  image: "photo",
  video: "video",
  audio: "voice",
  document: "file",
  sticker: "sticker",
}

const iso = (seconds: string | undefined) => new Date(Number(seconds ?? "0") * 1000).toISOString()

/**
 * The chat a person is. Meta names some people only by a business-scoped user id (the spec does not list the
 * field yet); such a chat is `user:<id>`, a person named by number is the digits.
 */
const chatOf = (userId: string | undefined, phone: string | undefined): string | undefined =>
  userId ? `user:${userId}` : phone

const textOf = (message: Incoming): string => {
  if (message.text?.body !== undefined) return message.text.body
  if (message.button?.text !== undefined) return message.button.text
  const reply = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title
  if (reply !== undefined) return reply
  for (const kind of MEDIA) {
    const media = message[kind] as { caption?: string } | undefined
    if (media?.caption !== undefined) return media.caption
  }
  if (message.location) return [message.location.name, message.location.address].filter(Boolean).join(", ")
  return ""
}

const messageOf = (message: Incoming, contact: Contact | undefined, phoneNumberId: string | undefined): Message => {
  const chat = chatOf(contact?.user_id ?? message.from_user_id, message.from ?? contact?.wa_id) ?? "unknown"
  const attachments = MEDIA.flatMap((kind) => {
    const media = message[kind] as { id?: string; mime_type?: string; filename?: string } | undefined
    if (!media?.id) return []
    return [
      {
        kind: KIND[kind],
        ...(media.mime_type ? { mime: media.mime_type } : {}),
        ...(media.filename ? { name: media.filename } : {}),
        providerRef: { mediaId: media.id, ...(phoneNumberId ? { phoneNumberId } : {}) },
      },
    ]
  })
  return {
    id: message.id ?? "",
    chatId: chat,
    senderId: chat,
    senderName: contact?.profile?.name ?? null,
    timestamp: iso(message.timestamp),
    editedAt: null,
    text: textOf(message),
    outgoing: false,
    attachments,
    replyTo: null,
    ...(message.context?.id ? { replyToId: message.context.id } : {}),
    forwardedFrom: null,
    reactions: null,
  }
}

/** One delivery's events; `statuses[]` become receipts (delivered, read) and `other` notices (sent, failed). */
export const decodeDelivery = (body: Uint8Array): BotEvent[] => {
  let payload: { object?: string; entry?: { changes?: { field?: string; value?: Value }[] }[] }
  try {
    payload = JSON.parse(Buffer.from(body).toString("utf8"))
  } catch {
    throw new CliError("invalid_response", "the delivery is not JSON")
  }
  if (payload.object !== "whatsapp_business_account") throw new CliError("invalid_response", "not a WhatsApp delivery")
  const events: BotEvent[] = []
  for (const entry of payload.entry ?? [])
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}
      if (change.field !== "messages") {
        events.push({ event: "other", type: change.field ?? "unknown", chatId: null })
        continue
      }
      const phoneNumberId = value.metadata?.phone_number_id
      for (const message of value.messages ?? []) {
        if (!message.id) continue
        const contact =
          value.contacts?.find((one) => one.wa_id !== undefined && one.wa_id === message.from) ?? value.contacts?.[0]
        const update = { id: message.id, kind: message.type ?? "message" }
        if (message.type === "reaction") {
          const chat = chatOf(contact?.user_id ?? message.from_user_id, message.from) ?? null
          events.push({ event: "other", type: "reaction", chatId: chat, update })
          continue
        }
        events.push({
          event: "message",
          message: { ...messageOf(message, contact, phoneNumberId), chatTitle: null },
          update,
        })
      }
      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status) continue
        const chat = chatOf(status.recipient_user_id, status.recipient_id) ?? ""
        const update = { id: `${status.id}:${status.status}`, kind: `status:${status.status}` }
        if (status.status === "delivered" || status.status === "read")
          events.push({
            event: "delivery",
            chatId: chat,
            chatTitle: null,
            messageId: status.id,
            delivery: status.status,
            at: iso(status.timestamp),
            update,
          })
        else events.push({ event: "other", type: `status:${status.status}`, chatId: chat || null, update })
      }
    }
  return events
}

/** Meta's side of `bot watch --public-url`: the subscription handshake, the signature, the payload. */
export const webhookIntake = (secrets: WebhookSecrets): BotWebhookIntake => ({
  webhookHandshake: (request: BotWebhookRequest): BotWebhookAnswer | undefined => {
    const query = request.url.searchParams
    if (query.get("hub.mode") !== "subscribe") return undefined
    const given = query.get("hub.verify_token") ?? ""
    if (!secrets.verifyToken || !equal(given, secrets.verifyToken))
      return { status: 403, body: "verify token does not match" }
    return { status: 200, body: query.get("hub.challenge") ?? "" }
  },
  // Over the bytes as they came: JSON parsed and written again would not match Meta's HMAC.
  webhookAuthentic: (request: BotWebhookRequest): boolean => {
    if (!secrets.appSecret) return false
    const given = request.headers.get("x-hub-signature-256") ?? ""
    const wanted = `sha256=${createHmac("sha256", secrets.appSecret).update(request.body).digest("hex")}`
    return equal(given, wanted)
  },
  webhookEvents: (request: BotWebhookRequest) => decodeDelivery(request.body),
})
