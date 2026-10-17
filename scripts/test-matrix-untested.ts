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
  "images *",
  "models *",
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
  ...["--all", "--pause", "--extract"].map((option) => ({
    command: "messages download",
    option,
    reason:
      "cli-core's shared command walks the chat and extracts text itself, tested in cli-core " +
      "(src/services/file-download.test.ts); src/media.test.ts drives the one-message download that reaches the engine",
  })),
  ...["--local", "--model"].map((option) => ({
    command: "messages transcribe",
    option,
    reason:
      "needs a speech model downloaded, hundreds of MB; src/media.test.ts checks that a transcript asks for one, " +
      "and cli-core's src/speech tests drive the local model",
  })),
  ...["--silent", "--send-as"].map((option) => ({
    command: "messages forward",
    option,
    reason: "refused by the adapter before the engine, as `messages send` refuses them (src/program.test.ts)",
  })),
  {
    command: "messages forward",
    option: "--operation-id",
    reason: "a repeat with the same send id is cli-core's send guard, tested in cli-core (src/sends/guard.test.ts)",
  },
  {
    command: "messages send",
    option: "--allow-any-file",
    reason: "cli-core's file check, tested in cli-core (src/sends/upload.test.ts); wa receives the file it allowed",
  },
  {
    command: "contacts profile",
    option: "--show-phone",
    reason:
      "wa's profile never carries a phone number (the engine leaves it out), so there is nothing to unmask; " +
      "cli-core tests the masking",
  },
  ...["--kind", "--all", "--transcribe", "--model", "--new", "--mark-read", "--no-mark-read"].map((option) => ({
    command: "review",
    option,
    reason:
      "a store read of cli-core's shared command, tested in cli-core; src/groups.test.ts drives only --unanswered, " +
      "the one option that could reach the engine (for group admins)",
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
