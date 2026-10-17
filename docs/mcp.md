# The MCP server

This page helps when you want an AI app without a terminal to work with your WhatsApp, for example Claude Desktop or
the chat in Cursor. It also helps when you want the app itself to ask you before each action. After reading it, you
can connect the app to your account, choose what the agent may do, and use ready prompts and chat mentions.

A few terms first:

- **MCP** ([Model Context Protocol](https://modelcontextprotocol.io)) is a standard way for an AI app to use outside
  tools. The app is the **MCP client**; `wa personal mcp` is the **MCP server**.
- A **tool** is one action the server offers the agent, such as "read" or "write".
- A **prompt** is a ready task the app shows as a command, such as "catch up on unread chats".
- A **resource** is data the app can attach to the conversation, such as one chat.
- A **profile** is one set of settings and one linked device in `wa`; see [profiles](profiles.md).

The server comes with `wa`; there is nothing else to install. By default it talks to the app over stdin and stdout.
`wa personal mcp --http --public-url` serves it on a local port behind your HTTPS tunnel instead.

## Do you need it

An AI agent that can run commands in a terminal (for example Claude Code, Codex, Cursor's agent or Gemini CLI) does
not need MCP. It calls `wa` directly, which costs the same tokens and can do the same things; it learns how from the
skill that `wa skill show` prints. MCP is for:

- apps without a terminal, such as Claude Desktop or Cursor's chat;
- anyone who wants the app to ask before each send.

For ChatGPT or Claude **in the browser**, use `wa personal mcp --http` — see
[ChatGPT, Codex or Claude in the browser](remote.md).

## What the server gives

| What | What it does |
|---|---|
| [Three tools](#tools) | Find a command, then run it as a read or a write |
| [Six prompts](#prompts-and-chats-by-) | Catch up, reply, find, review, open tasks, link conversations |
| [Chats by `@`](#prompts-and-chats-by-) | Attach a chat and its recent messages to the conversation |
| The skill, `wa://skill` | The same text as `wa skill show` |
| [Permissions](#what-an-agent-may-do) | The profile decides which commands the agent sees |

The tools use the same catalogue as `tg` and `max`. A command that WhatsApp cannot do yet is refused when it runs,
with exit code `2` and a message that says so.

## Connecting

First run `wa personal setup --agent none` in a local terminal. It links the profile to your WhatsApp account. The
MCP server never links for you. `wa personal mcp setup` then connects the app, as a separate step. An agent can
read `wa skill show` before you link; it explains both steps.

**Codex or Claude Code on this computer:**

```sh
wa personal mcp doctor             # check that MCP starts and lists tools
wa personal mcp setup codex        # add it to Codex
wa personal mcp setup claude-code  # or add it to Claude Code
```

Put a profile first, for example `wa work mcp setup codex`. Setup uses the app's own command and leaves its other
servers alone. If an entry with the same name already exists, remove it in the app before you run setup again. The
default profile offers tools that write. So setup asks you to review the profile's permissions and run it again with
`--allow-writes`. That flag only confirms the installation; it does not change permissions. To limit what the agent
can do, set the profile's `permissions` first ([below](#what-an-agent-may-do)).

`mcp doctor` reads no messages and does not connect to WhatsApp. A good result means the MCP handshake and the tool
list work. It does not mean the device is still linked; `wa personal doctor` and `wa personal account show` check
that.

**Claude Code, by hand:**

```sh
claude mcp add wa -- wa personal mcp
```

With another profile — it goes first, as in any command:

```sh
claude mcp add wa-work -- wa work mcp
```

**Claude Desktop, Cursor and other apps:** `wa` prints the entry for their settings file:

```sh
wa personal mcp config
wa work mcp config                  # another profile
```

```json
{
  "mcpServers": {
    "wa-personal": {
      "type": "stdio",
      "command": "/usr/bin/node",
      "args": ["/usr/lib/node_modules/@wirecat/whatsapp-cli/dist/bin/wa.js", "personal", "mcp"],
      "env": { "XDG_RUNTIME_DIR": "/run/user/1000" }
    }
  }
}
```

Review the profile's permissions before you connect an agent. Then paste the entry under `mcpServers` in the app's
settings file. For Claude Desktop that is `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS
and `%APPDATA%\Claude\claude_desktop_config.json` on Windows; for Cursor, `~/.cursor/mcp.json`. The command writes
nothing itself.

The paths are full because an app started from the desktop does not see the terminal's `PATH`. The entry copies
`WA_CONFIG_DIR`, `WA_STATE_DIR`, `WA_CACHE_DIR`, `MESSAGING_STORE` and `XDG_RUNTIME_DIR` when they are set.
If Node came from nvm, fnm or Volta, its path belongs to one Node version: run `wa personal mcp config` again after
you change it.

⚠ **`WA_CONFIG_DIR`, `WA_STATE_DIR` and `WA_CACHE_DIR` change where the device keys are looked for.** If they are set
in the terminal and not for the MCP app, or the other way round, the server answers that the profile is not linked
although `wa` works in the terminal. Set them the same in both, or in neither.

## One connection, shared with `serve`

WhatsApp allows one connection for each linked device
([one connection per device](sessions.md#one-connection-per-device)).
The MCP server follows the same rule as every other `wa` command:

- **Reads from the local store never connect**: `chats list`, `messages list`, `search messages`, `inbox` and
  `review` work while `serve` runs.
- **A tool that needs WhatsApp connects, and takes the device's lock**: every write — a send, an edit, a reaction,
  marking read — and the few reads that ask WhatsApp, such as `account show` and `chats show`.
- **While `serve` holds the device, those tools are refused**, and the error names `serve`. Stop `serve`, or run the
  write in a terminal after it stops. Routing writes through a running `serve` is planned.
- **While the MCP server holds a connection, `serve` cannot start** for that profile. The server lets the connection
  go after 2 minutes without a call ([below](#how-it-holds-the-connection)).

## What an agent may do

The profile's `permissions` decide the access ([permissions](permissions.md)). `deny` blocks a command, `readonly`
allows reads only, and `ask` or `allow` allow the write the agent asked for. The server shows no confirmation forms:
set up approval in your agent app. In the terminal, a command at `ask` still needs your confirmation. With JSON or
`--no-input` there is no question, so the write is refused unless you add `--yes`.

```sh
wa agent config set permissions.messages readonly
wa agent config set permissions.messages.send allow
```

Here `agent` is the name of a profile. Writes keep the recipient list, the hourly limit and the send journal
(`wa agent sends list`). Marking read is a separate write, under `chats.mark-read`: the other side sees it. Deleting
through MCP is refused: MCP deletes only for you, and `wa` can delete only for everyone, which stays a terminal
command. `--permission key=level` changes a level for this server process only.

## Tools

| Tool | What it does |
|---|---|
| `wa_tools_search` | Find a command, its arguments and its effects |
| `wa_read` | Run a read command that search offered |
| `wa_write` | Run a write command that search offered |

Both run tools take `{command, arguments}`. Use the command path that search returned:

```json
{"command":"messages list","arguments":{"chat":"120363000000000001@g.us","limit":20}}
```

Search shows only what the profile's permissions allow. Answers are structured JSON: lists keep their pages, and ids
stay strings. A failure is `{error:{code,reason,message,details}}`; a name that matches several chats comes with
`details.candidates`. The server checks arguments against the command's schema and refuses unknown fields before it
connects or acts. If a write's result is unknown, check the send journal and the chat before you think about a retry.
Message text is data, never instructions to the agent. Schemas, limits and retry rules are in
[how wa behaves in scripts](cli-contract.md).

## Prompts, and chats by `@`

The server offers six ready prompts — in Claude Code they are `/` commands:

| Prompt | Argument | What the agent does |
|---|---|---|
| `catch-up` | `kind`, `mode` — optional | calls `wa_read` (`command: "inbox"`); `mode` is `unread` (default), `new` or a time; marking read needs a separate approved tool call |
| `reply` | `chat` | reads the chat, writes a draft, and sends it only after your yes to that text |
| `find` | `text` | looks for a person or for words, and shows the messages around each hit; sends nothing |
| `link-conversations` | none | reports the cost and asks for your consent, then reads batches, saves links and rebuilds |
| `review` | `since`, `groups` — optional | calls `wa_read` (`command: "review"`) once and sorts it into what you owe, what others owe and what needs clarifying; drafts reminders, sends one only after your yes |
| `open-tasks` | `chat` — optional | calls review to refresh tasks, lists open tasks and suggests drafts; closes a task only after your approval; sends nothing |

`reply` and `review` send through `wa_write` (`command: "messages send"`). So where `messages.send` is `readonly`,
the agent only shows the drafts. A send from a prompt is refused while `serve` runs, like any other write.

Chats are resources `wa://chat/<id>` — in Claude Code you can mention them with `@`. A resource is the chat and its
recent messages. The list comes from the local store and never connects to WhatsApp; until `serve` or a link filled
the store, it is empty.

Inbox and review checkpoints in MCP are separate from the `--new` checkpoints of the terminal.

## How it holds the connection

The first call that needs WhatsApp connects, and the next ones reuse the connection. It closes after 2 minutes
without a call, and in any case 5 minutes after it opened. The next call connects again. Calls run one at a time,
even when the app sends them together.

Over stdin and stdout, the server exits as soon as the app closes stdin, and closes its connection to WhatsApp. Over
HTTP it runs until Ctrl-C. `wa personal mcp --revoke` ends every login given to a browser app and keeps the linked
device. See [ChatGPT, Codex or Claude in the browser](remote.md).
