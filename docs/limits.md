# Limits and waits

Use this page when a command waits, stops with a rate-limit error, or is refused because another `wa` command holds
the account. It explains how fast `wa` talks to WhatsApp, why it sometimes waits, and what to do when it stops. By
the end you will know which waits are normal, how to change the pace, and when to try again.

Words this page uses:

- **Pace**: how many requests a profile may send to WhatsApp per minute. `wa` keeps every profile under it.
- **Send limit**: how many messages a profile may send in any hour.
- **The device's one connection**: WhatsApp allows one connection for each linked device; `wa` lets one command at
  a time hold it.

WhatsApp bans accounts that send in bulk or write to strangers. These limits are there to keep a script or an agent
far from that.

## One connection per device

Only one `wa` command at a time may connect a profile. `serve`, `watch`, the MCP server while it holds a connection,
and every one-shot write take the device's lock first. Another command for the same profile is refused at once,
and the error names the holder:

```text
this WhatsApp login is in use by serve (pid 4242)
```

This is not a wait: `wa` does not queue the second command. Stop the holder, or wait for it to finish, and run the
command again. `serve` is the exception: while it runs, a send, an edit or a reaction for the same profile runs
inside `serve`, on its connection, and is not refused. On Windows it is refused. Reads answer from the
local store and never connect, so they work beside it
([one connection per device](sessions.md#one-connection-per-device)).

## The pace

Every request `wa` makes for a profile — from a command, `wa personal mcp` or `wa personal serve` — takes a turn in
one pace for that profile. The turns are kept under the state folder, so two terminals line up behind each other
instead of each going at full speed. Different profiles have their own pace each.

A command that has to wait more than 5 seconds for its turn says so on stderr. A turn more than 5 minutes away is
refused at once with exit code `8` (`rate_limited`).

Change the pace in the config file, or for one shell with an environment variable:

```json
{ "defaults": { "requests_per_minute": 30 } }
```

```sh
WA_REQUESTS_PER_MINUTE=30 wa personal messages send 100000000000001@lid "on my way"
```

`0` turns the pace off. Do that only for a profile you can afford to have limited.

## Writes

- **30 sends an hour** per profile by default (`sends_per_hour`), counted across processes. One more is refused
  with exit code `8`; `wa personal sends list` shows what was sent.
- **A recipient list**, when it is on, refuses a send to any other chat with exit code `7`
  ([permissions](permissions.md#restrict-recipients-and-repeated-sends)).
- **A banned or restricted account** holds every write with exit code `5`, reactions and read receipts too: until the
  ban ends, when WhatsApp says when (the error names the time), otherwise until it is lifted, by
  `wa personal doctor --online` connecting again or by `wa personal flood clear`; see the phone. Reads from the local
  store still work.
- **When WhatsApp asks the account to slow down**, every write is held for 15 minutes (exit code `8`, then `5` while
  the hold lasts). Reads go on. `inbox` and `review` with `--mark-read` still show what they read and say that
  nothing was marked read. `wa personal flood clear` lifts a hold once you know it is over.
- **A poll** has 2 to 12 answers, each with its own text; it counts as a send.
- **A pin** counts as a send: WhatsApp tells the chat's members about every one. An unpin does not count, but a hold
  stops it too.
- A send that may or may not have arrived (exit code `14`) is never repeated by `wa`. Check `wa personal sends list`
  and the chat before you send again ([how wa behaves in scripts](cli-contract.md#previews-and-safe-retries)).

## No bulk reads

WhatsApp keeps no history on its servers, so `wa` has no history download to pace. The phone pushes your recent
history once, right after linking, and `serve` keeps receiving after that ([the local store](archive.md)). Every read
and search answers from the local store and sends WhatsApp nothing. Older messages can only be asked of the phone, 50
at a time, with at least 2 seconds between requests, by `messages sync <chat>`
([how](archive.md#older-history-from-your-phone)).
