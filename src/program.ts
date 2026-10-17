import { appendFileSync } from "node:fs"
import { exitCodeFor, processStreams } from "@wirecat/cli-base"
import {
  accountCommand,
  attachmentsCommand,
  chatsCommand,
  commandsCommand,
  completeCommand,
  configCommand,
  contactsCommand,
  conversationsCommand,
  createProgram as create,
  doctorCommand,
  inboxCommand,
  mcpCommand,
  mentionsCommand,
  messagesCommand,
  type ProgramDefinition,
  recipientsCommand,
  repliesCommand,
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
import { sessionCommand } from "./commands/session.js"
import { setupCommand } from "./commands/setup.js"
import { upgradeCommand } from "./commands/update.js"
import { type Environment, SKILL, WHATSAPP } from "./messenger.js"
import { updateNotice } from "./update.js"

/** A revoked or missing login fails the same on every retry. */
export const NO_RESTART_ON = [exitCodeFor("authentication_error")]

const definition: ProgramDefinition = {
  app: WA,
  configuration: CONFIG,
  configure: (program) => {
    program.addHelpText(
      "after",
      "\nGetting started after installation:\n" +
        "  wa personal setup               Guided first run as profile personal; about 5 minutes\n" +
        "  wa personal setup --agent codex Link and install your agent's skill\n" +
        "  wa setup --help                 Linking choices, examples and Windows instructions\n" +
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
  commands: () =>
    loggingArgv([
      sessionCommand(),
      setupCommand(),
      accountCommand(WHATSAPP),
      chatsCommand(WHATSAPP),
      contactsCommand(WHATSAPP),
      messagesCommand(WHATSAPP),
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
      statsCommand(WHATSAPP),
      tasksCommand(WHATSAPP),
      searchCommand(WHATSAPP),
      searchesCommand(WHATSAPP),
      repliesCommand(WHATSAPP),
      recipientsCommand(WHATSAPP),
      sendsCommand(WHATSAPP),
      runsCommand(WA),
      configCommand(WA, CONFIG),
      doctorCommand(WHATSAPP),
      commandsCommand(WA),
      completeCommand(WHATSAPP, CONFIG),
      upgradeCommand(),
      mcpCommand(WHATSAPP),
      skillCommand(WA, SKILL),
    ]),
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
  const argvLog = process.env.WA_TEST_ARGV_LOG
  // --version ends before any action, so the preAction hook never sees it.
  if (argvLog && code === 0 && argv.some((word) => word === "--version" || word === "-V"))
    appendFileSync(argvLog, `${JSON.stringify({ command: "", options: ["--version"] })}\n`)
  if (line && code === 0) (environment.streams ?? processStreams).diagnostic(line)
  return code
}

/**
 * Under vitest only: which command a test drove and the option names it gave, never a value
 * (`pnpm test:matrix`). The hook sits on each top-level command because the root program is built
 * inside cli-core; commander runs an ancestor's preAction hook for every subcommand.
 */
function loggingArgv(commands: Command[]): Command[] {
  const file = process.env.WA_TEST_ARGV_LOG
  if (file) for (const command of commands) command.hook("preAction", (_self, action) => logParsed(file, action))
  return commands
}

const logParsed = (file: string, action: Command): void => {
  const words: string[] = []
  const options: string[] = []
  for (let at: Command | null = action; at; at = at.parent) {
    if (at.parent) words.unshift(at.name())
    for (const option of at.options) {
      const key = option.attributeName()
      if (at.getOptionValueSource(key) !== "cli" || !option.long) continue
      if (option.negate === (at.getOptionValue(key) === false)) options.push(option.long)
    }
  }
  appendFileSync(file, `${JSON.stringify({ command: words.join(" "), options })}\n`)
}
