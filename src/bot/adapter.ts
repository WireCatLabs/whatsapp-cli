import { CliError } from "@wirecat/cli-base"
import type { BotAdapter } from "@wirecat/cli-core/cli"
import type { GraphTransport } from "./graph.js"

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

/** A Cloud API business number as cli-core's bot port sees it. */
export const whatsappBotAdapter = (graph: GraphTransport, ids: BotIds, profile: string): BotAdapter => {
  const phoneNumberId = () => required(ids.phoneNumberId, "phone_number_id", profile)
  return {
    me: async () => {
      const number = (await graph.call({
        path: `/${phoneNumberId()}`,
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
    close: async () => {},
  }
}
