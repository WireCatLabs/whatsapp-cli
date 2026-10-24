import { writeFileSync } from "node:fs"
import { CliError } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { type QueryRegistry, queryFieldsOf } from "@wirecat/cli-base/query"
import {
  type BotContext,
  botContext,
  botTemplate,
  environmentOf,
  FETCH,
  itemOf,
  listOf,
  parseApiJson,
  queryTerms,
  REMOTE_READ,
  REMOTE_WRITE,
  renderAnswer,
  withQuery,
} from "@wirecat/cli-core/cli"
import { guardedWrite, newOperationId } from "@wirecat/cli-core/sends"
import { Command } from "commander"
import { required } from "../bot/adapter.js"
import { GraphTransport } from "../bot/graph.js"
import { addressOf } from "../bot/messaging.js"
import type { Environment } from "../messenger.js"
import { settingsOf, WHATSAPP_BOT } from "./bot.js"

/** The profile's Graph client, its settings and its bot context, for a command of wa's own under `bot`. */
const graphOf = (command: Command, context: BotContext) => {
  const settings = settingsOf(command)
  const stored = context.tokens.read()
  if (!stored)
    throw new CliError(
      "authentication_error",
      `no access token for profile "${context.profile}" — run \`${context.words} auth set\``,
    )
  const { botFetch } = environmentOf<Environment>(command)
  return {
    settings,
    graph: (events: Parameters<Parameters<BotContext["run"]>[0]>[0]) =>
      new GraphTransport({
        token: stored.token,
        version: settings.graphVersion,
        ...(botFetch ? { fetch: botFetch } : {}),
        events,
      }),
  }
}

const online = (command: Command) => {
  const context = botContext(command, WHATSAPP_BOT)
  if (context.settings.offline)
    throw new CliError("validation_error", `--offline reads the local copy; \`${command.name()}\` has to ask Meta`)
  return context
}

interface Template {
  name?: string
  status?: string
  language?: string
  category?: string
}

const TEMPLATES_QUERY: QueryRegistry = {
  entity: "bot_template",
  backend: "native",
  fields: queryFieldsOf(botTemplate, { native: ["name"], examples: { name: "name:hello_world" } }).map((field) =>
    field.native
      ? { ...field, operators: field.operators.filter((operator) => operator === "term" || operator === "phrase") }
      : field,
  ),
}

/**
 * `bot templates`: the approved messages a business may send outside the 24 hours after a person last wrote. Only
 * WhatsApp has them; MAX and Telegram bots write freely.
 */
export const botTemplatesCommand = (): Command => {
  const command = new Command("templates").description(
    "approved messages: the only kind WhatsApp delivers 24 hours after a person wrote",
  )

  withQuery(
    annotate(command.command("list"), {
      effects: REMOTE_READ,
      examples: ["wa cloudtest bot templates list", "wa cloudtest bot templates list name:hello_world"],
    }),
    TEMPLATES_QUERY,
  )
    .description("the business account's templates, with status, language and category")
    .action(async function (this: Command, words: string[]) {
      const name = queryTerms(words, TEMPLATES_QUERY, "bot templates list").get("name")
      const context = online(this)
      const { settings, graph } = graphOf(this, context)
      await context.run(async (events) => {
        const answer = (await graph(events).call({
          path: `/${required(settings.wabaId, "waba_id", context.profile)}/message_templates`,
          method: "GET",
          query: { fields: "name,status,language,category", limit: "100", ...(name ? { name } : {}) },
          reads: true,
          operation: "listTemplates",
        })) as { data?: Template[]; paging?: { next?: string } }
        const items = (answer.data ?? []).map(({ name, status, language, category }) => ({
          name: name ?? null,
          status: status ?? null,
          language: language ?? null,
          category: category ?? null,
        }))
        renderAnswer(
          this,
          context,
          listOf("bot templates list", { items, limit: 100, has_more: Boolean(answer.paging?.next) }),
        )
      })
    })

  annotate(command.command("send"), {
    effects: REMOTE_WRITE,
    examples: [
      "wa cloudtest bot templates send 70000000001 hello_world",
      `wa cloudtest bot templates send 70000000001 order_ready es --payload '[{"type":"body","parameters":[{"type":"text","text":"42"}]}]'`,
    ],
  })
    .description("send an approved template; hello_world is pre-approved on the test number")
    .argument("<chat>", "a phone number in digits, or user:<id> as `bot watch` shows it")
    .argument("<name>", "the template's name, as `bot templates list` shows it")
    .argument("[language]", "the template's language code", "en_US")
    .option("--payload <json>", "the values for the template's placeholders, as Meta's components array")
    .action(async function (this: Command, chat: string, name: string, language: string) {
      const context = online(this)
      const { settings, graph } = graphOf(this, context)
      const { payload } = this.opts<{ payload?: string }>()
      const parts = payload === undefined ? undefined : parseApiJson(payload)
      if (parts !== undefined && !Array.isArray(parts))
        throw new CliError("validation_error", "--payload is a JSON array, as Meta's template components")
      const ref = context.chatRef(chat)
      const body = JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        ...addressOf(ref),
        type: "template",
        template: { name, language: { code: language }, ...(parts ? { components: parts } : {}) },
      })
      await context.run(async (events) => {
        const answer = await guardedWrite(
          context.guard(),
          { operationId: newOperationId(), key: "bot.templates.send", kind: "message", chatId: ref },
          () =>
            graph(events).call({
              path: `/${required(settings.phoneNumberId, "phone_number_id", context.profile)}/messages`,
              method: "POST",
              json: body,
              reads: false,
              operation: "sendMessage",
            }),
        )
        const id = (answer as { messages?: { id?: string }[] }).messages?.[0]?.id ?? null
        renderAnswer(this, context, itemOf({ chat: ref, template: name, language, id }))
      })
    })

  return command
}

/** `bot media`: a file a person sent, by the media id `bot watch` kept. */
export const botMediaCommand = (): Command => {
  const command = new Command("media").description("files people sent to the number")

  annotate(command.command("download"), {
    effects: FETCH,
    examples: ["wa cloudtest bot media download 300000000000003 --output photo.jpg"],
  })
    .description("save a file someone sent, by its media id; Meta's link for it lasts 5 minutes")
    .argument("<media-id>", "the media id, from the attachment `bot watch --jsonl` printed")
    .requiredOption("--output <file>", "where to write the file")
    .action(async function (this: Command, mediaId: string) {
      const context = online(this)
      const { graph } = graphOf(this, context)
      const { output } = this.opts<{ output: string }>()
      if (!/^\d+$/.test(mediaId)) throw new CliError("validation_error", "a media id is digits")
      await context.run(async (events) => {
        const client = graph(events)
        const media = (await client.call({
          path: `/${mediaId}`,
          method: "GET",
          reads: true,
          operation: "getMedia",
        })) as { url?: string; mime_type?: string; file_size?: number }
        if (!media.url) throw new CliError("invalid_response", "Meta named no address for the file")
        const file = await client.download(media.url, "downloadMedia")
        writeFileSync(output, file.bytes, { mode: 0o600 })
        renderAnswer(
          this,
          context,
          itemOf({ id: mediaId, path: output, bytes: file.bytes.length, mime: media.mime_type ?? file.type }),
        )
      })
    })

  return command
}
