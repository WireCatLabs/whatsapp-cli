# wa

`wa` connects your own WhatsApp account to the terminal and to your AI agent (for example Claude Code, Codex, Cursor
or Gemini CLI). Use it when you want to read, search and answer your chats without opening WhatsApp, or hand that
work to an agent within limits you set. It links to your account as a device, the way WhatsApp Web does.

This page tells you what `wa` can do, how to start in about five minutes, and which page answers which question.

Three terms appear on every page:

- **Terminal** (command line): the window where you type commands, such as Terminal on macOS or PowerShell on
  Windows. `wa` is one command you type there.
- **AI agent**: a program that does tasks for you and can run commands, such as Claude Code or Codex. It uses `wa`
  for you.
- **Skill**: a short instruction file that tells your agent how to use `wa`. Setup installs it.

## What it can do

| You want to | Where |
|---|---|
| Read your chats and other people's unread messages; nothing is marked read unless you ask | [Using wa](usage.md) |
| Find what was said, by words, people, dates or labels | [Search](search.md) |
| Keep a copy of your messages on this computer, and search or export it | [The local store](archive.md) |
| Send, save and forward photos and files, and hear voice notes as text | [File attachments](attachments.md) |
| Answer, edit, react and delete for everyone, yourself or through an agent, within your limits | [Using wa](usage.md), [Permissions](permissions.md) |
| See which questions nobody answered in your groups | [Groups](groups.md) |
| Use WhatsApp from an app with no terminal, or from a chat in the browser | [The MCP server](mcp.md), [From the browser](remote.md) |

Every command does one thing, gives the same shape of answer every time, and has a fixed exit code for each kind of
failure. This is why scripts and agents can rely on it.

`wa` is early: it is not on npm yet ([roadmap](roadmap.md)).

## Get started

```sh
npm install -g @wirecat/whatsapp-cli   # once published; until then, build it from the repository
wa personal setup                      # link by QR code, check five chats, install the agent skill
wa personal server install             # keep receiving in the background
wa personal inbox                      # other people's unread messages; nothing is marked read
```

Allow about five minutes for setup: your phone sends your recent chats once, right after linking. Older messages of a
chat can be asked of the phone later, 50 at a time ([older history](archive.md#older-history-from-your-phone)). To
choose the agent that gets the skill, add `--agent` with `codex`, `cursor`, `claude`, `gemini` or `all`.
`wa setup --help` shows the linking choices.

`wa` needs Node 22.16 or newer ([installation](installation.md)). How linking works, and why only one `wa` command at
a time may connect: [linking, devices and profiles](sessions.md).

## Where to go next

| Page | Answers |
|---|---|
| [Installation](installation.md) | What does it need, and how do I install it? |
| [Using wa](usage.md) | How do I read, send and change a message? |
| [Linking, devices and profiles](sessions.md) | How does linking work, where are the keys, how do profiles work? |
| [The local store](archive.md) | What does the local store keep, and how do I keep it current, export and back it up? |
| [File attachments](attachments.md) | How do I send, save, forward and read files, and hear a voice note as text? |
| [Search](search.md) | How do I find a message by its words, sender, chat, date or label? |
| [The MCP server](mcp.md) | How do I connect Claude Desktop, Cursor or another client without a terminal? |
| [Recipes](recipes.md) | What can an agent do for me every day, and how do I run it on a schedule? |
| [All commands](commands.md) | Every command, option and exit code |
| [Configuration](configuration.md) | What can I set, and which value wins? |
| [Diagnostics](diagnostics.md) | What did a command do, and what is never recorded? |
| [Troubleshooting](troubleshooting.md) | Something does not work: what the screen says, and what to do |
| [Security](security.md) | What does `wa` keep on my computer, and what can go wrong? |
| [Roadmap](roadmap.md) | What is coming next? |
