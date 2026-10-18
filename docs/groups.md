# Groups

Use this page when you take part in WhatsApp groups, or run one, and want help keeping up: find questions nobody
answered, sum up a week, keep a list of what waits on you and count the group's activity. Reading marks nothing
read, so checking on a group does not tell its members you looked.

Some words on this page:

- **A group id** ends in `@g.us` (`120363000000000001@g.us`). `wa personal chats list 'kind:group' --offline` lists
  your groups with their ids; a group's name works too when only one chat has it.
- **An admin** is a member with rights to manage the group. Some commands count only your answers and the admins'.
- **The local store** is the copy of messages `wa` keeps on this computer, filled by the phone's history push and by
  `serve`. Reports and tasks use it, so they see only what arrived.
- **A task** is something that waits on you, such as a question nobody answered. `wa` opens and closes tasks in the
  local store.

## What you can do

| Task | Command |
| --- | --- |
| Find questions that wait for an answer | `wa personal review --unanswered` |
| Sum up a week: decisions, promises, open questions | `wa personal review 'date>7d'` |
| Keep a list of what waits on you | `wa personal tasks list` |
| See the week's activity | `wa personal stats chats show --offline` |
| See one group and who is in it | `wa personal chats show`, `chats members list` |
| Delete a message for everyone, as the group's admin | `wa personal messages delete --for-everyone` |
| Make a group, join one by its link, or leave | `wa personal chats create`, `chats join`, `chats leave` |
| Add or remove people, make someone an admin | `wa personal chats members add`, `chats admins add` |
| Rename a group, or change who may add people | `wa personal chats update` |
| Show or replace the invite link | `wa personal chats link show`, `chats link reset` |
| Let in or turn away people who asked to join | `wa personal chats requests list`, `chats requests accept` |

Every option is in the [command reference](commands.md).

## With an agent

Your AI agent (for example Claude Code, Codex, Cursor or Gemini CLI) can run these checks for you. An agent with a
terminal needs the [wa skill](recipes.md#once-first); an agent in an app without a terminal needs the
[MCP server](mcp.md).

The names, messages and results below are fictional.

### Who is waiting for an answer

**Your request:**

> What in the hiking group has been waiting for an answer for more than four hours?

**Command:**

```sh
wa personal review 'chat:"120363000000000001@g.us"' --unanswered 4h --json
```

**Example agent answer:**

> **2 questions are waiting for an answer.**
>
> | Person | Question | Waiting |
> | --- | --- | --- |
> | Lena | What time do we leave on Saturday? | 6 hours |
> | Sam | Are the tents shared? | 12 hours |

A question mark outside a link, or a reply to you or an admin, opens a question; your or an admin's reply closes it.

### A weekly report

**Your request:**

> Summarise the week in the hiking group.

**Command:**

```sh
wa personal review 'chat:"120363000000000001@g.us" date>7d' --json
```

**Example agent answer:**

> **Decided:** leave at 7:00 from the station.
>
> **Committed:** Lena — food; Sam — tents.
>
> **Still open:** who brings the cooking pot.

### On a schedule

No agent is needed for a list of open questions: it is an ordinary command, and it reads only the store.

```cron
0 9,21 * * * wa personal review 'chat:"120363000000000001@g.us"' --unanswered --json >> ~/hiking-open.jsonl 2>> ~/wa-cron.log
```

cron starts jobs with an almost empty environment: see [running on a schedule](recipes.md#running-on-a-schedule).

## What waits on you

`review` and `serve` keep a list of tasks in the local store: what you have to do, and what someone owes you. A task
points at its message and never copies it. Where a rule opens one:

- **A one-to-one chat:** a question you did not answer, and a message that mentions you.
- **A group:** only a question that replies to your message, and a mention of you. Other people's questions are not
  your tasks.
- **A channel or the chat with yourself:** nothing.

Your answer closes the task. To record every question in a group, whoever it is for, tag the group. In a tagged
group a direct reply from any member other than the one who asked also closes the question; a later message that
does not reply to it closes nothing:

```sh
wa personal tags add --chat 120363000000000001@g.us watch-tasks
```

The first fill of the store opens no tasks from your history; later messages do. To turn a group's history into
tasks, list what would open, then open it:

```sh
wa personal tasks scan 120363000000000001@g.us
wa personal tasks scan 120363000000000001@g.us --last 300 --yes
```

When someone promises you something, keep it as their task, and list what others owe you. The message locator, the
task key `PR-4` and the other ids in this section are made up; take real ones from a search, a list or `tasks list`:

```sh
wa personal tasks add msg:whatsapp/100000000000009%40lid/120363000000000001%40g.us/3EB0A1B2C3D4E5F6A7B8 \
  --type promise --category other --assignee sender
wa personal tasks list "assignee:any state:open"
```

`--assignee sender` is whoever sent the message; `--assignee person:<id>` names someone else, and
`tasks plan <task> --assignee none` clears it. A task with no assignee is fine: better than a missed one.

See what waits on you, oldest first, then only questions and mentions in one group:

```sh
wa personal tasks list state:open
wa personal tasks list 'chat:"120363000000000001@g.us" (kind:question OR kind:mention)'
```

Add what the rules cannot see, such as a promise you made, by the message's locator from a search or a list:

```sh
wa personal tasks add msg:whatsapp/100000000000009%40lid/120363000000000001%40g.us/3EB0A1B2C3D4E5F6A7B8 \
  --type promise --category other
```

`tasks categories` lists the categories a task can take. If the task may be the same job as an open one, `tasks add`
refuses with exit code `2` and lists the candidates; repeat with `--into <task>` or `--new`.

Close a task that needs no answer:

```sh
wa personal tasks close PR-4 --as dismissed --reason no-reply-needed
```

An AI agent that closes a task states how sure it is with `--certainty`, from 0 to 1. Below the store's threshold
(`task_agent_close_min`, 0.8 by default) the task stays open with a close suggestion. `tasks list close:suggested`
finds them; confirm one with `tasks close <task>`, or refuse it with `tasks reject <task>`.

## The group's numbers

```sh
wa personal stats chats show 120363000000000001@g.us --offline
wa personal stats chats show 120363000000000001@g.us --offline --since-time 30d --by week
```

Messages, active members, replies, reactions and questions answered, counted from the local store for a period,
7 days unless `--since-time` says otherwise. A count covers only what the store holds; a stretch before `wa` linked
is not there, so a number is a minimum, never a proof of silence. `wa` does not record joins and leaves yet, so the
JSON's `members.joined` and `members.left` read `0` whatever happened; `chats members history` shows who joined or
left between member fetches.

## One group and who is in it

```sh
wa personal chats show 120363000000000001@g.us
wa personal chats members list 120363000000000001@g.us
```

`chats show` gives the group's kind, unread count, last message time and its members as the local store holds them;
it never connects. `chats members list` asks WhatsApp who is in the group now; while `serve` runs, it goes through
`serve` ([one connection per device](sessions.md#one-connection-per-device)).

## Deleting for everyone

```sh
wa personal messages delete 120363000000000001@g.us 3EB0AAAAAAAAAAAAAAAAAA --for-everyone
```

In a group you administer, this removes another member's message for everyone; anywhere, it removes your own. It
needs the message in the local store, since WhatsApp addresses a message by its sender too. It asks first by
default, and it cannot be undone. Deleting for yourself alone is not built: do that on the phone.

## Run a group

```sh
wa personal chats create "Hiking" 100000000000002@lid
wa personal chats members add 120363000000000001@g.us 100000000000002@lid
wa personal chats members remove 120363000000000001@g.us 100000000000003@lid
wa personal chats admins add 120363000000000001@g.us 100000000000002@lid
wa personal chats update 120363000000000001@g.us --title "Hiking club" --only-admins-add on --join-approval on
wa personal chats update 120363000000000001@g.us --only-admins-send on --disappear-time 7d
wa personal chats update 120363000000000001@g.us --photo club.jpg
wa personal chats link show 120363000000000001@g.us
wa personal chats link reset 120363000000000001@g.us
wa personal chats requests list 120363000000000001@g.us
wa personal chats requests accept 120363000000000001@g.us 100000000000004@lid
wa personal chats join https://chat.whatsapp.com/AAAAAAAAAAAAAAAAAAAAAA
wa personal chats leave 120363000000000001@g.us
```

- **The members see each of these**, so each goes through the profile's [permissions](permissions.md) and hourly
  limit, like a send, and connects (through `serve` while it runs).
- **Only people you know are added.** `chats create` and `members add` take someone in your address book or that you
  have written to, and refuse anyone else: WhatsApp bans accounts that add strangers.
- **An admin has every right.** WhatsApp has one kind of admin, so `admins add` takes no `--can` and gives them all.
- **One invite link.** A group has one link; `link reset` replaces it, and the old one stops working. Only admins see
  it.
- **Settings.** `update` changes the name, the description, `--only-admins-add`, `--join-approval`,
  `--only-admins-send`, `--only-admins-edit-info` and `--disappear-time`. Messages disappear after 24h, 7d or 90d,
  the times WhatsApp offers; any other is refused, and `off` keeps them.
- **The photo.** `update --photo` takes a square JPEG of 190 to 720 pixels a side, the only kind WhatsApp takes as a
  group photo. `wa` does not convert or crop one: export it as a JPEG first. A PNG or WebP is refused by its content,
  whatever its name. The photo is set first: if the title, description or a setting given with it then fails, the
  error says the photo was set. Removing the photo is done on the phone.
- **Name a group by its id** here: a command that connects knows group names only after it connects.
- `join` on a group that approves who joins answers `requested: true`; you are in once an admin lets you in.

With `--offline`, `chats members list` shows the members stored before instead of asking WhatsApp.
`chats members fetch` keeps the member list in the local store. `chats members history` shows what the fetches
recorded: everyone present at the first fetch, then who joined or left at each later one. `chats events` answers from
the local store and never connects, but `wa` does not record WhatsApp's joins and leaves there yet, so it shows
nothing. An empty list does not mean nobody joined.

An agent connected over the [MCP server](mcp.md) can run the same commands, as far as the profile's
[permissions](permissions.md) allow.
