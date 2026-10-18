# wa — WhatsApp CLI for AI agents

Your personal WhatsApp in the terminal, searchable on your computer, and ready for Claude Code, Codex, Cursor or any
agent — within limits you set.

> **Early.** `wa` links, reads into its local store, sends text and files, edits, deletes, reacts and
> runs groups. What comes next is on the [roadmap](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/roadmap.md).

An example conversation (invented people, illustrative output):

```text
You:    Use wa CLI. Who is waiting for my answer since yesterday?
Agent:  (runs wa personal review 'date>1d' --unanswered: 3 chats)
        · Alice Example asked about Saturday's table, 18:40 yesterday
        · "Book club" — Bob Sample asked who brings the next book
You:    Tell Alice: yes, 8 pm.
Agent:  Draft to Alice Example: "Yes, 8 pm." Send it?
You:    Yes.
```

## Quick start

```sh
npm install -g @wirecat/whatsapp-cli
wa personal setup --agent claude       # also codex, cursor, gemini, all or none
wa personal server install             # keep receiving in the background
wa personal inbox                      # other people's unread messages; nothing is marked read
```

Allow about five minutes. `wa personal setup` links `wa` to your account as a device — you scan a QR code in
WhatsApp → Settings → Linked devices — keeps the history your phone sends right after linking, checks your first
chats and installs the agent skill.

It needs **Node 22.16+ or 24+** on macOS, Linux or Windows. npm also installs the engine, the small program that
speaks WhatsApp's protocol, as a separate package for your system.

More: [installation guide](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/installation.md) · [linking](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/sessions.md)

## What can you do?

**Catch up.** *"Use wa CLI. What came in since this morning, and who is waiting for my answer?"*

```sh
wa personal inbox
wa personal review 'date>1d' --unanswered
```

**Find anything.** *"Use wa CLI. When did we agree on the venue with Alice?"* — an answer with the date and the
message itself.

```sh
wa personal search all "venue"            # messages and notes kept on this computer
```

**Keep your promises.** *"Use wa CLI. What did I promise, and what am I still waiting on?"*

```sh
wa personal review --new                  # what changed since the last review --new
wa personal tasks list state:open
```

**Answer, when you say so.**

```sh
wa personal messages send "Book club" "Call at 3?" --reply-to 3EB0A1B2C3D4E5F6A7B8
wa personal messages edit "Book club" 3EB0A1B2C3D4E5F6A7B8 "Call at 4?"   # your own, within 20 minutes
wa personal reactions add "Book club" 3EB0A1B2C3D4E5F6A7B8 👍
wa personal messages delete "Book club" 3EB0A1B2C3D4E5F6A7B8 --for-everyone
wa personal chats mark-read "Book club"   # the other side sees it
```

More: [recipes, with a schedule for each](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/recipes.md) · [using wa](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/usage.md)

## Built for AI agents

- **Agents with a terminal** (Claude Code, Codex, Gemini CLI) run `wa` commands themselves. The bundled
  [skill](https://github.com/WireCatLabs/whatsapp-cli/blob/main/skills/whatsapp-cli/SKILL.md) tells them how: `wa personal setup --agent …` or `wa skill install` puts it in
  place, and `wa skill show` prints it before linking. An agent links with `--qr-file` and shows you the picture; it
  never asks for your phone number or a code.
- **Apps without a terminal** (Claude Desktop, Cursor and other MCP clients) connect to `wa personal mcp`.

```sh
wa personal mcp setup claude-code   # or: wa personal mcp setup codex
wa personal mcp config              # the entry for Claude Desktop, Cursor and others
```

More: [the MCP server](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/mcp.md) · [from the browser](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/remote.md)

## Why wa?

- **Your own account, as a linked device.** `wa` links the way WhatsApp Web does. It sees your chats, groups and
  contacts, and speaks as you, not as a business account or a bot.
- **Local-first search.** Everything received is kept on your computer. Every read and search answers from there and
  never connects.
- **Made for agents.** One operation per call, the same JSON shape every time with `--json`, a fixed exit code for
  each kind of failure, an MCP server and a skill.
- **Safe by default.** Reading marks nothing read and sends no "online" or "typing". A profile decides which actions
  an agent may take, which chats it may send to, and how many messages an hour (30 by default). When a send's outcome
  is unknown, `wa` says so and never repeats it by itself.

## Your account

`wa` works in your name, as one more linked device of your WhatsApp account.

```sh
wa personal chats list --limit 5
wa personal messages list "Book club" --limit 20
wa personal messages send "Book club" "The minutes" --file minutes.pdf
wa personal polls create "Book club" "Which day?" Monday Tuesday
wa personal messages download "Book club" 3EB0A1B2C3D4E5F6A7B8 --output-dir ~/Downloads
wa personal messages transcribe "Book club" 3EB0A1B2C3D4E5F6A7B8 --local  # a voice note as text
```

The message id `3EB0A1B2C3D4E5F6A7B8` is made up; take a real one from `messages list -v`.

- **Read.** Chats and messages from the local store, one message with its neighbours, other people's unread
  messages (`wa personal inbox`), everything since the last review (`wa personal review`), new messages as they
  arrive (`wa personal watch`), older messages of one chat asked of your phone (`wa personal messages sync`), and
  the posts of the channels you follow (`wa personal chats join` with a channel link).
- **Write.** Markdown, replies, one file, photo, video or voice note per message, a photo and a video as one album,
  edits of your own messages within 20 minutes, forwards, reactions, polls and votes, pins (each one tells the
  members), deleting for you or for everyone, and marking a chat read.
- **Your chat list.** Mute, archive, pin or mark a chat unread, star a message, and delete or clear a chat on your
  own devices; nobody in the chat is told.
- **Voice on your computer.** WhatsApp has no speech recognition of its own, so `wa` runs a speech model on this
  machine, downloaded only when you ask.
- **People.** A person's profile, blocking, whether a number has WhatsApp, the phone's address book into the store,
  and your own names and notes for people.
- **Your account.** Your own name, about line and profile photo (`wa personal account update`).
- **Privacy.** Who sees your last seen, online, profile photo and about line, whether you send read receipts, who
  may add you to groups and whose calls ring (`wa personal account privacy`).

More files in one message than a photo and a video are not built yet:
[not in wa yet](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/usage.md#not-in-wa-yet).

More: [using wa](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/usage.md) · [privacy](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/usage.md#privacy) · [one person](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/people.md)

## Log in and profiles

`wa` links to your account as a device, the way WhatsApp Web does. There is no password and no app to register: you
link once, from the phone, and the device keys go to one file only your user can read.

```sh
wa personal session start               # a QR code: WhatsApp → Settings → Linked devices → Link a device
wa personal session start phone         # or your number, then a pairing code you type on the phone
wa personal session start --qr-file login.png  # the QR code as a picture, for an agent to show you
wa personal account show                # who this profile is linked as
wa account list                         # every profile here, and who each is linked as
wa personal session end                 # unlink, and delete the device keys here
```

Several accounts are several profiles, and the profile is **the first word**, not an option:

```sh
wa personal chats list     # profile "personal"
wa work chats list         # profile "work"
export WA_PROFILE=work     # or for the whole shell session
```

`wa` never picks a profile for you, not even the only one: a command that uses an account and has no profile named
stops and lists the profiles on this computer. Name one or set `WA_PROFILE`. Each profile is a linked device of its
own, with its own one connection.

More: [linking, devices and profiles](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/sessions.md) · [profiles](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/profiles.md)

## The local store and search

Everything `wa` receives is kept in a local store on your computer, shared with tg and max. Search runs over it;
nothing leaves your computer.

```sh
wa personal search messages 'contract chat:"Project Alpha"'
wa personal store status                  # how much of each chat is kept
wa personal store export "Project Alpha" --format markdown --output alpha.md
wa personal messages evidence "Project Alpha" --json   # bounded evidence for a chat brief
wa personal store backup ~/wa-backup.db   # a copy, safe while the store is in use
```

More: [search](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/search.md) · [the local store](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/archive.md) · [query language](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/query-language.md)

## Groups you run

```sh
wa personal review chat:Hiking --unanswered          # questions nobody answered
wa personal review 'chat:Hiking date>7d'             # the week: decisions, promises, open questions
wa personal stats chats show Hiking --offline        # the group's activity, from the local store
wa personal chats create "Hiking 2027" 100000000000002@lid   # a new group, with people you know
wa personal chats members add 120363000000000001@g.us 100000000000002@lid
wa personal chats update 120363000000000001@g.us --join-approval on
wa personal chats requests list 120363000000000001@g.us
```

Renaming a group, its photo, members and admins, the invite link, join requests and who may send or add people are
commands too. The members see each change, so each passes the profile's permissions and hourly limit. `wa` adds only
people in your address book or that you have written to: WhatsApp bans accounts that add strangers.

More: [groups](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/groups.md)

## Agent setup in detail

**The skill.** Claude Code reads `~/.claude/skills/whatsapp-cli/`; Codex and Gemini CLI read
`~/.agents/skills/whatsapp-cli/`. Start a new agent session if it does not see the skill.

```sh
wa skill install --for all        # both folders, without linking
wa skill show                     # the complete instructions, without installing them
```

**The MCP server.** The profile's `permissions` decide which tools it offers. `readonly` stops the agent from
changing anything; at `ask` the server shows no form, so set up approval in your agent app.

```sh
claude mcp add wa -- wa personal mcp  # Claude Code, by hand
wa personal mcp doctor                # check the local MCP server
```

**From the browser.** ChatGPT or Claude in the browser reach `wa personal mcp --http --public-url` behind your tunnel,
after a login with a one-time access code from your terminal.

More: [the MCP server](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/mcp.md) · [from the browser](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/remote.md)

## Output for scripts and agents

With `--json` a command prints only data, as one JSON value. `--jsonl` prints one object per line. Every list has
one shape:

```json
{ "items": [ … ], "page": { "limit": 20, "has_more": true }, "meta": { … } }
```

An error goes to stderr as one line, with stdout empty, and the command exits with a fixed code: `4` link the
profile, `5` the profile may not do this, `6` chat or message not found, `8` a limit, `12` another command holds the
device, `14` unknown whether a message went. `wa commands --json` is the whole command tree.

More: [CLI contract](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/cli-contract.md) · [every command and exit code](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/commands.md)

## Settings and permissions

```sh
wa personal config set permissions.messages readonly   # no change to messages from this profile
wa personal config set permissions.messages.send ask   # a question in the terminal before each send
wa personal config set sends_per_hour 10               # at most 10 sends an hour (30 by default)
wa personal recipients add "Book club"                 # the first add turns the recipient list on
wa personal sends list                                 # every attempt: sent, refused, failed or not known
```

More: [permissions](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/permissions.md) · [profiles](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/profiles.md) · [configuration](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/configuration.md) ·
[limits](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/limits.md)

## Limits

Each profile has one request pace, shared by every command, `serve` and the MCP server at once, so a script stays far
from what WhatsApp bans. A profile sends at most 30 messages an hour by default. One command at a time may connect a
profile; another one is refused with exit code `12` and names the holder, unless `serve` runs and carries it on its
connection. There is nothing to download in bulk: reads answer from the local store.

More: [limits and waits](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/limits.md)

## Security

- The device keys are one file readable only by your user. Whoever copies it can read and send as you until you
  remove the device on your phone. No command takes a phone number or a pairing code as an argument.
- The local store holds the full text of what was received, unencrypted and readable only by your user.
- Every send, from a command or over MCP, passes the profile's limits and is written to a journal — without its
  text.
- Nothing `wa` sends to WhatsApp names this tool: it links as a desktop browser.

To report a vulnerability: [SECURITY.md](https://github.com/WireCatLabs/whatsapp-cli/blob/main/SECURITY.md). More: [security](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/security.md)

## When something goes wrong

```sh
wa personal doctor          # the engine, the device keys' file modes and who holds the connection
wa personal doctor --online # also connect once and read the account
wa personal runs list       # recorded runs
```

More: [troubleshooting by symptom](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/troubleshooting.md) · [diagnostics](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/diagnostics.md)

## How it differs

`wa` shares its commands, its store and its agent tools with tg and max, so what you learn in one works in the
others. WhatsApp is different in three ways:

- **History comes from your phone.** WhatsApp's servers keep no history to ask for. Your phone sends your recent
  chats once, when `wa` links, and `wa serve` keeps receiving new ones. Older messages of one chat can be asked of the
  phone, 50 at a time, while WhatsApp is open on it (`wa personal messages sync`). Every read answers from the local
  store and never connects.
- **One connection per device.** WhatsApp allows one. While `wa serve` runs, other commands for the same profile,
  a send included, run through its connection. On Windows they are refused until `serve` stops, for now.
- **Unofficial.** WhatsApp's terms forbid unofficial clients, and WhatsApp may ban an account that uses one. `wa`
  never sends in bulk or to strangers, never sends "online" or "typing", and marks nothing read unless you ask.

## Part of WireCat

[WireCat](https://wirecat.dev) is an open-source, local-first context layer for AI agents. `wa` sits beside
[tg](https://github.com/WireCatLabs/tg-cli) for Telegram and [max](https://github.com/WireCatLabs/max-cli) for MAX, in
the same local store.

## Technical docs

Every page is in [`docs/`](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/README.md):

| Page | Answers |
|---|---|
| [index](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/index.md) | The docs site's start page: what `wa` is, the first minute, where to go next |
| [installation](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/installation.md) | How do I install it, and what does it need? |
| [usage](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/usage.md) | How do I link, read, send and change a message — in that order? |
| [sessions](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/sessions.md) | How does linking work: QR or pairing code, one connection per device, profiles, unlinking? |
| [archive](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/archive.md) | What does the local store keep, how is it filled, and how do I export and back it up? |
| [search](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/search.md) | How do I find a message by its words, sender, chat, date, file or label, save a search and count? |
| [attachments](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/attachments.md) | Sending, saving and forwarding files; their text, and voice notes as text |
| [query-language](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/query-language.md) | Every search field, operator, preset, limit and the JSON answer |
| [groups](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/groups.md) | How do I keep up with a group, and run one? |
| [people](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/people.md) | One person: what the store holds about them, your own names and notes |
| [mcp](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/mcp.md) | How do I connect Claude Desktop, Cursor or another client without a terminal? |
| [remote](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/remote.md) | ChatGPT or Claude in the browser, through a login and a tunnel |
| [recipes](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/recipes.md) | What can an agent do for me every day, and how do I run it on a schedule? |
| [commands](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/commands.md) | Every command, option and exit code — **generated** from the program |
| [configuration](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/configuration.md) | How do I configure common behaviour? |
| [permissions](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/permissions.md) | What a profile may read, what asks first, and what may go ahead |
| [profiles](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/profiles.md) | Several accounts on one computer, and how a command picks one |
| [configuration-reference](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/configuration-reference.md) | Every key, default, scope and variable |
| [cli-contract](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/cli-contract.md) | Invocation, output, errors, headless runs, bounds and previews |
| [limits](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/limits.md) | Limits, waits and the one connection per device |
| [diagnostics](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/diagnostics.md) | What did a command do, and what is never recorded? |
| [troubleshooting](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/troubleshooting.md) | Something does not work: what the screen says, and what to do |
| [security](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/security.md) | What does `wa` keep on my computer, and what can go wrong? |
| [roadmap](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/roadmap.md) | What is coming next? |

What each version changed: [CHANGELOG.md](https://github.com/WireCatLabs/whatsapp-cli/blob/main/CHANGELOG.md).

## Development

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm engine:build && pnpm engine:test   # the Go engine; needs Go
pnpm generate                           # rewrites docs/commands.md from the command tree
bin/wa personal chats list              # everything under .wa/ in this checkout, never the real profile
```

Everything that is not specific to WhatsApp — the commands, the store, the send guard, the MCP server — lives in
[cli-core](https://github.com/WireCatLabs/cli-core), shared with tg and max.

More: [ARCHITECTURE](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/dev/ARCHITECTURE.md) · [TESTING](https://github.com/WireCatLabs/whatsapp-cli/blob/main/docs/dev/TESTING.md)

## Contributing

Pull requests, bug reports and ideas are welcome in [issues](https://github.com/WireCatLabs/whatsapp-cli/issues).

Custom automation with WhatsApp, other messengers and AI agents: [info@neirox.ai](mailto:info@neirox.ai).

## License

The CLI is [Apache-2.0](https://github.com/WireCatLabs/whatsapp-cli/blob/main/LICENSE). The engine is not: the Go program in [`engine/`](https://github.com/WireCatLabs/whatsapp-cli/tree/main/engine) and the
`@wirecat/whatsapp-engine-*` packages that carry it are [GPL-3.0-only](https://github.com/WireCatLabs/whatsapp-cli/blob/main/engine/LICENSE), because the engine links
go.mau.fi/libsignal, which is under the GNU General Public License 3.0, through whatsmeow. The two are separate
programs: `wa` starts the engine as a child process and talks to it only over stdin and stdout. Each engine package
says where its source is and lists every Go module it links in `THIRD_PARTY_NOTICES`.
