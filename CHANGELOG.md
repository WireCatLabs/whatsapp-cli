# Changelog

Notable changes to `@wirecat/whatsapp-cli`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the command interface may still change.

## Unreleased

### Changed — may break callers

- **A device linked before answers without counts** (WC-OUT-13). `session start --json` leaves out `received`, and
  `setup --json` leaves out `history`, when the profile was already linked: nothing was pushed, so nothing was
  counted. They used to say 0, which read as "the phone pushed nothing".
- **Refusals that need a terminal say so in `reason`** (WC-OUT-15). `session start` and `setup` without a terminal,
  and `session start phone` without one, answer `reason: "input.required"`; `--qr-file` with the phone method names
  `param: "--qr-file"`.
- **No automatic replies** (cli-core 0.324.0). `wa` no longer has `replies`, and `serve` never answers by reply
  rules, even with `permissions.replies.send` at `allow`: WhatsApp bans accounts that answer like a bot, and `wa`
  sends nothing the owner did not ask for. A rules file left in the config folder is ignored.
- **Options WhatsApp has no counterpart for are no longer offered** (cli-core 0.324.0): `--silent` and `--send-as` on
  `messages send`, `messages forward` and `polls create`, `--at-time` on `messages send`, `--anonymous` on
  `polls create`, and the commands `chats send-as` and `messages scheduled`. They were refused before; now they are
  unknown, still with exit 2, and the MCP tools no longer take `silent`, `send_as`, `at_time` or `anonymous`.
- **Commands WhatsApp lacks refuse before connecting** (cli-core 0.324.0): `account update`, `account sessions list`
  and `end`, `chats events`, `chats inspect`, `chats folders *`, `contacts add`, `remove`, `rename` and `import`,
  `messages pin` and `unpin` refuse with exit 2 before connecting to WhatsApp.
- **`watch --events` no longer prints the votes of the phone's history push** (cli-core 0.322.0). They were
  printed as new votes; they are old ones, and the store now saves them with the push, together with their poll and
  dated when each person voted, so an older one never replaces a newer live vote. A script that read history votes
  from `watch` reads `polls voters` instead. Engine protocol 9.
- **An agent never deletes for everyone** (cli-core 0.321.0). Every WhatsApp delete `wa` makes is for everyone, so
  `messages delete` through MCP is refused with `permission_error`, before `wa` connects, whatever the profile's
  level; the owner still has `wa <profile> messages delete --for-everyone`.
- **`mcp --permission <key=level>` only narrows** (cli-core 0.321.0). An override that would give the server more
  than the profile — `readonly` to `allow`, a `deny` to anything — stops it at startup with `validation_error` naming
  the key. To let an agent do more, set the level in the profile. The browser setup no longer starts the server with
  `--permission messages.send=allow`.
- **Tasks open only where something is asked of you** (cli-core 0.318.0). In a one-to-one chat every question you did
  not answer opens one, as before; in a group only a question in reply to your message and a mention of you; in a
  channel or the chat with yourself nothing.
- **`tasks apply` is now `tasks scan`** (cli-core 0.320.0); MCP `tasks_scan`, permission key `tasks.scan`.
- **No setting picks a profile any more** (cli-core 0.319.0). A command names its profile with the first word or
  `WA_PROFILE`. A config file that still has `default_profile` stops a command that names no profile, with the profile
  to type and `wa config unset default_profile`; `wa config set default_profile` is refused. A profile called `default`
  is an ordinary name: `wa default mcp config` names its server `wa-default`, not `wa`.

### Security

- **Media keys stay inside the client**: internal attachment references stay out of live-event, JSON and MCP output
  (cli-core 0.315.0).
- **Invite links must name WhatsApp's exact invite host**; unrelated URL prefixes are refused before connecting.
- **WhatsApp state is safe from the other messengers' uploads** (cli-core 0.314.0), and a running server's read-only
  lock holds when a command is relayed to it.
- **The Go engine builds with Go 1.26.9 and `golang.org/x/net` 0.60.0**, clearing the affected runtime and
  networking advisory paths while retaining the current Go release branch.

### Fixed

- **Refusals name the whole command to run next**: `wa <profile> chats list`, `wa <profile> serve` and
  `wa <profile> session start`, where they said only `chats list`, `serve` or `session start`.
- **No `messages sync` advice `wa` cannot follow** (cli-core 0.322.0): where a command points at the store's gaps it
  names `messages sync <chat>` for one chat, never `--all`.
- **`wa upgrade`'s "held back" hint names the package and keeps pnpm's release-age exemption** (cli-core 0.320.0).
- **An agent's `chats members list` and `chats send-as` follow their own permission keys**, `chats.members.list` and
  `chats.send-as`, so a deny on those keys reaches the MCP agent too (cli-core 0.321.0).
- **A reply names the quoted message's sender and carries its text** when the local store holds that message, so
  phones show the quote instead of "unavailable"; a reply to one the store lacks still goes, with the message's id
  alone.
- **An edit keeps the message's own time**: one that `serve` or `watch` hears keeps the message's time, reply and
  reactions in the local store; before, it took the edit's time as the message's.
- **Tests on Windows check file access rules** instead of Unix mode bits. Group administration tests verify
  stranger refusals and unsupported changes before writes.
- **The search and query language pages said the file fields find nothing**; `has:file`, `filename:`, `mime:` and
  `content:` work on every message stored since `wa` handled files. The README and the docs start page no longer list
  files and group administration as coming next.
- **Release and monthly source checks include the Go engine**, using its module toolchain. Local tests resolve the
  shared TypeScript config directly so they run in isolated worktrees.

### Added

- **`session`, `session start`, `session end` and `setup` carry `mcp: false`** in `commands --json` (WC-CMD-21):
  linking waits for a person and unlinking removes the owner's device, so neither will be offered to an agent once
  MCP tools are built from commands. `setup` and `upgrade` list examples there too (WC-CMD-24).
- **Each engine package carries `THIRD_PARTY_NOTICES`**: the licence of every Go module the engine links and of Go
  itself, with where each module's source is. whatsmeow and `go.mau.fi/util` are under the Mozilla Public License
  2.0 and `go.mau.fi/libsignal` under the GNU General Public License 3.0, all unmodified.
- **Tasks have assignees** (cli-core 0.320.0): `tasks add` and `tasks plan` take `--assignee sender` (whoever sent
  the message) or `--assignee person:<id>`; `none` clears it. `tasks list "assignee:any state:open"` is what others
  owe you.
- **`wa <profile> tags add --chat <group> watch-tasks`** records every question in that group as a task, whoever it
  is for.
- **Poll votes are counted**: `serve` and `watch` keep each person's newest vote, from the phone's history push and
  as votes arrive (`watch --events` prints them), so `polls show` counts the answers and says which you chose, and
  the new `polls voters` lists who voted for what. A poll made with `polls create` is kept in the local store, so it
  can be shown and voted on. `polls close` and `polls create --revote` are gone: a WhatsApp poll never closes and
  every vote can change. Engine protocol 8; cli-core 0.317.0.
- **Commands while `serve` runs**: a send, an edit, a reaction, `watch`, `wa <profile> mcp` and every other command
  that connects run inside a running `serve`, on its one connection, instead of being refused. Permissions and the
  send guard still apply; a write at `ask` needs `--yes`. Not on Windows yet.
- **The foundation**: the shared cli-core commands over a WhatsApp adapter that reads from the local store, an
  engine contract, and the same linters, checks and CI as tg-cli and max-cli.
- **Older history from the phone**: `wa <profile> messages sync <chat>` asks the phone for the 50 messages of a chat
  before the oldest one the local store holds, page after page, and waits up to 30 seconds for each answer (engine
  protocol 5; cli-core 0.316.0). `--all` is refused: WhatsApp has no chat list to walk.
- **More group settings**: `chats update --only-admins-send`, `--only-admins-edit-info` and `--disappear-time`
  (24h, 7d or 90d, the times WhatsApp offers; `off` keeps messages). A group's answer shows them in `settings`
  instead of `provider_metadata`. Engine protocol 7.
- **`chats admins add` takes no `--can`**: a WhatsApp admin has every right, so it gives them all.
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
- **Formatting and polls**: `messages send --md` and `messages edit --md` write Markdown as WhatsApp's own marks
  (bold, italic, strike, code, quotes; a link becomes its label and address; underline and spoilers become plain
  text). `polls create` (one answer or `--multiple`), `polls show` and `polls vote` (`--retract` too) work on polls
  in the local store; votes are not counted yet, and `--anonymous` and `polls close` are refused, since WhatsApp has
  neither. Engine protocol 6.
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
- **A page on file attachments** ([docs/attachments.md](docs/attachments.md)): sending one file per message, what the
  local store keeps, downloading, forwarding, voice notes as text with a model on this machine, and reading the text
  of files for `content:` search. The README gains tg's sections on linking and profiles, groups you run, limits
  and the list of pages.
