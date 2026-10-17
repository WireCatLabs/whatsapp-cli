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
| See one group and who is in it | `wa personal chats show` |
| Delete a message for everyone, as the group's admin | `wa personal messages delete --for-everyone` |

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

`review` and `serve` keep a list of tasks in the local store. A question nobody answered, and a message that mentions
you, opens a task; your answer closes it. A task points at its message and never copies it.

The first fill of the store opens no tasks from your history; later messages do. To turn a group's history into
tasks, list what would open, then open it:

```sh
wa personal tasks apply 120363000000000001@g.us
wa personal tasks apply 120363000000000001@g.us --last 300 --yes
```

See what waits on you, oldest first, then only questions and mentions in one group:

```sh
wa personal tasks list state:open
wa personal tasks list 'chat:"120363000000000001@g.us" (kind:question OR kind:mention)'
```

Add what the rules cannot see, such as a promise you made, by the message's locator from a search or a list:

```sh
wa personal tasks add <msg:locator> --type promise --category other
```

`tasks categories` lists the categories a task can take. If the task may be the same job as an open one, `tasks add`
refuses with exit code `2` and lists the candidates; repeat with `--into <task>` or `--new`.

Close a task that needs no answer:

```sh
wa personal tasks close <task> --as dismissed --reason no-reply-needed
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
is not there, so a number is a minimum, never a proof of silence.

## One group and who is in it

```sh
wa personal chats show 120363000000000001@g.us
```

The group's kind, unread count, last message time and its members. This one asks WhatsApp, so it connects, and while
`serve` holds the device it is refused ([one connection per device](sessions.md#one-connection-per-device)).

## Deleting for everyone

```sh
wa personal messages delete 120363000000000001@g.us 3EB0AAAAAAAAAAAAAAAAAA --for-everyone
```

In a group you administer, this removes another member's message for everyone; anywhere, it removes your own. It
needs the message in the local store, since WhatsApp addresses a message by its sender too. It asks first by
default, and it cannot be undone. Deleting for yourself alone is not built: do that on the phone.

An agent connected over the [MCP server](mcp.md) can run the same commands, as far as the profile's
[permissions](permissions.md) allow.
