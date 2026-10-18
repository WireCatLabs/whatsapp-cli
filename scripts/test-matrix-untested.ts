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
  "server *",
  "store *",
  "conversations *",
  "attachments *",
  "tags *",
  "mentions *",
  "images *",
  "models *",
  "stats *",
  "tasks *",
  "search *",
  "searches *",
  "recipients *",
  "sends *",
  "runs *",
  "config *",
  "commands",
  "commands *",
  "complete",
  "mcp *",
  "skill *",
]

/** Answered from the local store by cli-core's shared command; wa adds nothing to it. */
const cliCore = (tests: string, rows: string[][]): Untested[] =>
  rows.map(([command, option]) => ({
    command: command as string,
    ...(option ? { option } : {}),
    reason: `cli-core's shared command over the local store, tested in cli-core ${tests}`,
  }))

export const UNTESTED: Untested[] = [
  // A shared cli-core command mounted unchanged: cli-core's suite drives every option over its fake adapter. wa's own
  // tests replace these entries one group at a time, as each gets an engine path (docs/dev/BACKLOG.md).
  ...SHARED.map((command) => ({
    command,
    reason:
      "shared cli-core command mounted unchanged; tested in cli-core (src/cli/messenger/*.test.ts) over its fake adapter",
  })),
  // The messages, chats, contacts, account and doctor groups are listed command by command, so a new subcommand shows
  // up as missing instead of being waived unseen.
  ...[
    ["account update", "--last-name"],
    ["account update", "--description"],
    ["account update", "--photo"],
    ["chats folders create", "--chat"],
    ["chats folders update", "--add"],
    ["chats folders update", "--remove"],
    ["chats moderate", "--since-time"],
    ["chats moderate", "--dry-run"],
    ["chats moderate", "--allow-dangerous"],
    ["chats moderate", "--max-actions"],
    ["messages pin", "--notify"],
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
  ...cliCore("src/cli/messenger/chats-answers.test.ts and messenger.test.ts", [["chats show"]]),
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
  ...cliCore("src/cli/messenger/admin-commands.test.ts", [
    ["chats rules show"],
    ["chats rules set"],
    ["chats rules unset"],
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
  ...cliCore("src/services/person-timeline.test.ts", [
    ["contacts timeline"],
    ["contacts timeline", "--scope"],
    ["contacts timeline", "--since-time"],
    ["contacts timeline", "--until-time"],
    ["contacts timeline", "--limit"],
    ["contacts timeline", "--cursor"],
  ]),
  ...cliCore("src/services/private-people.test.ts and person-aliases.test.ts", [
    ["contacts alias set"],
    ["contacts alias rm"],
    ["contacts notes list"],
    ["contacts notes show"],
    ["contacts notes add"],
    ["contacts notes add", "--file"],
    ["contacts notes edit"],
    ["contacts notes edit", "--file"],
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
  ...cliCore("src/cli/messenger/doctor-command.test.ts", [
    ["doctor report"],
    ["doctor report create"],
    ["doctor report create", "--run"],
    ["doctor report create", "--output"],
  ]),
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
  ...["--local", "--model"].map((option) => ({
    command: "messages transcribe",
    option,
    reason:
      "needs a speech model downloaded, hundreds of MB; src/media.test.ts checks that a transcript asks for one, " +
      "and cli-core's src/speech tests drive the local model",
  })),
  ...["--catch-up", "--catch-up-chunks", "--catch-up-messages", "--catch-up-time"].map((option) => ({
    command: "messages sync",
    option,
    reason:
      "local search preparation after the sync, over the store; tested in cli-core " +
      "(src/services/search-catchup.test.ts); src/older-history.test.ts drives the sync itself",
  })),
  {
    command: "messages sync",
    option: "--background",
    reason:
      "cli-core runs the sync as a store job, tested in cli-core (src/cli/messenger/backfill.test.ts); the job's " +
      "sync reaches wa as src/older-history.test.ts drives it",
  },
  {
    command: "messages forward",
    option: "--operation-id",
    reason: "a repeat with the same send id is cli-core's send guard, tested in cli-core (src/sends/guard.test.ts)",
  },
  ...["--new", "--limit", "--kind", "--transcribe", "--model"].map((option) => ({
    command: "inbox",
    option,
    reason:
      "a store read of cli-core's shared command, tested in cli-core (src/cli/messenger/inbox.test.ts; the paging in " +
      "src/cli/list-query.test.ts, transcripts in src/mcp/mcp.test.ts); src/message-actions.test.ts drives " +
      "--mark-read, the option that reaches the engine",
  })),
  ...["--kind", "--transcribe", "--model", "--new"].map((option) => ({
    command: "review",
    option,
    reason:
      "a store read of cli-core's shared command, tested in cli-core (src/cli/messenger/review.test.ts); " +
      "src/message-actions.test.ts drives --mark-read and src/groups.test.ts --unanswered, the options that reach " +
      "the engine",
  })),

  ...["--from-dir", "--cursor", "--limit", "--ocr", "--concurrency"].map((option) => ({
    command: "attachments extract",
    option,
    reason:
      "reads files already on disk, in cli-core, tested there (src/cli/messenger/attachments.test.ts); " +
      "src/media.test.ts drives --download, the option that reaches the engine",
  })),
  ...["--permission", "--http", "--port", "--public-url", "--revoke"].map((option) => ({
    command: "mcp",
    option,
    reason:
      "cli-core's shared MCP server options, tested in cli-core (src/cli/messenger/mcp-command*.test.ts); " +
      "src/message-actions.test.ts drives `mcp` on a relayed stdin and stdout only to see wa's delete refused",
  })),
  ...["--defaults", "--personal", "--bot"].map((option) => ({
    command: "config set",
    option,
    reason:
      "cli-core's shared config command, tested in cli-core; src/groups.test.ts uses `config set` only to deny a " +
      "permission",
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
