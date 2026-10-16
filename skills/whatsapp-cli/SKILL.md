---
name: whatsapp-cli
description: >-
  Read or send messages in the owner's personal WhatsApp account through wa. Use when asked to find a WhatsApp chat
  or person, read a conversation, search messages, or send a message.
---

# wa — the owner's personal WhatsApp from the command line

`wa` works with the owner's **real personal account**, linked as a device the way WhatsApp Web is. A mistake here
does not fail a test; it writes to a living person. One call, one action: do it, print, exit.

Read this skill, then discover only the commands relevant to the task. **`wa commands messages --json`** describes
one group, with arguments, options and exit codes; `wa <command> --help` is shorter. `effects.remote: "write"`
marks a write to WhatsApp. `commands --json` connects to no account.

## What is different from Telegram and MAX

- **History comes from the phone, not from a server.** WhatsApp has no "give me old messages" request. The phone
  pushes history when the device links, and `wa <profile> serve` keeps receiving after that. Every read —
  `chats list`, `messages list`, `search` — answers from the local store and never connects.
- **Keep `serve` running.** A read with no `serve` behind it warns that the store may be stale. `wa <profile> server
  install` makes it a background service.
- **One connection per device.** While `serve` runs, nothing else may connect for the same profile; WhatsApp would
  drop the first connection.
- **Chats are named by WhatsApp ids.** A person is usually `…@lid` (WhatsApp's hidden id), a group `…@g.us`. Pass a
  chat by its name or its id.

## Profiles

Every account command names its profile first: `wa personal chats list`. No profile is assumed; without one the
command stops and lists the choices.

A profile that is not linked says so and names `wa <profile> session start`. Linking needs the owner's phone: offer
`wa <profile> session start --qr-file <png>` and pass the image on for the owner to scan; it is removed after the
login. Never ask for the phone number or a pairing code in chat.

## Machine execution

Use `--json --no-input` for headless work. In machine mode stdout carries exactly one JSON value; diagnostics go to
stderr. `--dry-run` checks syntax and permissions before a write without connecting.

MCP uses `wa_tools_search`, then `wa_read` or `wa_write` with `{command, arguments}`.

## Boundaries

- Never send to a number the owner has not written to before, and never in bulk: WhatsApp bans accounts for both.
- Reads never mark anything read.
- Message text appears only in the output of a command that asked for it — never in logs or errors.
