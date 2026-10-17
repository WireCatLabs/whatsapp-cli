# wa — WhatsApp CLI for AI agents

Your personal WhatsApp in the terminal, searchable on your computer, and ready for Claude Code, Codex, Cursor or any
agent — within limits you set.

> **Early.** `wa` links, reads into its local store, sends text and files, edits, deletes for everyone, reacts and
> runs groups. It is not on npm yet: see the [roadmap](docs/roadmap.md).

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
npm install -g @wirecat/whatsapp-cli   # once it is published; until then, see the installation guide
wa personal setup --agent claude       # also codex, cursor, gemini, all or none
wa personal server install             # keep receiving in the background
wa personal inbox                      # other people's unread messages; nothing is marked read
```

Allow about five minutes. `wa personal setup` links `wa` to your account as a device — you scan a QR code in
WhatsApp → Settings → Linked devices — keeps the history your phone sends right after linking, checks your first
chats and installs the agent skill.

It needs **Node 22.16+ or 24+** on macOS, Linux or Windows. npm also installs the engine, the small program that
speaks WhatsApp's protocol, as a separate package for your system.

More: [installation guide](docs/installation.md) · [linking](docs/sessions.md)

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

More: [recipes, with a schedule for each](docs/recipes.md) · [using wa](docs/usage.md)

## Built for AI agents

- **Agents with a terminal** (Claude Code, Codex, Gemini CLI) run `wa` commands themselves. The bundled
  [skill](skills/whatsapp-cli/SKILL.md) tells them how: `wa personal setup --agent …` or `wa skill install` puts it in
  place, and `wa skill show` prints it before linking. An agent links with `--qr-file` and shows you the picture; it
  never asks for your phone number or a code.
- **Apps without a terminal** (Claude Desktop, Cursor and other MCP clients) connect to `wa personal mcp`.

```sh
wa personal mcp setup claude-code   # or: wa personal mcp setup codex
wa personal mcp config              # the entry for Claude Desktop, Cursor and others
```

More: [the MCP server](docs/mcp.md) · [from the browser](docs/remote.md)

## How it differs from tg and max

`wa` is part of the [WireCat](https://wirecat.dev) family, beside [tg](https://github.com/WireCatLabs/tg-cli) for
Telegram and [max](https://github.com/WireCatLabs/max-cli) for MAX. All three share their commands, their store and
their agent tools, so what you learn in one works in the others. WhatsApp is different in three ways:

- **History comes from your phone.** WhatsApp's servers keep no history to ask for. Your phone sends your recent
  chats once, when `wa` links, and `wa serve` keeps receiving new ones. Older messages of one chat can be asked of the
  phone, 50 at a time, while WhatsApp is open on it (`wa personal messages sync`). Every read answers from the local
  store and never connects.
- **One connection per device.** WhatsApp allows one. While `wa serve` runs, other commands for the same profile,
  a send included, run through its connection. On Windows they are refused until `serve` stops, for now.
- **Unofficial.** WhatsApp's terms forbid unofficial clients, and WhatsApp may ban an account that uses one. `wa`
  never sends in bulk or to strangers, never sends "online" or "typing", and marks nothing read unless you ask.

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

More: [search](docs/search.md) · [the local store](docs/archive.md) · [query language](docs/query-language.md)

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

Renaming a group, members and admins, the invite link, join requests and who may send or add people are commands
too. The members see each change, so each passes the profile's permissions and hourly limit. `wa` adds only people in
your address book or that you have written to: WhatsApp bans accounts that add strangers.

More: [groups](docs/groups.md)

## Output for scripts and agents

With `--json` a command prints only data, as one JSON value. `--jsonl` prints one object per line. Every list has
one shape:

```json
{ "items": [ … ], "page": { "limit": 20, "has_more": true }, "meta": { … } }
```

An error goes to stderr as one line, with stdout empty, and the command exits with a fixed code: `4` link the
profile, `5` the profile may not do this, `6` chat or message not found, `8` a limit, `12` another command holds the
device, `14` unknown whether a message went. `wa commands --json` is the whole command tree.

More: [CLI contract](docs/cli-contract.md) · [every command and exit code](docs/commands.md)

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

More: [linking, devices and profiles](docs/sessions.md) · [profiles](docs/profiles.md)

## Settings and permissions

```sh
wa personal config set permissions.messages readonly   # no change to messages from this profile
wa personal config set permissions.messages.send ask   # a question in the terminal before each send
wa personal config set sends_per_hour 10               # at most 10 sends an hour (30 by default)
wa personal recipients add "Book club"                 # the first add turns the recipient list on
wa personal sends list                                 # every attempt: sent, refused, failed or not known
```

More: [permissions](docs/permissions.md) · [profiles](docs/profiles.md) · [configuration](docs/configuration.md) ·
[limits](docs/limits.md)

## Limits

Each profile has one request pace, shared by every command, `serve` and the MCP server at once, so a script stays far
from what WhatsApp bans. A profile sends at most 30 messages an hour by default. One command at a time may connect a
profile; another one is refused with exit code `12` and names the holder, unless `serve` runs and carries it on its
connection. There is nothing to download in bulk: reads answer from the local store.

More: [limits and waits](docs/limits.md)

## Security

- The device keys are one file readable only by your user. Whoever copies it can read and send as you until you
  remove the device on your phone. No command takes a phone number or a pairing code as an argument.
- The local store holds the full text of what was received, unencrypted and readable only by your user.
- Every send, from a command or over MCP, passes the profile's limits and is written to a journal — without its
  text.
- Nothing `wa` sends to WhatsApp names this tool: it links as a desktop browser.

To report a vulnerability: [SECURITY.md](SECURITY.md). More: [security](docs/security.md)

## When something goes wrong

```sh
wa personal doctor          # the engine, the device keys' file modes and who holds the connection
wa personal doctor --online # also connect once and read the account
wa personal runs list       # recorded runs
```

More: [troubleshooting by symptom](docs/troubleshooting.md) · [diagnostics](docs/diagnostics.md)

## Technical docs

Every page is in [`docs/`](docs/README.md):

| Page | Answers |
|---|---|
| [index](docs/index.md) | The docs site's start page: what `wa` is, the first minute, where to go next |
| [installation](docs/installation.md) | How do I install it, and what does it need? |
| [usage](docs/usage.md) | How do I link, read, send and change a message — in that order? |
| [sessions](docs/sessions.md) | How does linking work: QR or pairing code, one connection per device, profiles, unlinking? |
| [archive](docs/archive.md) | What does the local store keep, how is it filled, and how do I export and back it up? |
| [search](docs/search.md) | How do I find a message by its words, sender, chat, date, file or label, save a search and count? |
| [attachments](docs/attachments.md) | Sending, saving and forwarding files; their text, and voice notes as text |
| [query-language](docs/query-language.md) | Every search field, operator, preset, limit and the JSON answer |
| [groups](docs/groups.md) | How do I keep up with a group, and run one? |
| [people](docs/people.md) | One person: what the store holds about them, your own names and notes |
| [mcp](docs/mcp.md) | How do I connect Claude Desktop, Cursor or another client without a terminal? |
| [remote](docs/remote.md) | ChatGPT or Claude in the browser, through a login and a tunnel |
| [recipes](docs/recipes.md) | What can an agent do for me every day, and how do I run it on a schedule? |
| [commands](docs/commands.md) | Every command, option and exit code — **generated** from the program |
| [configuration](docs/configuration.md) | How do I configure common behaviour? |
| [permissions](docs/permissions.md) | What a profile may read, what asks first, and what may go ahead |
| [profiles](docs/profiles.md) | Several accounts on one computer, and how a command picks one |
| [configuration-reference](docs/configuration-reference.md) | Every key, default, scope and variable |
| [cli-contract](docs/cli-contract.md) | Invocation, output, errors, headless runs, bounds and previews |
| [limits](docs/limits.md) | Limits, waits and the one connection per device |
| [diagnostics](docs/diagnostics.md) | What did a command do, and what is never recorded? |
| [troubleshooting](docs/troubleshooting.md) | Something does not work: what the screen says, and what to do |
| [security](docs/security.md) | What does `wa` keep on my computer, and what can go wrong? |
| [roadmap](docs/roadmap.md) | What is coming next? |

What each version changed: [CHANGELOG.md](CHANGELOG.md).

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

More: [ARCHITECTURE](docs/dev/ARCHITECTURE.md) · [TESTING](docs/dev/TESTING.md)

## Contributing

Pull requests, bug reports and ideas are welcome in [issues](https://github.com/WireCatLabs/whatsapp-cli/issues).

Custom automation with WhatsApp, other messengers and AI agents: [info@neirox.ai](mailto:info@neirox.ai).

## License

[Apache-2.0](LICENSE).
