# Recipes: an agent and your WhatsApp

Use this page when you want your AI agent (for example Claude Code, Codex, Cursor or Gemini CLI) to do regular work
with your WhatsApp: a morning summary, a report on a chat, who owes what, what you have not answered. Each recipe
gives you a request to copy, the commands the agent may run, and whether it writes anything to WhatsApp. At the end
you can run the agent on a schedule, with limits it cannot get around.

Terms on this page:

- **Agent** — an AI program that runs commands on your computer for you.
- **Skill** — a file that tells the agent how to use `wa`. `wa skill install` puts it where the agent looks for it.
- **MCP client** — an AI app without a terminal, such as Claude Desktop. It reaches `wa` through the MCP server
  `wa personal mcp` instead of running commands.
- **Headless mode** — the agent takes one request, does it and exits, with no conversation. Claude Code calls it
  `-p` mode; Codex calls it `codex exec`.
- **cron** — the scheduler built into Linux and macOS. It starts a command at set times.

## What the recipes do

Every recipe below reads the local store, which `wa personal serve` keeps filled from your phone. Reads never connect
to WhatsApp, so they run beside `serve`.

| Recipe | Writes to WhatsApp | Fits a schedule |
|---|---|---|
| [Morning summary](#morning-summary) | no | yes |
| [Weekly report on a chat](#weekly-report-on-a-chat) | no | yes |
| [Who owes what](#who-owes-what) | no | yes |
| [What you have not answered](#what-you-have-not-answered) | no | yes |
| [Find something that was said](#find-something-that-was-said) | no | yes |
| [Draft a reply](#draft-a-reply) | only after your yes | no |

## Once, first

1. Install `wa` and link it: see [installation](installation.md) and [linking](sessions.md).
2. Keep the store filled: `wa personal server install`, then `wa personal server start`. `wa personal server status`
   says whether it runs.
3. Give the agent the skill:

   ```sh
   wa skill install
   ```

   The skill goes to the folders of Claude Code (`~/.claude/skills/whatsapp-cli/`) and of Codex and Gemini CLI
   (`~/.agents/skills/whatsapp-cli/`). `wa skill show` prints the same text, if your agent keeps skills somewhere else.
4. Save the requests below in files, for example in `~/wa-recipes/`. The schedule commands read the request from a
   file.

An MCP client needs no skill. Connect the MCP server (`wa personal mcp config` prints the entry for its settings);
see [the MCP server](mcp.md).

## What the agent may do

An agent on a schedule works without you, so put the limits into settings, not into the request. An agent can
misread "send nothing". It cannot get around a setting that it is not allowed to change.

**Limit what the agent may run.** This is a setting of the agent. For example, Claude Code in `-p` mode runs only the
commands in `--allowedTools`. With no `wa personal messages send` in the list, the agent cannot call it:

```sh
claude -p "$(cat ~/wa-recipes/morning.md)" --allowedTools "Bash(wa personal inbox:*)"
```

**Limit what the profile may do.** This works for every agent:

```sh
wa personal config set permissions.messages readonly
wa personal config set permissions.reactions readonly
wa personal config set permissions.polls readonly
wa personal config set permissions.chats readonly
wa personal config show                     # check the permissions in force
wa personal config set sends_per_hour 5     # or: at most five sends an hour
wa personal recipients add 100000000000001@lid   # and only to the chats on this list
```

`readonly` on one resource does not cover the others: `messages` alone still lets the agent react or mark a chat
read. `recipients add` looks the chat up on WhatsApp, so it connects, and it does not go through `serve`: while
`serve` runs, it is refused with exit code `12`.
`permissions` limits your own commands too, until you change it back:
`wa personal config unset permissions.messages`. To limit only the agent, give it a profile of its own. Every attempt
to send, refused ones included, is in `wa personal sends list`. See [permissions](permissions.md).

**Never in bulk, never to strangers.** WhatsApp bans accounts that send to many people at once, or to numbers that
never wrote to them. No recipe here sends on its own.

**Reading gives nothing away.** No command in the recipes below marks anything read: nobody sees that the agent
opened a chat. A read receipt goes only with `--mark-read` or `chats mark-read`.

## Running on a schedule

- **Claude Desktop scheduled tasks.** The task runs on your computer, so it has `wa` and your store. See
  [Claude's scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks).
- **cron and `claude -p`.** No app needed, on any computer that is on at that time:

  ```cron
  30 8 * * * claude -p "$(cat ~/wa-recipes/morning.md)" --allowedTools "Bash(wa personal inbox:*)" >> ~/wa-recipes/morning.log 2>&1
  ```

  cron starts jobs with an almost empty environment. If Node comes from nvm, fnm or Volta, it is not on cron's
  `PATH` and the job fails with `node: not found`, exit code 127. Put the folder of `which node` at the top of
  `crontab -e`:

  ```cron
  PATH=/home/you/.nvm/versions/node/v24.0.0/bin:/usr/local/bin:/usr/bin:/bin
  ```

  Run the first job by hand and read the log. See [Claude's headless mode](https://code.claude.com/docs/en/headless).
- **cron and `codex exec`.** The same for Codex. Its sandbox closes file writes by default, and `wa` writes its
  run records and the saved point of `--new`:

  ```cron
  30 8 * * * codex exec --sandbox danger-full-access "$(cat ~/wa-recipes/morning.md)" >> ~/wa-recipes/morning.log 2>&1
  ```

- **Inside an open Claude Code session**: `/loop`, or "remind me at 15:00". It works while the session is open.

Claude's cloud routines do not fit: they run on another computer, where there is no `wa` and no store of yours.

## Morning summary

Writes to WhatsApp: **no**. Allow: `Bash(wa personal inbox:*)`.

> Run `wa personal inbox --new --json`. Group the messages by chat. For each chat, one line: who writes and what they
> want. Put first what needs an answer today.

`--new` shows each message once. `wa` remembers where it stopped in each chat, and the next run starts there.

### Since when is "new"

- `wa personal inbox` — other people's unread messages.
- `wa personal inbox --new` — since the last `--new` run. Only `wa` knows that point; nobody else sees it.
- `wa personal inbox 'date>2d'` — the last two days; the saved point stays where it was.

None of them marks anything read. `--kind dialog` keeps one-to-one chats, `--kind group` groups.

## Weekly report on a chat

Writes to WhatsApp: **no**. Allow: `Bash(wa personal messages list:*)`.

> Read the last 7 days of the group `120363000000000001@g.us`:
> `wa personal messages list 120363000000000001@g.us "date>7d" --limit 200 --json`. If the answer has a `page.next`
> step, follow it. Write a report: what was decided, who took on what and by when, which questions are still open.
> Give each point its date and author.

The store holds what the phone pushed when `wa` linked and what `serve` received since. An older stretch is not there
until `wa personal messages sync 120363000000000001@g.us` asks the phone for it
([older history](archive.md#older-history-from-your-phone)).

## Who owes what

Writes to WhatsApp: **no**. Allow: `Bash(wa personal review:*)`, `Bash(wa personal messages context:*)`,
`Bash(wa personal search messages:*)`.

> Run `wa personal review --new --json` (the first time, the last 3 days; then from the last `--new`, a point per
> chat). Sort it into three lists: what I owe, what I wait for from others, what needs clarifying. Give each point
> its chat, date and the message ids it rests on. If the answer says `"complete": false`, tell me what is missing.

`review` and `serve` also keep a list of tasks: `wa personal tasks list state:open` shows what waits on you
([groups](groups.md#what-waits-on-you)).

## What you have not answered

Writes to WhatsApp: **no**. Allow: `Bash(wa personal review:*)`.

> Run `wa personal review 'date>7d' --unanswered --json`. Show the questions nobody answered: who asked, in which
> chat, and how long ago.

## Find something that was said

Writes to WhatsApp: **no**. Allow: `Bash(wa personal search messages:*)`, `Bash(wa personal messages context:*)`.

> Search for "invoice" with `wa personal search messages invoice --json`. For each hit, read
> `wa personal messages context <locator> --json` and tell me who said what, and when.

Search reads only the local store. See [search](search.md).

## Draft a reply

Writes to WhatsApp: **only after your yes**. This one is for a conversation with the agent, not for a schedule.

> Read the last 20 messages of the chat `100000000000001@lid` and suggest an answer to their last question. Do not
> send it — show me the text.

Once you agree, the agent sends it: `wa personal messages send 100000000000001@lid "…"`. While `serve` runs, the send
goes through `serve`'s connection ([one connection per device](sessions.md#one-connection-per-device)); there it
cannot ask, so at permission level `ask` it needs `--yes`.
An MCP client asks you before each write if you leave `wa_write` unapproved in it.
