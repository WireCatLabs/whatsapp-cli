import { existsSync } from "node:fs"
import { CliError } from "@wirecat/cli-base"
import { checkWords } from "@wirecat/cli-core"
import {
  asFirstWord,
  type BaseContext,
  type BaseEnvironment,
  environmentOf,
  type Messenger,
  openProviderLog,
  providerLogPathFor,
  providerRequest,
  runEvent,
} from "@wirecat/cli-core/cli"
import type { UpdateEnvironment } from "@wirecat/cli-core/update"
import type { Command } from "commander"
import { whatsAppAdapter } from "./adapter/adapter.js"
import type { Check } from "./adapter/checks.js"
import { fromEngine } from "./adapter/errors.js"
import { ADMIN_RIGHTS, GROUP_SETTINGS } from "./adapter/groups.js"
import { PRIVACY_SETTINGS } from "./adapter/privacy.js"
import { resolveSettings, WA } from "./app.js"
import type { FetchLike } from "./bot/graph.js"
import { diagnoseWhatsApp } from "./diagnose.js"
import { EngineError, type WhatsAppEngine } from "./engine/contract.js"
import { type EngineCallEnd, startGoEngine } from "./engine/go-engine.js"
import { privateStore } from "./paths.js"

export interface EngineRequest {
  storePath: string
  /** The command holding the connection, named to anyone the engine's lock refuses. */
  holder: string
  listen: boolean
  link: boolean
}

export interface Environment extends BaseEnvironment {
  /** Tests hand in an engine in memory. */
  engine?: (request: EngineRequest) => unknown
  /** Tests run a stand-in for the Go engine binary, through the real client. */
  engineCommand?: { file: string; args: string[] }
  /** Tests shorten how long `session start` waits for the phone's history. */
  historyWait?: { firstMs: number; quietMs: number; slowMs?: number }
  /** npm, the package manager and this install's path, for `upgrade` and the update notice; tests hand them in. */
  update?: UpdateEnvironment
  /** Tests hand in a stand-in for Meta's Graph API; a bot profile never reaches it otherwise. */
  botFetch?: FetchLike
}

const holderOf = (command: Command): string => {
  const words: string[] = []
  for (let at: Command | null = command; at?.parent; at = at.parent) words.unshift(at.name())
  return words.join(" ") || "wa"
}

/** The commands the adapter's messages send a person to, with this profile named first. */
const wordsFor = (profile: string) => checkWords<Check>("wa", profile)

const loginHint = (profile: string) =>
  `\`wa ${asFirstWord(profile)}setup\` in a terminal, or link from WireCat Desktop (Tools → WhatsApp → Manage)`

/** A code to show while linking: the engine's, in the terms a command may see. */
export interface LinkCode {
  login: "qr" | "pair"
  code: string
}

/**
 * Starts the engine for the command's profile, or throws saying how to log in. Only a login (`link`) may start on
 * a profile that has no device yet.
 */
export const openEngine = async (
  command: Command,
  base: Pick<BaseContext, "settings" | "env" | "renderer">,
  { listen = false, link = false }: { listen?: boolean; link?: boolean } = {},
): Promise<WhatsAppEngine> => {
  const { profile } = base.settings
  const request: EngineRequest = { storePath: privateStore(profile, base.env), holder: holderOf(command), listen, link }
  const { engine: given, engineCommand, trackCloseable } = environmentOf<Environment>(command)
  // The engine ignores Ctrl+C and lives until its stdin closes, so the runner must be able to close it on a signal or
  // a deadline: a login waiting for a scan would otherwise keep the process alive.
  // The test hook stays opaque above this composition boundary; fixtures implement the engine contract.
  const engine = given ? ((await given(request)) as WhatsAppEngine) : await startEngine(request, base, engineCommand)
  trackCloseable?.(engine)
  return engine
}

// whatsmeow's warnings always reach cli-core's provider log, which doctor counts; WA_ENGINE_LOG only moves them.
const withProviderLog = (env: NodeJS.ProcessEnv, profile: string): NodeJS.ProcessEnv => {
  if (env.WA_ENGINE_LOG) return env
  try {
    return { ...env, WA_ENGINE_LOG: openProviderLog(providerLogPathFor(WA, profile, env)) }
  } catch {
    return env
  }
}

const startEngine = async (
  request: EngineRequest,
  base: Pick<BaseContext, "settings" | "env" | "renderer">,
  engineCommand: Environment["engineCommand"],
): Promise<WhatsAppEngine> => {
  const { profile } = base.settings
  if (!request.link && !existsSync(request.storePath))
    throw new CliError(
      "authentication_error",
      `profile "${profile}" is not linked to WhatsApp — run ${loginHint(profile)}`,
    )
  try {
    return await startGoEngine({
      ...request,
      env: withProviderLog(base.env, profile),
      warn: base.renderer.warn,
      observe: engineWire,
      ...(engineCommand ? { command: engineCommand } : {}),
    })
  } catch (error) {
    if (error instanceof EngineError && error.code === "authentication_error")
      throw new CliError("authentication_error", `${error.message} — run ${loginHint(profile)}`)
    if (error instanceof EngineError) throw fromEngine(error)
    throw error
  }
}

/** An engine that just linked, kept open for the command's next connect: the first history push comes on it. */
const handedOver = new WeakMap<Command, WhatsAppEngine>()

export interface Linked {
  account: { id: string; name: string | null }
  /** Nothing was asked: the profile was linked before. */
  alreadyLinked: boolean
}

/**
 * Links the profile's device, showing each code through `onCode`. A newly linked engine stays open and is handed to
 * the command's next `connect`; an already linked one is closed and nothing is asked.
 */
export const linkDevice = async (
  command: Command,
  base: Pick<BaseContext, "settings" | "env" | "renderer">,
  {
    method,
    phone,
    onCode,
    beforeLink,
  }: {
    method: "qr" | "phone"
    phone: () => Promise<string>
    onCode: (code: LinkCode) => void
    /** Throws when nobody could answer: a store can exist without a device, after a link that did not finish. */
    beforeLink?: () => void
  },
): Promise<Linked> => {
  const engine = await openEngine(command, base, { link: true, listen: true })
  let keep = false
  try {
    const alreadyLinked = engine.self() !== null
    if (!alreadyLinked) beforeLink?.()
    const account = alreadyLinked
      ? await engine.me()
      : await engine.link(method === "phone" ? { method, phone: await phone() } : { method }, onCode)
    keep = !alreadyLinked
    if (keep) handedOver.set(command, engine)
    return { account: { id: account.jid, name: account.name }, alreadyLinked }
  } catch (error) {
    if (error instanceof EngineError) throw fromEngine(error)
    throw error
  } finally {
    if (!keep) await engine.close()
  }
}

export const SKILL = new URL("../skills/whatsapp-cli/SKILL.md", import.meta.url)

export const WHATSAPP: Messenger = {
  app: WA,
  provider: "whatsapp",
  name: "WhatsApp",
  resolveSettings,
  // A linked device keeps its keys in the private store; a business number has its own `bot mcp`.
  profileState: (profile, env) => (existsSync(privateStore(profile, env)) ? "signed-in" : "signed-out"),
  history: "store",
  // WhatsApp sends a chat's unread count only in the history push; between pushes the store counts new messages.
  unreadCounts: "store",
  historyOnDemand: true,
  // WhatsApp drops the older of two connections, so while serve holds the device every command runs through it.
  connection: "exclusive",
  // Ids are WhatsApp's own strings, so held stretches are keyed by time. A page is one request to the phone for older
  // messages (the adapter's `history`), and WhatsApp's own clients ask 50 at a time.
  fetching: { page: 50, maxPageSize: 50, pause: "2s", jitter: true, maxPages: 20, orderBy: "time" },
  chatArgument: "a chat: its name, or its WhatsApp id (…@lid, …@g.us, …@newsletter)",
  inviteLinks: /chat\.whatsapp\.com\/[A-Za-z0-9]+/i,
  // The chat with yourself has your own id.
  savedChatId: (account) => account.account,
  partnerOf: (chat) => (chat.kind === "dialog" ? chat.id : undefined),
  skill: SKILL,
  diagnose: async (command, base) =>
    diagnoseWhatsApp(base.settings.profile, base.env, environmentOf<Environment>(command).update),
  // What WhatsApp does not have, so the shared commands do not offer it: forum topics, more than one
  // invite link per group (`chats links reset` replaces the one there is), answering every join request at once,
  // channel comments, history shown to people added later, and admins with some rights but not others: every admin
  // gets them all, so `admins add` takes no `--can`.
  topics: false,
  folderOrder: false,
  folderJoin: false,
  inviteLinkCreate: false,
  inviteLinkList: false,
  inviteLinkRevoke: false,
  joinRequestsAll: false,
  channelComments: false,
  readsComments: true,
  addsWithHistory: false,
  // A member's record has no date the account was made, so the moderation rule `newAccount` could never match.
  knowsAccountAge: false,
  // A document carries the name the recipient sees; WhatsApp has no spoiler and no caption above.
  mediaOptions: ["fileName"],
  // A sticker is an uploaded .webp, not one of a set. Meta's Cloud API caps an animated one at 500 KB and a still one
  // at 100 KB; one cap has to let animated stickers through.
  stickerFileBytes: 500 * 1024,
  groupSettings: GROUP_SETTINGS,
  groupPhoto: true,
  groupPhotoRemoval: true,
  profilePhotoTypes: [".jpg", ".jpeg"],
  adminRights: ADMIN_RIGHTS,
  pickAdminRights: false,
  // A WhatsApp poll stays open, and any vote in it can be changed; everyone sees who voted for what.
  // Who reacted comes from the store, so it lists the reactions the archive received, not a live query.
  reactionsList: true,
  pollClose: false,
  pollRevote: false,
  pollVoters: true,
  pollAnonymous: false,
  // Every message goes as the account, at once, with a notification.
  silentSends: false,
  sendAs: false,
  scheduledSends: false,
  // A pin is for the whole chat and tells its members; it ends after one of the lengths WhatsApp's apps offer.
  quietPins: false,
  pinDurations: [86_400, 604_800, 2_592_000],
  pinDefaultDuration: 604_800,
  // Nothing sends unless a typed command asked: WhatsApp bans accounts that answer like a bot.
  autoReplies: false,
  chatMute: true,
  chatDeletion: true,
  chatArchive: true,
  chatPin: true,
  chatMarkUnread: true,
  never: ["endOtherSessions", "removeContact"],
  lacks: [
    "chatEvents",
    "createFolder",
    "updateFolder",
    "deleteFolder",
    "addContact",
    "renameContact",
    "importContacts",
  ],
  deleteForMe: true,
  privacy: true,
  privacySettings: PRIVACY_SETTINGS,
  messageStars: true,
  connect: async (command, base, options = {}) => {
    const linked = handedOver.get(command)
    handedOver.delete(command)
    const words = wordsFor(base.settings.profile)
    if (linked) return whatsAppAdapter(linked, options.stored, words, base.renderer.warn)
    const engine = await openEngine(command, base, { listen: options.listen === true })
    if (engine.self() === null) {
      await engine.close()
      throw new CliError(
        "authentication_error",
        `profile "${base.settings.profile}" is not linked to WhatsApp — run ${loginHint(base.settings.profile)}`,
      )
    }
    return whatsAppAdapter(engine, options.stored, words, base.renderer.warn)
  },
}

/** One engine request as a wire line of the run under way; this side sends each request once, so each is attempt 1. */
export const engineWire = (op: string) => {
  const end = providerRequest(op, runEvent, { transport: "wa-engine", attempt: 1 })
  return ({ code, reason, ...rest }: EngineCallEnd) =>
    end({ ...rest, ...(code ? { errorCode: code, ...(reason ? { providerError: reason } : {}) } : {}) })
}
