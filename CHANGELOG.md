# Changelog

Notable changes to `@wirecat/whatsapp-cli`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the command interface may still change.

## Unreleased

### Changed — may break callers

- **A temporary ban WhatsApp dates holds writes until its end** (WC-PERM-18): the engine passes the ban's expiry
  (engine protocol 11), the error says when it ends, and `standing.until` is that time.
- **`session start`, `session end` and `setup` are refused under `WA_READ_ONLY` before they act** (cli-core 0.328.0,
  `logsInOrOut`), with "this process is read-only (WA_READ_ONLY) — it cannot log in or out" and exit 5. `session
  start` and `setup` on a profile linked before used to go ahead.
- **Ctrl+C or `--timeout` during the history wait after linking ends the wait, not the command**: `session start`
  keeps what arrived, counts it and exits 0. It exited 130 or 9, though the device was linked. `setup` goes on to
  its account, chat and agent steps, which get a deadline of their own (cli-core 0.334.0, WC-LIFE-5, WC-LIFE-8); a
  Ctrl+C after the wait ends setup (130). With `--timeout`, the link and the wait share that one deadline, and the
  steps after it get that long again.
- **cli-core 0.328.0's command changes**: `chats list` and `chats show` declare a local read and never connect, so
  they run here while `serve` runs; `recipients add` runs through `serve` instead of being refused with exit 12; a
  link without a terminal (`--qr-file`) waits 5 minutes by default, not 30 seconds; a command path given as one
  quoted argument (`wa 'chats list'`) fails with `validation_error`. `wa mcp` no longer offers `chats link create`,
  `metadata get` or `metadata refresh`, which `wa` does not have and which failed.
- **A hold on writes stops every write** (cli-core 0.334.0, WC-PERM-18): while WhatsApp has the account banned or
  rate-limited, a reaction, `chats mark-read` and a group title change are refused with exit `5`
  too, not only sends and edits. Reads still work; `inbox` and `review` with `--mark-read` still show what they read
  and warn that nothing was marked read.
- **A ban with no end holds writes until it is lifted** (WC-PERM-18): `standing.state` is `banned`, not `frozen`,
  and the hold has `until: null` in `doctor --json`, `flood clear --json` and `server status --json`, where it held
  for a year before. `wa <profile> flood clear` or a `doctor --online` that connects lifts it. A ban WhatsApp dates
  still ends then.
- **An older client's `session end` relayed into `serve` is refused by cli-core** (WC-LIFE-11) with
  `permission_error`, exit `5`, `sent: false`, naming `server stop`; it was `provider_unavailable`, exit `12`,
  `device.in-use`. `serve`'s connection and the keys stay as they were.
- **`conversations embed` counts as a write to an outside service** (cli-core 0.334.0, WC-CMD-17): a failed run is
  not marked safe to retry, and under `WA_READ_ONLY` it refuses before sending chat text to a remote provider.
- **`chats events` answers from the local store** (cli-core 0.336.0): it no longer refuses with exit `2`, never
  connects, and works with `--offline`. `wa` does not record joins and leaves yet, so the list is empty.
- **`conversations build` counts as a write to an outside service and `search conversations` as a read from one**
  (cli-core 0.336.0, WC-CMD-17): under `WA_READ_ONLY` each refuses before it sends chat text or the query to a remote
  provider; a local model still works. Both always run in the calling process, never through `serve`.
- **`WA_READ_ONLY` also keeps what the owner saved** (cli-core 0.336.0, WC-PERM-12): `searches create`, `searches
  delete`, `searches clear`, `contacts alias set`, `contacts alias rm`, `contacts notes edit`, `contacts notes remove`
  and `tags remove`, and their MCP tools, refuse with exit `5`. An agent that saved searches must do it in a process
  without the lock.

### Fixed

- **A command cut off when WhatsApp ended the connection says why**: a command relayed through `serve` while another
  process took the login over answered `network_error`, which invites a retry; it now answers `device.replaced`, and
  after a ban or a logout `account.banned` or `device.logged-out`.
- **The phone-number and agent prompts of `session start` and `setup` go to the run's own stderr** (cli-core's
  `secretInputOf`), so a test or an embedding program that captures the run sees them.
- **`WA_READ_ONLY` guards the message store** (cli-core 0.334.0, WC-PERM-12): `store reset`, `restore`, `clear`,
  `migrate`, `repair`, `decrypt` and `copies delete` refuse with exit `5`; `--dry-run` still previews.
- **A rate limit or a ban that ends `watch` or `serve`'s feed holds the next command's writes** as a one-shot
  command meeting it would.

## 0.1.0 — 17.10.2026

### Changed — may break callers

- **The engine dying during a write answers `outcome_unknown`** (WC-LIFE-9): exit 14, `retry.safe: false`, the
  `operation_id` kept, reason `engine.stopped-mid-write`. It answered `provider_unavailable` (exit 12), which
  invited a retry and a double send. A read cut the same way still answers `provider_unavailable`.
- **Device and account states carry a `reason`** (WC-OUT-15), so an agent branches on it instead of the message:
  `device.in-use` (another `wa` process holds the login: stop it, or run the command through `serve`),
  `engine.stopped`, `client.outdated` (update `wa`) and `device.replaced`, all `provider_unavailable`;
  `device.logged-out` (`authentication_error`); `account.banned` (`permission_error`); `account.rate-limited`
  (`rate_limited`). After WhatsApp ends the connection for one of these, later requests in the same process answer
  with it instead of connecting again. Engine protocol 10.
- **WhatsApp's rate limit and a ban hold the profile's sends** (WC-PERM-18). After WhatsApp asks the account to slow
  down, sends, edits and the other writes counted toward the send limit are refused for 15 minutes and reads go on;
  after a ban, until `wa <profile> doctor --online` connects again. Reactions and read receipts are not held.
  `doctor --online` reports a ban as `standing.state: "frozen"` (it said `banned`, which held nothing).
  `wa <profile> flood clear` lifts either hold. Both lengths are a default the owner may change.
- **`commands --json` marks more commands `mcp: false`** (cli-core 0.326.0, WC-MCP-2): `store`, `server`, `config`,
  `mcp`, `models`, `images models`, `skill`, `runs`, `doctor report`, `upgrade`, `complete`, `commands schema`,
  `account sessions end`, and the commands that change a later run's authority (`recipients`, `chats rules`). The
  MCP tool list `wa mcp` serves is unchanged.
- **In a group tagged `watch-tasks`, any member's direct reply closes a question** (cli-core 0.325.0), with the
  resolution "answered in the group". Before, only your answer closed it; a later message that does not reply to the
  question still closes nothing.
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
- **`polls close` and `polls create --revote` are gone** (cli-core 0.317.0): a WhatsApp poll never closes and every
  vote can change. A script that closed a poll or asked for revoting drops that call.
- **`chats admins add` takes no `--can`**: a WhatsApp admin has every right, so it gives them all. A script that
  passed `--can` drops it.

### Security

- **`WA_ENGINE_LOG` no longer writes phone numbers** (WC-SECR-1): every user id (phone, device and hidden-id forms)
  and any other long run of digits is masked before a line reaches the file.
- **A release from GitHub Actions publishes the engine packages validation built and tested** (WC-REL-12): it checks
  each against the SHA-256 that validation recorded, and builds nothing again. This first release was published from
  the maintainer's machine, which builds them itself.
- **`WA_READ_ONLY` also stops linking and unlinking the device**: `session start` and `setup` refuse to link a new
  device, and `session end` refuses to log out, with `permission_error`.
- **An interrupted or timed-out login closes the engine and removes its QR image**, instead of leaving both behind.
- **The account name shown after linking is printed as plain text**, never as terminal control codes.
- **Media keys stay inside the client**: internal attachment references stay out of live-event, JSON and MCP output
  (cli-core 0.315.0).
- **Invite links must name WhatsApp's exact invite host**; unrelated URL prefixes are refused before connecting.
- **WhatsApp state is safe from the other messengers' uploads** (cli-core 0.314.0), and a running server's read-only
  lock holds when a command is relayed to it.
- **The Go engine builds with Go 1.26.9 and `golang.org/x/net` 0.60.0**, clearing the affected runtime and
  networking advisory paths while retaining the current Go release branch.

### Fixed

- **`session end` no longer runs through a running `serve`**: it logged out `serve`'s own connection and then
  deleted the device keys under it. It now refuses with `provider_unavailable`, reason `device.in-use` (exit 12),
  and says to stop `serve` first (`wa <profile> server stop`, or Ctrl+C).
- **The command reference no longer says `defaultProfile` in the config file picks a profile** (WC-ACCT-1): no
  setting does; the first word or `WA_PROFILE` names it.
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

- **`wa <profile> flood clear`** (cli-core's, as in tg and max): forgets the waits WhatsApp asked for and lifts the
  hold on writes. The refusal during a hold already named it; `wa` did not have it.
- **`session`, `session start`, `session end` and `setup` carry `mcp: false`** in `commands --json` (WC-CMD-21):
  linking waits for a person and unlinking removes the owner's device, so neither will be offered to an agent once
  MCP tools are built from commands. `setup` and `upgrade` list examples there too (WC-CMD-24).
- **The engine packages are GPL-3.0-only**: `@wirecat/whatsapp-engine-*` and the `engine/` folder they are built
  from, because the engine links `go.mau.fi/libsignal` (GNU General Public License 3.0). Each package carries the
  GPL text as `LICENSE` and a README that points at the commit it was built from. `@wirecat/whatsapp-cli`
  stays Apache-2.0: it runs the engine as a separate program over stdin and stdout, and its package never carries
  the engine.
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
  can be shown and voted on. Engine protocol 8; cli-core 0.317.0.
- **Commands while `serve` runs**: a send, an edit, a reaction, `watch`, `wa <profile> mcp` and every other command
  that connects run inside a running `serve`, on its one connection, instead of being refused. Permissions and the
  send guard still apply; a write at `ask` needs `--yes`. On Windows they do not go through `serve`.
- **The foundation**: the shared cli-core commands over a WhatsApp adapter that reads from the local store, an
  engine contract, and the same linters, checks and CI as tg-cli and max-cli.
- **Older history from the phone**: `wa <profile> messages sync <chat>` asks the phone for the 50 messages of a chat
  before the oldest one the local store holds, page after page, and waits up to 30 seconds for each answer (engine
  protocol 5; cli-core 0.316.0). `--all` is refused: WhatsApp has no chat list to walk.
- **More group settings**: `chats update --only-admins-send`, `--only-admins-edit-info` and `--disappear-time`
  (24h, 7d or 90d, the times WhatsApp offers; `off` keeps messages). A group's answer shows them in `settings`
  instead of `provider_metadata`. Engine protocol 7.
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
  in the local store. Engine protocol 6.
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
