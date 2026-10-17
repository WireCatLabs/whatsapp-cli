# Changelog

Notable changes to `@wirecat/whatsapp-cli`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the command interface may still change.

## Unreleased

### Security

- The Go engine builds with Go 1.26.9 and `golang.org/x/net` 0.60.0, clearing the affected
  runtime and networking advisory paths while retaining the current Go release branch.

### Fixed

- Release and monthly source checks include the Go engine using its module toolchain. Local
  tests resolve the shared TypeScript config directly so they run in isolated worktrees.

### What's new

- **Commands while `serve` runs**: a send, an edit, a reaction, `watch`, `wa <profile> mcp` and every other command
  that connects run inside a running `serve`, on its one connection, instead of being refused. Permissions and the
  send guard still apply; a write at `ask` needs `--yes`. Not on Windows yet.
- **The foundation**: the shared cli-core commands over a WhatsApp adapter that reads from the local store, an
  engine contract, and the same linters, checks and CI as tg-cli and max-cli.
- **The WhatsApp engine**: `wa` connects through a Go program built on whatsmeow, started for each command that
  connects and stopped when it ends. One command at a time may connect a profile; a second is told which one holds it.
- **Installs with its engine**: `npm install --global @wirecat/whatsapp-cli` also installs the engine for your system,
  a small package of its own, for Linux, macOS and Windows on x64 and arm64. `WA_ENGINE` still runs another one. A
  global install also installs the agent skill and, on Windows, puts `wa` on the user's PATH, as tg does.
- **`wa <profile> session start [qr|phone]`** links the profile by QR code or pairing code and keeps the history the
  phone sends right after linking. **`session end`** unlinks the device and deletes its keys.
- **Changing messages**: `messages edit` (your own, within WhatsApp's 20 minutes), `messages delete --for-everyone`
  (your own, or another's in a group you administer), `reactions add` and `reactions remove`, and `chats mark-read`
  and `--mark-read`, which send a read receipt only when asked. Each needs the message in the local store, which
  `serve` keeps filled; WhatsApp addresses a message by its sender. Deleting for you alone is not built yet.
- **Files**: photos, videos, voice notes, audio, documents and stickers arrive as attachments, with places and contact
  cards named; `messages send --file`, `--photo` and `--voice` send one file with its caption; `messages download`
  saves a stored message's file; `messages transcribe --local` reads a voice note with a model on this machine
  (`wa models`); `messages forward` sends a stored message again, marked forwarded, file included; `wa images` searches
  pictures by what they show. The engine protocol is now 3.
- **Groups and people**: `chats create`, `join`, `leave`, `update` (name, description, admin-only adds, join
  approval), `chats link show|reset`, `chats members add|remove`, `chats admins add|remove`, `chats requests
  list|accept|decline`, `contacts profile`, `contacts block|unblock`, `contacts lookup` and `contacts sync` (the
  phone's address book), and `doctor --online` now connects to check the account. Group changes go through the send
  guard like a send; adding people is refused for anyone not in the address book or written to before, since
  WhatsApp bans accounts that add strangers. A number lookup is one per call, one every 10 seconds per profile.
  Engine protocol 4.
- **`wa <profile> setup`** is the guided first run, as in tg: it checks this computer, links the device or reuses it,
  reads the account and five chats from the local store, and installs the agent skill (`--agent`). Agents use
  `--qr-file`.
- **`wa upgrade`** installs the newest version with the package manager that installed `wa` and restarts running
  servers; a daily line on stderr says when a newer version exists.
- **`wa doctor`** reports whether the engine program is found, whether the device keys exist with private file
  modes, and who last held the device's lock and whether that process still runs.
- **Documentation like tg's**: pages on linking and profiles, the local store, search and its query language,
  groups, people, MCP and the browser, permissions, limits, the CLI contract, diagnostics and recipes, each limited
  to what WhatsApp can do today. The agent skill (`wa skill show`) is rebuilt on tg's: setup without a terminal,
  the traps, the exit codes, and what one connection per device means for an agent.
