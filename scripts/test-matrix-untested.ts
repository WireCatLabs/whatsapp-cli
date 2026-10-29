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

/** A shared cli-core group mounted unchanged, and the cli-core tests that drive it over the store or the system. */
const SHARED: Record<string, string> = {
  "store *": "src/cli/messenger/store-maintenance.test.ts, gaps.test.ts and store-mode.test.ts",
  "conversations *": "src/cli/messenger/analysis.test.ts and src/services/conversations.test.ts",
  "attachments *":
    "src/cli/messenger/attachments.test.ts, media-archive.test.ts, media-archive-command.test.ts, media-archive-move.test.ts and src/background/daily-archive-timer.test.ts",
  "tags *": "src/cli/messenger/tags.test.ts",
  "mentions *": "src/cli/messenger/mentions.test.ts",
  "images *": "src/cli/messenger/images-command.test.ts",
  "models *": "src/cli/messenger/models-command.test.ts",
  "stats *": "src/cli/messenger/stats-command.test.ts and src/services/counters.test.ts",
  "tasks *": "src/cli/messenger/tasks.test.ts",
  "search *": "src/cli/messenger/search-envelope.test.ts and src/services/messages-search-everywhere.test.ts",
  "searches *": "src/cli/messenger/searches.test.ts",
  "recipients *": "src/cli/messenger/messenger.test.ts («recipients»)",
  "sends *": "src/cli/messenger/messenger.test.ts and src/sends/journal.test.ts",
  "runs *": "src/cli/runs/command.test.ts and search.test.ts",
  "config *": "src/cli/config-command.test.ts",
  "commands *": "src/cli/commands-command.test.ts",
  complete: "src/cli/messenger/complete-command.test.ts",
  "mcp *": "src/cli/messenger/mcp-doctor.test.ts and src/mcp/mcp.test.ts",
  "skill *": "src/cli/skill-command.test.ts",
}

/** Answered from the local store by cli-core's shared command; wa adds nothing to it. */
const cliCore = (tests: string, rows: string[][]): Untested[] =>
  rows.map(([command, option]) => ({
    command: command as string,
    ...(option ? { option } : {}),
    reason: `cli-core's shared command over the local store, tested in cli-core ${tests}`,
  }))

/** cli-core's shared bot commands, mounted unchanged over wa's Cloud API adapter. */
const SHARED_BOT: Record<string, string> = {
  "bot auth *": "src/cli/bot/command.test.ts and webhook-receiver.test.ts («bot auth set --secret»)",
  "bot list": "src/cli/bot/command.test.ts",
  "bot chats *": "src/cli/bot/admins, moderation and people tests; the Cloud API has no chat list, so wa refuses them",
  "bot messages *": "src/cli/bot/messages.test.ts",
  "bot search *": "src/cli/bot/people.test.ts",
  "bot contacts *": "src/cli/bot/people.test.ts",
  "bot recipients *": "src/cli/bot/bot.test.ts",
  "bot sends *": "src/cli/bot/bot.test.ts",
  "bot watch": "src/cli/bot/watch.test.ts and webhook-receiver.test.ts",
  "bot callbacks *": "src/cli/bot/command.test.ts; WhatsApp has no button callbacks, so wa refuses it",
  "bot commands *": "src/cli/bot/watch.test.ts («bot commands»); WhatsApp has no command menu, so wa refuses it",
  "bot webhooks *": "src/cli/bot/watch.test.ts («bot webhooks»)",
}

export const UNTESTED: Untested[] = [
  ...Object.entries(SHARED_BOT).map(([command, tests]) => ({
    command,
    reason: `shared cli-core bot command mounted unchanged; tested in cli-core (${tests}), wa's adapter in src/commands/bot.test.ts`,
  })),
  ...["--md", "--html", "--photo", "--as-file", "--voice", "--allow-any-file"].map((option) => ({
    command: "bot messages send",
    option,
    reason:
      "cli-core's shared option, parsed in cli-core (src/cli/bot/messages.test.ts); wa refuses --md and --html as " +
      "it refuses --silent, and uploads any file the way --file does, both tested in src/commands/bot.test.ts",
  })),
  ...["--events", "--types"].map((option) => ({
    command: "bot watch",
    option,
    reason:
      "cli-core's shared option, tested in cli-core (src/cli/bot/watch.test.ts); wa's webhook mode in src/commands/bot-watch.test.ts",
  })),
  {
    command: "bot webhooks set",
    option: "--types",
    reason:
      "WhatsApp sends every field the app subscribed to in the App Dashboard, so wa refuses it before it changes anything",
  },
  {
    command: "bot webhooks set",
    option: "--secret-stdin",
    reason:
      "cli-core's hidden prompt, tested in cli-core (src/cli/bot/watch.test.ts); the kept verify token path in src/commands/bot.test.ts",
  },
  ...["--phone-number-id", "--waba-id", "--whats-app-business-account-id", "--body", "--body-file"].map((option) => ({
    command: "bot api *",
    option,
    reason:
      "generated: one execute path fills every id flag and reads every body the same way, tested in " +
      "src/commands/bot.test.ts and bot-api.test.ts (an id flag over the setting, --body, --body-file)",
  })),
  {
    command: "bot mcp serve",
    reason:
      "serves MCP on stdin until the client closes; cli-core's src/mcp/bot/server.test.ts drives the server, " +
      "src/commands/bot.test.ts the config entry and the commands the tools run",
  },
  {
    command: "bot api *",
    reason:
      "generated from Meta's OpenAPI file: one execute path for every operation, driven against a Graph stand-in in " +
      "src/commands/bot.test.ts; the manifest's effects and ids in src/bot/manifest.test.ts",
  },
  // wa's own tests replace these one command at a time, as each is found to reach the engine.
  ...Object.entries(SHARED).map(([command, tests]) => ({
    command,
    reason: `shared cli-core command mounted unchanged, over the store; tested in cli-core (${tests})`,
  })),
  {
    command: "server *",
    reason:
      "cli-core's shared command over the OS's service manager and serve's process, tested in cli-core " +
      "(src/cli/messenger/server.test.ts); src/messenger.test.ts drives install and status, where wa's own part, " +
      "no restart after a revoked login, shows",
  },
  // The messages, chats, contacts, account and doctor groups are listed command by command, so a new subcommand shows
  // up as missing instead of being waived unseen.
  ...[
    ["account update", "--last-name"],
    ["account update", "--description"],
    ["account update", "--photo"],
    ["account update", "--hide-phone"],
    ["chats folders create", "--chat"],
    ["chats folders update", "--add"],
    ["chats folders update", "--remove"],
    ["chats moderate", "--since-time"],
    ["chats moderate", "--dry-run"],
    ["chats moderate", "--allow-dangerous"],
    ["chats moderate", "--max-actions"],
    ["messages comments", "--limit"],
    ["messages comments", "--cursor"],
  ].map(([command, option]) => ({
    command: command as string,
    option,
    reason:
      "WhatsApp has no counterpart, so the adapter leaves it out and the command is refused whatever the option; " +
      "src/program.test.ts («commands WhatsApp has no counterpart for») drives the refusal, cli-core " +
      "src/cli/messenger/command-capabilities.test.ts the rule",
  })),
  ...cliCore("src/services/account-list.test.ts", [["account list"]]),
  ...cliCore("src/cli/messenger/chats-documents.test.ts", [
    ["chats documents list"],
    ["chats documents list", "--limit"],
    ["chats documents list", "--page"],
  ]),
  ...cliCore("src/cli/messenger/messenger.test.ts", [
    ["chats tracking list"],
    ["chats tracking show"],
    ["chats tracking add"],
    ["chats tracking remove"],
  ]),
  ...cliCore("src/cli/messenger/people-answers.test.ts", [
    ["contacts list"],
    ["contacts list", "--limit"],
    ["contacts list", "--page"],
    ["contacts list", "--all"],
    ["contacts list", "--order"],
    ["contacts show"],
    ["contacts show", "--with-notes"],
  ]),
  ...cliCore("src/cli/messenger/messenger.test.ts and src/services/person-context.test.ts", [
    ["contacts context"],
    ["contacts context", "--limit"],
    ["contacts context", "--since-time"],
    ["contacts context", "--chat"],
    ["contacts link"],
    ["contacts unlink"],
  ]),
  ...cliCore("src/cli/messenger/messenger.test.ts", [
    ["contacts prepare"],
    ["contacts prepare", "--limit"],
    ["contacts prepare", "--since-time"],
  ]),
  ...cliCore("src/services/person-timeline.test.ts", [
    ["contacts events"],
    ["contacts events", "--limit"],
    ["contacts events", "--cursor"],
  ]),
  ...cliCore("src/services/private-people.test.ts and person-aliases.test.ts", [
    ["contacts aliases set"],
    ["contacts aliases remove"],
    ["contacts notes list"],
    ["contacts notes show"],
    ["contacts notes add"],
    ["contacts notes add", "--text-file"],
    ["contacts notes edit"],
    ["contacts notes edit", "--text-file"],
    ["contacts notes edit", "--revision"],
    ["contacts notes remove"],
  ]),
  ...cliCore("src/cli/messenger/store-mode.test.ts and src/services/evidence.test.ts", [
    ["messages evidence"],
    ["messages evidence", "--limit"],
    ["messages evidence", "--cursor"],
  ]),
  ...cliCore("src/cli/messenger/messenger.test.ts and src/services/thread-context.test.ts", [
    ["messages show"],
    ["messages context"],
    ["messages context", "--thread"],
    ["messages context", "--thread-hops"],
    ["messages context", "--thread-messages"],
    ["messages context", "--thread-bytes"],
    ["messages context", "--thread-within"],
    ["messages context", "--before-n"],
    ["messages context", "--after-n"],
    ["messages links"],
  ]),
  ...cliCore("src/services/messages-link.test.ts", [["messages link"]]),
  ...["--source", "--exact", "--timezone", "--selection", "--sync-time"].map((option) => ({
    command: "stats messages counters sync",
    option,
    reason:
      "which stored messages to refresh, and the time for it; cli-core's shared command, tested in cli-core " +
      "(src/services/counters.test.ts and src/cli/messenger/stats-command.test.ts); src/message-actions.test.ts " +
      "drives the refresh, which on WhatsApp has no counter to read and never starts the engine",
  })),
  ...["--limit", "--dry-run"].map((option) => ({
    command: "tags rebuild",
    option,
    reason:
      "how many stored chats to tag, and a preview from the store; cli-core's shared command, tested in cli-core " +
      "(src/cli/messenger/tags.test.ts); src/groups.test.ts drives --sync-first, the option that reaches the engine",
  })),
  {
    command: "config show",
    option: "--bot",
    reason:
      "a shared cli-core option, over the config file only; cli-core's src/cli/config-command.test.ts drives " +
      "`config show` (not yet --bot); src/update.test.ts runs it only to see the update notice after a command",
  },
  ...["--limit", "--cursor"].map((option) => ({
    command: "messages list",
    option,
    reason:
      "a store read of cli-core's shared command, tested in cli-core (src/cli/messenger/messenger.test.ts); " +
      "src/media.test.ts --transcribe, the options that reach " +
      "the engine",
  })),
  ...["--catch-up", "--catch-up-chunks", "--catch-up-messages", "--catch-up-time"].map((option) => ({
    command: "messages sync",
    option,
    reason:
      "local search preparation after the sync, over the store; tested in cli-core " +
      "(src/services/search-catchup.test.ts); src/older-history.test.ts drives the sync itself",
  })),
  ...["--catch-up", "--catch-up-chunks", "--catch-up-messages", "--catch-up-time"].map((option) => ({
    command: "store gaps repair",
    option,
    reason:
      "local search preparation after the repair, over the store; tested in cli-core " +
      "(src/services/search-catchup.test.ts); src/older-history.test.ts drives the repair itself",
  })),
  ...["--new", "--limit"].map((option) => ({
    command: "inbox",
    option,
    reason:
      "a store read of cli-core's shared command, tested in cli-core (src/cli/messenger/inbox.test.ts; the paging in " +
      "src/cli/list-query.test.ts); src/media.test.ts " +
      "--transcribe, the options that reach the engine",
  })),
  ...["--new"].map((option) => ({
    command: "review",
    option,
    reason:
      "a store read of cli-core's shared command, tested in cli-core (src/cli/messenger/review.test.ts); " +
      "src/groups.test.ts --unanswered and src/media.test.ts " +
      "--transcribe, the options that reach the engine",
  })),

  ...["--from-dir", "--cursor", "--limit", "--ocr", "--concurrency"].map((option) => ({
    command: "attachments extract",
    option,
    reason:
      "reads files already on disk, in cli-core, tested there (src/cli/messenger/attachments.test.ts); " +
      "src/media.test.ts drives --download, the option that reaches the engine",
  })),
  ...["--permission", "--http", "--public-url"].map((option) => ({
    command: "mcp serve",
    option,
    reason:
      "cli-core's shared MCP server options, tested in cli-core (src/cli/messenger/mcp-command-http.test.ts, with " +
      "the HTTP server stubbed). Over HTTP the server is built by the same createServer as over stdio, so wa's tool " +
      "list and its delete refusal are the ones src/message-actions.test.ts drives on stdio; the HTTP server waits " +
      "for the process's SIGINT and has no signal a test can hand in",
  })),
  {
    command: "mcp serve",
    option: "--port",
    reason:
      "cli-core's shared option, the local port for --http; its range check in src/cli/messenger/mcp-command.ts has " +
      "no cli-core test yet, and wa adds nothing to it",
  },
  {
    command: "mcp revoke",
    reason:
      "cli-core's shared command over the token file only; cli-core's src/cli/messenger/messenger.test.ts runs it " +
      "and src/mcp/http/oauth.test.ts drives the revokeAll it calls; wa adds nothing to it",
  },
  ...["--defaults", "--personal", "--bot"].map((option) => ({
    command: "config set",
    option,
    reason:
      "cli-core's shared config command, over the config file only, tested in cli-core " +
      "(src/cli/config-command.test.ts drives --defaults; --personal and --bot not yet); src/groups.test.ts uses " +
      "`config set` only to deny a permission",
  })),
  ...(
    [
      ["--verbose", "src/cli/messenger/messenger.test.ts (-v)"],
      ["--trace", "src/cli/messenger/messenger.test.ts"],
      ["--debug", "src/errors/reasons.test.ts"],
      ["--max-input-bytes", "src/cli/input-policy.test.ts (the limit it sets)"],
      ["--max-output-bytes", "src/cli/agent-contract.test.ts"],
      ["--brief", "src/output-detail.test.ts"],
      ["--full", "src/output-detail.test.ts"],
      ["--yes", "src/cli/messenger/admin-commands.test.ts"],
      ["--record", "src/cli/messenger/messenger.test.ts"],
      ["--no-record", "src/cli/json-fields.test.ts"],
      ["--help-all", "src/cli/help/first-screen.test.ts"],
    ] as const
  ).map(([option, tests]) => ({
    command: "",
    option,
    reason: `a global option of cli-core's shared program, which wa adds nothing to; in cli-core: ${tests}`,
  })),
]
