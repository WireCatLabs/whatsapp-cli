import type { AppIdentity } from "@wirecat/cli-core/cli"
import { type Configuration, settingsFor } from "@wirecat/cli-core/cli"
import * as v from "valibot"
import { REASONS } from "./reasons.js"
import { VERSION } from "./version.js"

export const WA: AppIdentity = {
  command: "wa",
  appName: "whatsapp-cli",
  envPrefix: "WA",
  description: "A personal WhatsApp account from the command line, as a linked device, for agents and scripts",
  version: VERSION,
  issues: "https://github.com/WireCatLabs/whatsapp-cli/issues/new",
  locale: "en-GB",
  errors: { reasons: REASONS },
}

/** The Graph API version the generated commands were built from; a newer one is a setting away. */
export const GRAPH_VERSION = "v23.0"

/** What a bot profile on Meta's Cloud API names: ids, not secrets. */
export interface BotSettings {
  phoneNumberId: string | undefined
  wabaId: string | undefined
  graphVersion: string
}

const metaId = v.pipe(v.string("has to be Meta's id, in quotes"), v.regex(/^\d+$/, "has to be digits only"))

export const CONFIG: Configuration = settingsFor<BotSettings>(WA, {
  profile: {
    phone_number_id: v.optional(metaId),
    waba_id: v.optional(metaId),
    graph_version: v.optional(v.pipe(v.string(), v.regex(/^v\d+\.\d+$/, "has to be a Graph version like v23.0"))),
  },
  resolve: ({ fromLayers }) => {
    const phone = fromLayers<string | undefined>("phone_number_id", undefined)
    const waba = fromLayers<string | undefined>("waba_id", undefined)
    const version = fromLayers("graph_version", GRAPH_VERSION)
    return {
      values: { phoneNumberId: phone.value, wabaId: waba.value, graphVersion: version.value },
      sources: { phone_number_id: phone.from, waba_id: waba.from, graph_version: version.from },
    }
  },
})
export const { resolveSettings } = CONFIG
