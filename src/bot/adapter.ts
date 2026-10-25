import { CliError } from "@wirecat/cli-base"
import type { BotAdapter, BotChatRef, BotWebhook } from "@wirecat/cli-core/cli"
import type { GraphTransport } from "./graph.js"
import { sendMessage } from "./messaging.js"
import { type WebhookSecrets, webhookIntake } from "./webhook.js"

export interface BotIds {
  phoneNumberId: string | undefined
  wabaId: string | undefined
}

/** The setting a command needs, or a refusal that says how to set it. */
export const required = (
  value: string | undefined,
  setting: "phone_number_id" | "waba_id",
  profile: string,
): string => {
  if (value) return value
  throw new CliError(
    "configuration_error",
    `the bot profile has no ${setting} — set it with \`wa ${profile} config set --bot ${setting} <id>\`, from the app's WhatsApp → API setup page`,
  )
}

export interface AdapterSeams {
  secrets: () => WebhookSecrets
  /** Keeps the verify token `bot webhooks set --secret-stdin` was given, so the receiver can answer Meta with it. */
  keepVerifyToken: (token: string) => void
  lastInbound?: (chat: BotChatRef) => Promise<Date | undefined>
}

/** A Cloud API business number as cli-core's bot port sees it. */
export const whatsappBotAdapter = (
  graph: GraphTransport,
  ids: BotIds,
  profile: string,
  seams: AdapterSeams,
): BotAdapter => {
  const phoneNumberId = () => required(ids.phoneNumberId, "phone_number_id", profile)
  const configure = (configuration: Record<string, string>) =>
    graph.call({
      path: `/${phoneNumberId()}`,
      endpoint: "/:id",
      method: "POST",
      json: JSON.stringify({ webhook_configuration: configuration }),
      reads: false,
      operation: "updatePhoneNumber",
    })
  const intake = webhookIntake({
    get appSecret() {
      return seams.secrets().appSecret
    },
    get verifyToken() {
      return seams.secrets().verifyToken
    },
  })
  return {
    ...intake,
    me: async () => {
      const number = (await graph.call({
        path: `/${phoneNumberId()}`,
        endpoint: "/:id",
        method: "GET",
        query: { fields: "id,display_phone_number,verified_name" },
        reads: true,
        operation: "getPhoneNumber",
      })) as { id?: string; display_phone_number?: string; verified_name?: string }
      return {
        id: number.id ?? phoneNumberId(),
        name: number.verified_name ?? null,
        username: null,
        phone: number.display_phone_number ?? null,
      }
    },
    send: (chat, text, options) =>
      sendMessage(
        { graph, phoneNumberId: phoneNumberId(), ...(seams.lastInbound ? { lastInbound: seams.lastInbound } : {}) },
        chat,
        text,
        options,
      ),
    // The number's own override only: the app's callback is set in the App Dashboard and holds template and account events.
    webhooks: async (): Promise<BotWebhook[]> => {
      const answer = (await graph.call({
        path: `/${phoneNumberId()}`,
        endpoint: "/:id",
        method: "GET",
        query: { fields: "webhook_configuration" },
        reads: true,
        operation: "getPhoneNumber",
      })) as { webhook_configuration?: { phone_number?: string } }
      const url = answer.webhook_configuration?.phone_number
      return url ? [{ url, types: null }] : []
    },
    setWebhook: async (url, { types, secret }) => {
      if (types?.length)
        throw new CliError(
          "validation_error",
          "WhatsApp sends every subscribed field; pick fields in the App Dashboard, not with --types",
        )
      const token = secret ?? seams.secrets().verifyToken
      if (!token)
        throw new CliError(
          "configuration_error",
          `no verify token — give one with --secret-stdin, or keep it with \`wa ${profile} bot auth set --secret verify-token\``,
        )
      await configure({ override_callback_uri: url, verify_token: token })
      if (secret) seams.keepVerifyToken(secret)
    },
    deleteWebhook: async () => {
      await configure({ override_callback_uri: "" })
    },
    close: async () => {},
  }
}
