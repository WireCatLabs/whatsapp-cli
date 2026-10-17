/**
 * What `wa` cannot test offline, each with the reason and where it is checked instead. An entry
 * that names a command or option the program no longer has fails `pnpm test:matrix`.
 * `command` ending in ` *` covers every subcommand under it.
 */
export interface Untested {
  command: string
  option?: string
  reason: string
}

const SHARED = [
  "account *",
  "chats *",
  "contacts *",
  "messages *",
  "inbox",
  "review",
  "watch",
  "serve",
  "server *",
  "store *",
  "conversations *",
  "attachments *",
  "tags *",
  "mentions *",
  "stats *",
  "tasks *",
  "search *",
  "searches *",
  "replies *",
  "recipients *",
  "sends *",
  "runs *",
  "config *",
  "doctor",
  "doctor *",
  "commands",
  "commands *",
  "complete",
  "mcp",
  "mcp *",
  "skill *",
]

export const UNTESTED: Untested[] = [
  // A shared cli-core command mounted unchanged: cli-core's suite drives every option over its fake adapter. wa's own
  // tests replace these entries one group at a time, as each gets an engine path (docs/dev/BACKLOG.md).
  ...SHARED.map((command) => ({
    command,
    reason:
      "shared cli-core command mounted unchanged; tested in cli-core (src/cli/messenger/*.test.ts) over its fake adapter",
  })),
  {
    command: "doctor",
    option: "--online",
    reason:
      "connects to WhatsApp, which needs a linked device; cli-core's doctor tests drive it over the fake adapter, " +
      "and src/messenger.test.ts covers wa's own offline block",
  },
  {
    command: "config show",
    option: "--bot",
    reason:
      "a shared cli-core option; src/update.test.ts runs `config show` only to see the update notice after a command",
  },
  {
    command: "",
    option: "--dry-run",
    reason:
      "a dry run ends before the preAction hook that logs argv; src/program.test.ts checks a dry-run send starts no engine",
  },
  ...["--limit", "--cursor", "--transcribe", "--model"].map((option) => ({
    command: "messages list",
    option,
    reason:
      "a store read of cli-core's shared command, tested in cli-core (src/cli/messenger/messenger.test.ts); " +
      "src/message-actions.test.ts drives only --mark-read, the one option that reaches the engine",
  })),
  ...[
    "--verbose",
    "--quiet",
    "--trace",
    "--debug",
    "--timeout",
    "--no-input",
    "--max-input-bytes",
    "--max-output-bytes",
    "--brief",
    "--full",
    "--yes",
    "--record",
    "--no-record",
  ].map((option) => ({
    command: "",
    option,
    reason:
      "a global option of cli-core's shared program, tested in cli-core (src/cli/*.test.ts); wa adds nothing to it",
  })),
]
