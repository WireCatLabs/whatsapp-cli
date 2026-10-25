import type { AppIdentity } from "@wirecat/cli-core/cli"
import { REASONS } from "./reasons.js"
import { VERSION } from "./version.js"

/** Apart from the settings, so the bin can start without loading cli-core's command tree. */
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
