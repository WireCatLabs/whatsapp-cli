import { exitCodeFor, processStreams } from "@wirecat/cli-base"
import {
  accountCommand,
  attachmentsCommand,
  botCommand,
  chatsCommand,
  commandsCommand,
  completeCommand,
  configCommand,
  contactsCommand,
  conversationsCommand,
  createProgram as create,
  doctorCommand,
  floodCommand,
  imagesCommand,
  inboxCommand,
  mcpCommand,
  mentionsCommand,
  messagesCommand,
  metadataCommand,
  modelsCommand,
  type ProgramDefinition,
  pollsCommand,
  reactionsCommand,
  recipientsCommand,
  reviewCommand,
  run as runCli,
  runsCommand,
  searchCommand,
  searchesCommand,
  sendsCommand,
  serveCommand,
  serverCommand,
  skillCommand,
  statsCommand,
  storeCommand,
  tagsCommand,
  tasksCommand,
  watchCommand,
} from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { CONFIG, WA } from "./app.js"
import { botMcp, WHATSAPP_BOT, whatsappBotApiCommand } from "./commands/bot.js"
import { botMediaCommand, botTemplatesCommand } from "./commands/bot-templates.js"
import { sessionCommand } from "./commands/session.js"
import { setupCommand } from "./commands/setup.js"
import { upgradeCommand } from "./commands/update.js"
import { type Environment, SKILL, WHATSAPP } from "./messenger.js"
import { updateNotice } from "./update.js"

/**
 * A revoked or missing login fails the same on every retry, and a restart during a ban would connect to WhatsApp
 * again while it holds the account. `device.replaced` and `client.outdated` exit 12 with a crashed engine, which
 * should restart, so an exit code cannot keep them from it.
 */
export const NO_RESTART_ON = [exitCodeFor("authentication_error"), exitCodeFor("permission_error")]

const definition: ProgramDefinition = {
  app: WA,
  configuration: CONFIG,
  configure: (program) => {
    program.addHelpText(
      "after",
      "\nGetting started after installation:\n" +
        "  wa personal setup               Guided first run as profile personal; about 5 minutes\n" +
        "  wa personal setup --agent codex Link and install your agent's skill\n" +
        "  wa setup --help                 Linking choices and examples\n" +
        "Every account command names its profile first: `wa personal chats list`.\n" +
        "\nFor agents:\n" +
        "  wa skill show                   Read the bundled instructions before using WhatsApp\n" +
        "  wa commands --json              Discover commands, arguments and flags\n",
    )
    program.commands
      .find((command) => command.name() === "skill")
      ?.addHelpText(
        "after",
        "\nBefore the first link, an agent can read `wa skill show`; no device is needed.\n" +
          "Run `wa personal setup --agent codex` for guided linking and skill installation.\n" +
          "To install instructions separately: `wa skill install --for all`.\n",
      )
  },
  commands: () => [
    sessionCommand(),
    setupCommand(),
    accountCommand(WHATSAPP),
    chatsCommand(WHATSAPP),
    contactsCommand(WHATSAPP),
    messagesCommand(WHATSAPP),
    reactionsCommand(WHATSAPP),
    pollsCommand(WHATSAPP),
    modelsCommand(WHATSAPP),
    inboxCommand(WHATSAPP),
    reviewCommand(WHATSAPP),
    watchCommand(WHATSAPP),
    serveCommand(WHATSAPP),
    serverCommand(WHATSAPP, { unit: { noRestartOn: NO_RESTART_ON } }),
    storeCommand(WHATSAPP),
    conversationsCommand(WHATSAPP),
    attachmentsCommand(WHATSAPP),
    tagsCommand(WHATSAPP),
    mentionsCommand(WHATSAPP),
    imagesCommand(WHATSAPP),
    metadataCommand(WHATSAPP),
    statsCommand(WHATSAPP),
    tasksCommand(WHATSAPP),
    searchCommand(WHATSAPP),
    searchesCommand(WHATSAPP),
    floodCommand(WHATSAPP),
    recipientsCommand(WHATSAPP),
    sendsCommand(WHATSAPP),
    runsCommand(WA),
    configCommand(WA, CONFIG),
    doctorCommand(WHATSAPP),
    commandsCommand(WA),
    completeCommand(WHATSAPP, CONFIG),
    upgradeCommand(),
    mcpCommand(WHATSAPP),
    botCommand({ ...WHATSAPP_BOT, mcp: botMcp(run) })
      .addCommand(whatsappBotApiCommand())
      .addCommand(botTemplatesCommand())
      .addCommand(botMediaCommand()),
    skillCommand(WA, SKILL),
  ],
}

export const createProgram = (): Command => create(definition)

/** Never throws: every outcome is an exit code, and a failure is said once, on stderr. */
export const run = async (argv: string[], environment: Environment = {}): Promise<number> => {
  const notice = updateNotice(argv, {
    ...(environment.tty === undefined ? {} : { tty: environment.tty }),
    ...(environment.update ? { environment: environment.update } : {}),
    ...(environment.env ? { env: environment.env } : {}),
  })
  const code = await runCli(argv, definition, environment as Record<string, unknown>)
  const line = await notice
  if (line && code === 0) (environment.streams ?? processStreams).diagnostic(line)
  return code
}
