# Permissions

Use this page before you let an AI agent, a script or another person work with your WhatsApp account through `wa`.
It shows how to decide, for each profile, what may only be read, what asks you first, and what may go ahead without
a question. By the end you can make a profile read-only, allow one action such as sending, and know which other
checks still apply.

Words this page uses:

- **Profile**: a named set of settings for one linked account, such as `work` ([profiles](profiles.md)).
- **Permission key**: the name of a command or a group of commands, such as `messages` or `messages.send`. A longer
  key is more specific.
- **Access level**: what happens when that command runs: `deny`, `readonly`, `ask` or `allow`.

Start with reading, and allow changes only when you need them.

## Choose an access level

| Level | What happens |
|---|---|
| `deny` | The action is refused, including reading. |
| `readonly` | Reading works; changes are refused. |
| `ask` | A change asks in the terminal. |
| `allow` | The action can run without another question. |

With no `permissions` set, everything is allowed, except deleting and a few other changes, which ask. A refusal
exits with code `5` and names the permission key. It does not mean the link to WhatsApp is broken. Do not ask an
assistant to remove a restriction just to finish a task.

## Allow one action

```sh
wa work config set permissions.messages.send ask
```

Replace `work` with your profile. For a default that allows reading messages and refuses changes:

```sh
wa work config set permissions.messages readonly
```

More specific keys win: `permissions.messages.send ask` still permits sending, with a question in the terminal and
without a server form over MCP. Set that key to `readonly` to refuse sends. Check other exceptions with
`wa work config show`.

This controls messages. Other actions have their own keys: `reactions` for reactions, `chats.mark-read` for read
receipts. The other side sees both, so give them the same care as sending.

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

An hourly send limit, `sends_per_hour` (30 by default), helps stop a loop. `wa work sends list` shows every attempt
to send — sent, refused, failed or not known — without the text. These checks remain active when a command is
allowed ([limits](limits.md)).

## A temporary change for an MCP server

Add `--permission messages.send=allow` to the server's start command to allow sending for that process. Saved
settings stay the same. Over MCP, `ask` does not require a server form: the app controls its own approvals and may
allow a call without asking again. Use `deny` or `readonly` to refuse changes. [The MCP server](mcp.md) and
[the browser setup](remote.md) explain the full connection.

## Limits and detailed rules

An assistant that can edit configuration files or run unrestricted terminal commands may be able to change these
settings. Pin it to one profile with `WA_PROFILE_LOCK` ([profiles in linking](sessions.md#profiles)), and read
[security](security.md) before giving that access. Every setting is in the
[configuration reference](configuration-reference.md).
