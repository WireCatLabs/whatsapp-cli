import type { AppIdentity } from "@wirecat/cli-core/cli"
import { type Configuration, settingsFor } from "@wirecat/cli-core/cli"
import { VERSION } from "./version.js"

export const WA: AppIdentity = {
  command: "wa",
  appName: "whatsapp-cli",
  envPrefix: "WA",
  description: "A personal WhatsApp account from the command line, as a linked device, for agents and scripts",
  version: VERSION,
  issues: "https://github.com/WireCatLabs/whatsapp-cli/issues/new",
  locale: "en-GB",
}

export const CONFIG: Configuration = settingsFor(WA)
export const { resolveSettings } = CONFIG
