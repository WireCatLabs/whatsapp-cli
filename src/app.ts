import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { resolvePaths } from "@wirecat/cli-base"
import { type Configuration, settingsFor } from "@wirecat/cli-core/cli"
import * as v from "valibot"
import { WA } from "./identity.js"

export { WA } from "./identity.js"

/** The Graph API version the generated commands were built from; a newer one is a setting away. */
export const GRAPH_VERSION = "v23.0"

/** What a bot profile on Meta's Cloud API names: ids, not secrets. */
export interface BotSettings {
  phoneNumberId: string | undefined
  wabaId: string | undefined
  graphVersion: string
}

const metaId = v.pipe(v.string("has to be Meta's id, in quotes"), v.regex(/^\d+$/, "has to be digits only"))

// A linked device is a profile here even when no config section names it, so a failed sign-in is not called a typo.
const linkedProfiles = (env: NodeJS.ProcessEnv): string[] => {
  const dir = join(resolvePaths({ appName: WA.appName, prefix: WA.envPrefix, env }).state, "profiles")
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => existsSync(join(dir, name, "private.db")))
}

export const CONFIG: Configuration = settingsFor<BotSettings>(WA, {
  profiles: linkedProfiles,
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
