import { existsSync } from "node:fs"
import { CliError } from "@wirecat/cli-base"
import { asFirstWord, type BaseEnvironment, environmentOf, type Messenger } from "@wirecat/cli-core/cli"
import { whatsAppAdapter } from "./adapter/adapter.js"
import { resolveSettings, WA } from "./app.js"
import type { WhatsAppEngine } from "./engine/contract.js"
import { sessionFile } from "./paths.js"

export interface Environment extends BaseEnvironment {
  /** Tests hand in an engine in memory. */
  engine?: (options: { sessionPath: string; listen: boolean }) => WhatsAppEngine | Promise<WhatsAppEngine>
}

export const SKILL = new URL("../skills/whatsapp-cli/SKILL.md", import.meta.url)

export const WHATSAPP: Messenger = {
  app: WA,
  provider: "whatsapp",
  name: "WhatsApp",
  resolveSettings,
  history: "store",
  // Ids are WhatsApp's own strings, so held stretches are keyed by time. Paging applies only to on-demand history
  // from the phone, which is not built yet.
  fetching: { page: 50, pause: "2s", jitter: true, maxPages: 20, orderBy: "time" },
  chatArgument: "a chat: its name, or its WhatsApp id (…@lid, …@g.us)",
  inviteLinks: /chat\.whatsapp\.com\/[A-Za-z0-9]+/i,
  // The chat with yourself has your own id.
  savedChatId: (account) => account.account,
  partnerOf: (chat) => (chat.kind === "dialog" ? chat.id : undefined),
  skill: SKILL,
  // What WhatsApp does not have, so the shared commands do not offer it: forum topics, folders, more than one
  // invite link per group, channel comments, and history shown to people added later.
  topics: false,
  folderOrder: false,
  folderJoin: false,
  inviteLinkCreate: false,
  inviteLinkList: false,
  channelComments: false,
  addsWithHistory: false,
  connect: async (command, base, options = {}) => {
    const { profile } = base.settings
    const sessionPath = sessionFile(profile, base.env)
    const given = environmentOf<Environment>(command).engine
    if (given) return whatsAppAdapter(await given({ sessionPath, listen: options.listen === true }))
    const login = `\`wa ${asFirstWord(profile)}session start\``
    throw new CliError(
      "authentication_error",
      existsSync(sessionPath)
        ? `profile "${profile}" is linked, but this build has no WhatsApp engine yet`
        : `profile "${profile}" is not linked to WhatsApp — run ${login} once it ships`,
    )
  },
}
