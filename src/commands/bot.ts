import { CliError, isCliError } from "@wirecat/cli-base"
import type { ManifestOperation } from "@wirecat/cli-base/codegen"
import {
  type ApiCommandInput,
  type BotMcp,
  type BotMessenger,
  BotTokenStore,
  botContext,
  botCopy,
  checkApiBody,
  checkApiParameter,
  environmentOf,
  generatedApiCommand,
  overrideSharedContract,
  ownerOnlyOption,
  parseApiJson,
  type RunBotCommand,
} from "@wirecat/cli-core/cli"
import {
  DEFAULT_PERMISSIONS,
  guardedWrite,
  levelFor,
  newOperationId,
  readUpload,
  uploadBlob,
} from "@wirecat/cli-core/sends"
import type { Command } from "commander"
import { type BotSettings, resolveSettings, WA } from "../app.js"
import { required, whatsappBotAdapter } from "../bot/adapter.js"
import { operations } from "../bot/generated/manifest.js"
import { schemas } from "../bot/generated/schemas.js"
import { type GraphCall, GraphTransport } from "../bot/graph.js"
import { mimeOf } from "../bot/mime.js"
import { type Environment, SKILL } from "../messenger.js"

export const settingsOf = (command: Command) => {
  const { env } = environmentOf<Environment>(command)
  return resolveSettings(command.optsWithGlobals(), { env: env ?? process.env, kind: "bot" }) as ReturnType<
    typeof resolveSettings
  > &
    BotSettings
}

const storeOf = (command: Command, profile: string) => {
  const { keyring, env } = environmentOf<Environment>(command)
  return new BotTokenStore({ app: WA, profile, ...(env ? { env } : {}), ...(keyring ? { keyring } : {}) })
}

/** When the person last wrote to the number, from the local copy `bot watch` keeps. */
const lastInbound = (botId: string) => async (chat: string) => {
  const copy = botCopy("whatsapp-bot")
  try {
    const page = await copy.read((store) =>
      store.messages.messages(copy.accountOf(botId), chat, { limit: 1, outgoing: false }),
    )
    const last = page.items.at(-1)
    return last ? new Date(last.timestamp) : undefined
  } catch {
    return undefined
  }
}

/** What the shared `bot` commands need from wa: a Graph API client for the profile's business number. */
export const WHATSAPP_BOT: BotMessenger = {
  app: WA,
  provider: "whatsapp-bot",
  name: "WhatsApp",
  identity: true,
  manyWebhooks: false,
  secrets: [
    {
      name: "app-secret",
      description: "the Meta app's secret, from App settings → Basic; checks each webhook delivery",
    },
    {
      name: "verify-token",
      description: "a string you choose and type in the App Dashboard's webhook setup too; answers Meta's handshake",
    },
  ],
  resolveSettings,
  connect: async (command, token, { stop, events } = {}) => {
    const environment = environmentOf<Environment>(command)
    const settings = settingsOf(command)
    const graph = new GraphTransport({
      token,
      version: settings.graphVersion,
      ...(environment.botFetch ? { fetch: environment.botFetch } : {}),
      ...(stop ? { signal: stop } : {}),
      ...(events ? { events } : {}),
    })
    const tokens = storeOf(command, settings.profile)
    return whatsappBotAdapter(graph, settings, settings.profile, {
      secrets: () => ({
        appSecret: tokens.readSecret("app-secret")?.secret,
        verifyToken: tokens.readSecret("verify-token")?.secret,
      }),
      keepVerifyToken: (secret) => {
        tokens.writeSecret("verify-token", secret)
      },
      ...(settings.phoneNumberId ? { lastInbound: lastInbound(settings.phoneNumberId) } : {}),
    })
  },
  tokenStore: (command, profile) => storeOf(command, profile),
}

type Run = (argv: string[], environment?: Environment) => Promise<number>

/** `bot mcp`. The program hands in its own `run`: importing it here would close a loop through the program. */
export const botMcp = (run: Run): BotMcp => ({
  program: async (): Promise<RunBotCommand> => (argv, environment) => run(argv, environment as Environment),
  skill: SKILL,
})

/** Path parameters a bot profile's settings fill when the flag is not given. */
const FROM_SETTINGS: Readonly<Record<string, keyof Pick<BotSettings, "phoneNumberId" | "wabaId">>> = {
  "Phone-Number-ID": "phoneNumberId",
  "WABA-ID": "wabaId",
  "WhatsApp-Business-Account-ID": "wabaId",
}
const SETTING_NAME = { phoneNumberId: "phone_number_id", wabaId: "waba_id" } as const

const defaults = {
  ...DEFAULT_PERMISSIONS,
  ...Object.fromEntries(
    operations
      .filter((operation) => operation.effect === "destructive")
      .map((operation) => [`bot.api.${operation.command}`, "ask" as const]),
  ),
}
const keyOf = (operation: ManifestOperation) => `bot.api.${operation.command}`

const pathOf = (
  operation: ManifestOperation,
  given: Record<string, string>,
  settings: BotSettings & { profile: string },
) => {
  if (operation.binding.kind !== "http") throw new Error(`${operation.id} is not an HTTP operation`)
  return operation.binding.path.replace(/^\/\{Version\}/, "").replace(/\{([^}]+)\}/g, (_, name: string) => {
    const setting = FROM_SETTINGS[name]
    const value =
      given[name] ?? (setting ? required(settings[setting], SETTING_NAME[setting], settings.profile) : undefined)
    if (value === undefined)
      throw new CliError("validation_error", `${operation.command} needs --${name.toLowerCase()}`)
    return encodeURIComponent(value)
  })
}

/**
 * The spec lags the live API — no `recipient`, bodies closed with `additionalProperties: false` — so a body it
 * refuses is warned about and sent: Meta is the judge. A form or multipart body is not checked against its
 * schema at all: its file field holds a local path here, not what the schema describes.
 */
const checkedBody = (operation: ManifestOperation, text: string | undefined, warn: (line: string) => void) => {
  if (operation.request?.contentType) {
    if (text !== undefined && text.trim() !== "") parseApiJson(text)
    return text
  }
  try {
    return checkApiBody(operation, text, schemas)
  } catch (error) {
    if (!isCliError(error) || !error.message.startsWith("the body does not match")) throw error
    warn(`${error.message} — sent anyway: Meta's file lags the live API`)
    return text
  }
}

/** A JSON object's fields as a form, a field holding `@<path>` as that file, read the way `messages send --file` reads one. */
const formOf = async (
  operation: ManifestOperation,
  text: string | undefined,
  read: (path: string) => Promise<{ blob: Blob; name: string }>,
): Promise<FormData | URLSearchParams> => {
  const fields = text === undefined || text.trim() === "" ? {} : parseApiJson(text)
  if (typeof fields !== "object" || fields === null || Array.isArray(fields))
    throw new CliError("validation_error", "a form body is a JSON object of its fields")
  const entries = Object.entries(fields as Record<string, unknown>).filter(([, value]) => value !== undefined)
  const asText = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value))
  if (operation.request?.contentType !== "multipart/form-data") {
    const form = new URLSearchParams()
    for (const [name, value] of entries) form.append(name, asText(value))
    return form
  }
  const form = new FormData()
  for (const [name, value] of entries) {
    if (typeof value === "string" && value.startsWith("@")) {
      const file = await read(value.slice(1))
      form.append(name, file.blob, file.name)
    } else form.append(name, asText(value))
  }
  return form
}

/** `bot api`: every kept Cloud API operation, from Meta's OpenAPI file — docs/dev/bot-api-coverage.md. */
export const whatsappBotApiCommand = (): Command => {
  const contextOf = (command: Command) => botContext(command.parent ?? command, WHATSAPP_BOT)
  const group = generatedApiCommand({
    operations,
    description: "every Cloud API operation wa keeps, generated from Meta's OpenAPI file",
    checkParameter: (name, schema, raw) => checkApiParameter(name, schema, raw, schemas),
    before: (command, operation) => {
      const context = contextOf(command)
      if (context.settings.offline)
        throw new CliError("validation_error", "bot api needs Meta; --offline reads only the local copy")
      const { level } = levelFor(context.settings.permissions, keyOf(operation), defaults)
      if (level === "deny" || (operation.effect !== "read" && level === "readonly"))
        throw new CliError("permission_error", "this Cloud API operation is not allowed by this profile's permissions")
    },
    execute: async (command, operation, input: ApiCommandInput) => {
      const context = contextOf(command)
      const settings = settingsOf(command)
      const anyFile = group.opts<{ allowAnyFile?: boolean }>().allowAnyFile === true
      const text = checkedBody(operation, input.body, context.renderer.warn)
      const path = pathOf(operation, input.path, settings)
      const form = operation.request?.contentType
        ? await formOf(operation, text, async (file) => {
            const upload = await readUpload("file", file, { app: WA, env: context.env, anyFile })
            return { blob: await uploadBlob(upload.source, mimeOf(upload.name)), name: upload.name }
          })
        : undefined
      const binding = operation.binding
      if (binding.kind !== "http") throw new Error(`${operation.id} is not an HTTP operation`)
      const call: GraphCall = {
        path,
        endpoint: binding.path.replace(/^\/\{Version\}/, "").replace(/\{[^}]+\}/g, ":id"),
        method: binding.method === "DELETE" ? "DELETE" : binding.method === "GET" ? "GET" : "POST",
        query: input.query,
        ...(form ? { form } : text !== undefined && text.trim() !== "" ? { json: text } : {}),
        reads: operation.effect === "read",
        operation: operation.id,
      }
      await context.run(async (events) => {
        const tokens = context.tokens.read()
        if (!tokens)
          throw new CliError(
            "authentication_error",
            `no access token for profile "${context.profile}" — run \`${context.words} auth set\``,
          )
        const graph = new GraphTransport({
          token: tokens.token,
          version: settings.graphVersion,
          ...(environmentOf<Environment>(command).botFetch
            ? { fetch: environmentOf<Environment>(command).botFetch }
            : {}),
          events,
        })
        const result =
          operation.effect === "read"
            ? await graph.call(call)
            : await guardedWrite(
                context.guard(defaults),
                { operationId: newOperationId(), key: keyOf(operation), kind: "message", chatId: null },
                () => graph.call(call),
              )
        context.renderer.result(result)
      })
    },
  })
  overrideSharedContract(
    group,
    "This provider accepts multipart @path uploads, with an explicit owner-only file-policy exception.",
    (command) => {
      command.addOption(
        ownerOnlyOption("--allow-any-file", "read @path files even from credential folders or this CLI's own folders"),
      )
    },
  )
  return group
}
