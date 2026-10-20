import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { appUpdate, type UpdateEnvironment } from "@wirecat/cli-core/update"
import { resolveSettings } from "./app.js"
import { pathsFor } from "./paths.js"
import { VERSION } from "./version.js"

export type { UpdateEnvironment }

export const PACKAGE = "@wirecat/whatsapp-cli"

export const { installer, latest, runUpdate, updateNotice } = appUpdate({
  packageName: PACKAGE,
  command: "wa",
  version: VERSION,
  entry: import.meta.url,
  statePath: (env) => join(pathsFor(env).state, "update-check.json"),
  enabled: (env) => resolveSettings({}, { env, needsProfile: false }).updateCheck,
  offVariables: ["WA_NO_UPDATE_CHECK"],
})

/** This install's own entry point — after an update, the new code at the same path. */
export const waScript = (): string => fileURLToPath(new URL("./bin/wa.js", import.meta.url))
