# Permissions

Decide what an AI agent, a script or another person may do with your WhatsApp through `wa`: what may only be read,
what asks you first, and what may go ahead without a question. You can make a profile read-only, allow one action
such as sending, and still keep the recipient list and the hourly limit.

Each [profile](profiles.md), such as `work`, has its own permissions. A permission key names a command or a group of
commands, such as `messages` or `messages.send`; a longer key is more specific. Its access level is `deny`,
`readonly`, `ask` or `allow`.

Start with reading, and allow changes only when you need them.

**On this page:**

1. Choose an access level
2. Allow one action
3. Questions in scripts
4. Restrict recipients and repeated sends
5. A temporary change for an MCP server
6. Limits and detailed rules

## Choose an access level

| Level | What happens |
|---|---|
| `deny` | The action is refused, including reading. |
| `readonly` | Reading works; changes are refused. |
| `ask` | A change asks first in the terminal. Over MCP it runs without asking. |
| `allow` | The action can run without another question. |

With no `permissions` set, everything is allowed, except deleting and a few other changes, which ask. A refusal
exits with code `5` and names the permission key. It does not mean the link to WhatsApp is broken. Do not ask an
agent to remove a restriction just to finish a task.

## Allow one action

```sh
wa work config set permissions.messages.send ask
```

Replace `work` with your profile. For a default that allows reading messages and refuses changes:

```sh
wa work config set permissions.messages readonly
```

More specific keys win: `permissions.messages.send ask` still permits sending. In the terminal it asks first. Over
MCP it does not ask, and the agent's send goes ahead. Set that key to `readonly` to refuse sends. Check other exceptions with
`wa work config show`.

This controls messages. Other actions have their own keys: `reactions` for reactions, `polls` for polls and votes,
`chats.mark-read` for read receipts. The other side sees all three, so give them the same care as sending.
`chats.mute` and `chats.unmute` cover `chats mute` and `chats unmute`, which nobody else sees; each key stands
alone. `messages.star` and `messages.unstar` cover starring a message, which nobody
else sees either. `chats.archive`, `chats.unarchive`, `chats.pin`, `chats.unpin` and `chats.mark-unread` cover the
commands of those names, which nobody else sees; each key stands alone, so `chats.archive readonly` still lets
`chats unarchive` through. `account.update` covers `account update`: other people can see the new name, about and photo.
`chats.delete` and `chats.clear` cover deleting a chat or its messages from your own devices; they ask by default,
since nothing brings the messages back.

## Questions in scripts

A write at the `ask` level asks in the terminal. With `--json`, `--no-input` or no terminal there is nobody to
answer, so the write is refused with exit code `7` unless you add `--yes`; a deletion needs `--allow-dangerous`.
These flags only answer the question. They never lift `deny` or `readonly`.

## Restrict recipients and repeated sends

A recipient list limits which chats the profile may send to. The first `recipients add` turns the list on; a send to
any other chat is then refused with exit code `7`:

```sh
wa work recipients add 100000000000001@lid
wa work recipients list
wa work recipients remove 100000000000001@lid
```

A chat added by its phone number (`…@s.whatsapp.net`) is saved under its LID when WhatsApp has already given one,
because a send to that number goes to the LID. An entry saved under the phone number earlier moves to the LID by
itself once this device knows the number's LID: when the store holds the chat under the number, the first command
that names it by the number moves the chat and the entry before it acts; otherwise the next `serve` or `watch` start
moves the entry. The number is never asked of WhatsApp for this. Until the entry moves, a send to the LID is refused
with exit code `7`, and the message names the id to add. `recipients remove` with the number takes the old entry
off.

Two changes to the list at the same time cannot undo each other. When another process holds the list for 5 s,
the change is refused with exit code `9` and the list stays as it was.

An hourly send limit, `sends_per_hour` (30 by default), helps stop a loop. `wa work sends list` shows every attempt
to send — sent, refused, failed or not known — without the text. These checks remain active when a command is
allowed ([limits](limits.md)).

## A temporary change for an MCP server

Add `--permission messages.send=readonly` to the server's start command to stop sending for that process. Saved
settings stay the same. `--permission` only narrows: one that would loosen the profile — `readonly` to `allow`, a
`deny` to anything — stops the server at startup with `validation_error` naming the key. To let an agent do more,
set the level in the profile itself. Over MCP, a change set to `ask` runs without asking you: nobody is at a terminal
to answer, and the server shows no form. Only the agent app may still ask, if you leave its write tool unapproved there. Use `deny` or `readonly` to refuse changes.
[The MCP server](mcp.md) and [the browser setup](remote.md) explain the full connection.

## Limits and detailed rules

An agent can only tighten these settings with `config set`: run over MCP or in its own shell (where
`AI_AGENT`, `CLAUDECODE` or `OPENCLAW_SHELL=exec` is set), it may only lower a level, and removing a permission accepts
only `deny`. You loosen them in your own terminal, outside the agent. An agent that can edit configuration files
directly or run unrestricted terminal commands may still be able to change them. Pin it to one profile with `WA_PROFILE_LOCK` ([profiles in linking](sessions.md#profiles)), and read
[security](security.md) before giving that access. Every setting is in the
[configuration reference](configuration-reference.md).
