import { existsSync } from "node:fs"
import { CliError } from "@wirecat/cli-base"
import {
  asFirstWord,
  type BaseContext,
  type BaseEnvironment,
  type Closeable,
  environmentOf,
  type Messenger,
} from "@wirecat/cli-core/cli"
import { type MessageStore, openStore } from "@wirecat/cli-core/store"
import type { UpdateEnvironment } from "@wirecat/cli-core/update"
import type { Command } from "commander"
import { type StoredMessages, whatsAppAdapter } from "./adapter/adapter.js"
import { resolveSettings, WA } from "./app.js"
import { diagnoseWhatsApp } from "./diagnose.js"
import { EngineError, type LoginCode, type WhatsAppEngine } from "./engine/contract.js"
import { startGoEngine } from "./engine/go-engine.js"
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
  engine?: (request: EngineRequest) => WhatsAppEngine | Promise<WhatsAppEngine>
  /** Tests run a stand-in for the Go engine binary, through the real client. */
  engineCommand?: { file: string; args: string[] }
  /** Tests shorten how long `session start` waits for the phone's history. */
  historyWait?: { firstMs: number; quietMs: number }
  /** npm, the package manager and this install's path, for `upgrade` and the update notice; tests hand them in. */
  update?: UpdateEnvironment
}

const holderOf = (command: Command): string => {
  const words: string[] = []
  for (let at: Command | null = command; at?.parent; at = at.parent) words.unshift(at.name())
  return words.join(" ") || "wa"
}

const loginHint = (profile: string) => `\`wa ${asFirstWord(profile)}session start\``

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
  const { engine: given, engineCommand } = environmentOf<Environment>(command)
  if (given) return given(request)
  if (!link && !existsSync(request.storePath))
    throw new CliError(
      "authentication_error",
      `profile "${profile}" is not linked to WhatsApp — run ${loginHint(profile)}`,
    )
  try {
    return await startGoEngine({
      ...request,
      env: base.env,
      warn: base.renderer.warn,
      ...(engineCommand ? { command: engineCommand } : {}),
    })
  } catch (error) {
    if (error instanceof EngineError && error.code === "authentication_error")
      throw new CliError("authentication_error", `${error.message} — run ${loginHint(profile)}`)
    if (error instanceof EngineError) throw new CliError(error.code, error.message)
    throw error
  }
}

/** The account's messages in cli-core's store, opened on the first lookup: most commands never need one. */
const storedMessages = (env: NodeJS.ProcessEnv, account: string | null): StoredMessages => {
  let opened: Promise<MessageStore> | undefined
  const store = () => (opened ??= openStore({ env, command: WA.command }))
  const key = { provider: "whatsapp", account: account ?? "" }
  return {
    message: async (chatId, messageId) => (await store()).messages.message(key, messageId, { chatId }),
    newestIncoming: async (chatId, before) => {
      const page = await (await store()).messages.messages(key, chatId, {
        limit: 1,
        outgoing: false,
        ...(before === undefined ? {} : { before }),
      })
      return page.items.at(-1)
    },
    close: async () => {
      await (await opened?.catch(() => undefined))?.close()
    },
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
    track,
  }: {
    method: "qr" | "phone"
    phone: () => Promise<string>
    onCode: (code: LoginCode) => void
    /** Throws when nobody could answer: a store can exist without a device, after a link that did not finish. */
    beforeLink?: () => void
    /** Closed by the caller's deadline as well. */
    track?: (engine: Closeable) => void
  },
): Promise<Linked> => {
  const engine = await openEngine(command, base, { link: true, listen: true })
  track?.(engine)
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
    if (error instanceof EngineError) throw new CliError(error.code, error.message)
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
  diagnose: async (command, base) =>
    diagnoseWhatsApp(base.settings.profile, base.env, environmentOf<Environment>(command).update),
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
    const linked = handedOver.get(command)
    handedOver.delete(command)
    if (linked) return whatsAppAdapter(linked, storedMessages(base.env, linked.self()))
    const engine = await openEngine(command, base, { listen: options.listen === true })
    if (engine.self() === null) {
      await engine.close()
      throw new CliError(
        "authentication_error",
        `profile "${base.settings.profile}" is not linked to WhatsApp — run ${loginHint(base.settings.profile)}`,
      )
    }
    return whatsAppAdapter(engine, storedMessages(base.env, engine.self()))
  },
}
