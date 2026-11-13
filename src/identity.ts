import type { ManifestIdentity } from "@wirecat/cli-base/wcat/manifest"
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

// What `wcat` and WireCat Desktop show before the tool is installed; src/wcat.ts adds the permission keys. The linked
// device reaches WhatsApp through the Go engine's own socket (whatsmeow's socket/constants.go); media files come from
// hosts WhatsApp names per connection, so they are not listed. The Graph API is the business number's.
export const DESKTOP: ManifestIdentity & { hosts: readonly string[] } = {
  ...WA,
  docs: "https://github.com/WireCatLabs/whatsapp-cli#readme",
  tagline: "Your WhatsApp account, searchable on your computer",
  syncs: "chats and their messages",
  signIn: {
    gives: "Lets your agent read your WhatsApp chats, and send messages when you allow it.",
    asks: "Your phone: scan a QR code, or type a pairing code in WhatsApp's Linked devices.",
  },
  hosts: ["web.whatsapp.com", "graph.facebook.com"],
}
