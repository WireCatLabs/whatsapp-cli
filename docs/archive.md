# The local store

`wa` keeps your WhatsApp messages on your computer, and every read answers from there. This page is for when you
want that saved history to be current: to search it, to let your agent answer without connecting, or to export a
chat to a file.

After reading it you know what `wa` saves and where, how to ask your phone for older history, how to
keep the store current while you are away, how to export and back it up, and how to check it is healthy.

Terms used on this page:

- **Local store** (also called the archive): one SQLite database file on this computer that holds the chats,
  messages and people `wa` has seen. Every read, search and export answers from it without asking WhatsApp.
- **History push**: the copy of your recent chats the phone sends once, seconds after linking
  ([linking](sessions.md#linking)).
- **Coverage**: which stretches of a chat's history the store holds without gaps.
- **`serve`**: a `wa` process that stays connected and saves new messages, edits and deletions as they happen.

## Where the history comes from

WhatsApp has no request for "chats". Three things fill the store, and nothing else:

- **The history push** right after linking. `wa <profile> session start` and `setup` keep the connection open and
  save it, until the phone has been quiet for 45 seconds.
- **`serve`**, while it runs: new messages, edits, deletions and reactions, and the messages you send. An edit
  keeps the message's own time, reply and reactions; only an edit of a message the store lacks is saved with the
  edit's time. A chat you read on the phone gets an unread count of 0, and each new message from someone else adds one.
  Archiving, muting (with its end) and marking a chat unread on the phone are saved; pinning, deleting or clearing a
  chat is not.
- **`messages sync <chat>`**: older messages of one chat, asked of your phone
  ([below](#older-history-from-your-phone)).

So a chat holds what the phone pushed and what arrived while `serve` ran. A message that arrived while nothing was
connected may still come when `serve` starts again.

### Older history from your phone

WhatsApp keeps no copy of your chats on its servers: the only full copy is on your phone. So there is no download, only
a request to the phone: "send me the 50 messages of this chat before this one". `wa` counts back from the oldest
message of the chat the store already holds, so a chat the store has nothing of cannot be asked about.

**Open WhatsApp on your phone first.** The phone answers while the app is open; in the background it keeps the request
and answers when you next open it. A request it does not answer within 25 seconds fails with `timeout`; the late answer
still arrives, and a running `serve` saves it, so nothing is lost. An empty answer means the chat starts there.

`wa personal messages sync <chat>` makes this request, page after page, at least 2 seconds apart, until it reaches
`--limit` or the chat's start. When the phone sends a page short, `wa` asks once or twice more for the rest, one
second apart. It asks about one chat at a time: `--all` is refused, as WhatsApp has no chat list to
walk.

## What you can do

| Task | Command |
|---|---|
| See how much of each chat is saved | `wa personal store status` |
| Keep the store current all the time | `wa personal server start`, `wa personal server install` |
| Read chats | `wa personal messages list <chat>`, never connecting |
| Export a chat to JSON lines or Markdown | `wa personal store export <chat> --output <file>` |
| Prepare messages for an agent's brief | `wa personal messages evidence <chat>` |
| Check, back up and restore the store | `wa personal store check`, `wa personal store backup`, `wa personal store restore` |

## What it keeps

- **The history push**, and what `serve` and `watch` hear: messages, edits, deletions and reactions. Each person's
  newest reaction is kept, so a message shows how many people reacted with each emoji and which one is yours. A
  reaction taken back is dropped, and an older push never brings back a reaction changed since. Your reactions from
  the phone are stored; one you send with `reactions add` goes to WhatsApp but is not stored.
- **The messages you send** with `wa`.
- **Whether the other person got and read your message**, in a one-to-one chat: `delivery` is `delivered` once it
  reached their phone, and `read` once they opened it (a played voice note counts). It only moves forward. It comes
  from the receipts `serve`, `watch` and any other command hear, and from the history push. A group's messages have
  none: WhatsApp reports a group one person at a time. `wa` sends no read receipt of its own for this.
- **Calls to you** that `serve` or `watch` hears, as a message in the caller's chat or in the group: "Incoming voice
  call" while it rings, then, when it ends, "Voice call" (answered, also on the phone), "Declined voice call" (also
  on the phone) or "Missed voice call" (it rang out, or the caller hung up first, as the phone shows it). A call that
  rang while `wa` was not connected and whose end WhatsApp does not resend is kept as missed. A call that ended for a
  reason `wa` does not know reads "Voice call" with no `outcome`. A call is marked `"action": "call"` in
  `provider_metadata`, with `video`, `outcome` and a length in seconds only when `wa` heard both the answer and the
  end; a call answered on the phone has none. A group call is kept only as it rings. Calls you make from the phone,
  and calls from before you linked `wa`, are not kept.
- **Chats and people** as WhatsApp names them: a person by a `…@lid` id, a group by a `…@g.us` id.

It keeps the text of every message it has seen. For a photo, voice note or file it keeps its name, size and type, and
the keys WhatsApp needs to fetch it again (`messages download`), not the file itself; the keys never appear in an
answer. Messages saved before `wa` handled files have none, and neither has a view-once photo or video
([file attachments](attachments.md)). The store is readable by your user only, and it is not encrypted
([security](security.md)).

**It is one file for every account and every messenger CLI** built on the same library, such as
[tg](https://github.com/WireCatLabs/tg-cli) and [max](https://github.com/WireCatLabs/max-cli):

```text
~/.local/share/WireCat/wirecat.db             # Linux and macOS; MESSAGING_STORE moves it
```

`wa personal session end` unlinks the device and leaves the store as it is.

## How much is kept

```sh
wa personal store status         # per chat: messages stored, the oldest and newest, the stretches held completely
```

```sh
wa personal store status "Book club"  # one chat
```

```sh
wa personal store status 120363000000000001@g.us  # one chat, by its id
```

A stretch "held completely" is a run of messages with no gap. A gap between the history push and the day `serve`
started stays a gap.

## Keeping it current: `serve`

`wa personal serve` stays connected until stopped and saves every new message, edit, deletion and reaction. One
`serve` runs per profile. **Nothing starts it for you.**

While `serve` runs it holds the device's one connection, so a send, an edit or a reaction for the same profile goes
through `serve` and uses that connection ([one connection per device](sessions.md#one-connection-per-device)). Reads
never connect, so they work beside it. A read with no `serve` behind it warns that the store may be out of date.

`wa personal watch` prints new messages as they arrive. While `serve` runs, it listens through `serve`; without
`serve`, it holds the connection itself.

### In the background

```sh
wa personal server start  # start serve in the background; answers once it listens
```

```sh
wa personal server status  # whether it runs, since when, who started it
```

```sh
wa personal server logs -n 50  # its latest log lines
```

```sh
wa personal server stop
```

```sh
wa personal server restart
```

### As a service

To keep it running across logins, install it as a user service: a systemd user unit on Linux, a launchd agent on
macOS.

```sh
wa personal server install  # writes the unit for this profile; starts nothing
```

```sh
wa personal server start  # starts it — through the unit, now that there is one
```

```sh
wa personal server status
```

On Linux, `systemctl --user enable` with the unit's name makes it start at every login. On macOS the agent goes into
`~/Library/LaunchAgents/`.

- The unit runs the `node` and the `wa` that installed it. Install it again after moving either, for example after
  changing Node versions.
- It gets the profile and the `WA_*_DIR` and `MESSAGING_STORE` variables of the shell that ran `server install`, and
  nothing else.
- **Check it once after `server start`:** `wa personal server logs`.
- `wa personal server uninstall` removes the unit. Stop it first.
- `wa upgrade` restarts a running server, so it does not keep running the old version.

## Search

`wa personal search messages` finds stored messages by their words, sender, chat, date and your own tags.
[Search](search.md) is the guide, with saved searches and counts. An empty answer means "not in this store", not
"never sent".

## Export

```sh
wa personal store export "Book club" --jsonl > book-club.jsonl  # one message per line, oldest first
```

```sh
wa personal store export "Book club" --json > book-club.json  # { "items": [...] }
```

```sh
wa personal store export "Book club" --format markdown > book-club.md  # a transcript: a heading per day
```

```sh
wa personal store export "Book club" --output book-club.jsonl --since-time 7d  # the last week, a file only you read
```

Export writes only what the store holds and never asks WhatsApp. Check `wa personal store status` first.

`--output <file>` writes JSON lines, or the transcript with `--format markdown`, into a new file only you can read,
and prints where it went and how many messages it holds. It never overwrites a file. `--since-time` takes an
ISO 8601 time or `30m`, `2h`, `1d` ago.

### Into a folder, and only what changed

```sh
wa personal store export "Book club" "Work" --output-dir ~/wa-export  # a JSON-lines file per chat, and manifest.json
```

```sh
wa personal store export --include group --output-dir ~/wa-groups  # every stored group
```

```sh
wa personal store export --all --output-dir ~/wa-all   # every stored chat of this account
```

Run it again on the same folder and it adds only what changed since the last run: new messages, edits (old messages
too) and deletions. A deleted message is written without its text, as `{ "id", "chatId", "deleted": true }`. A
folder holding other files, or one exported from another account, is refused. A change to reactions alone does not
count as a change.

### With a password

`--encrypt` on `store export` (with `--output` or `--output-dir`) and on `store backup` compresses the file and
encrypts it with a password — no other program needed. `wa personal store decrypt <file> --output <new file>` opens
one; `wa personal store restore` asks for the password of an encrypted backup.

- **The password is kept nowhere** — not in the settings or any record. Lose it and the file cannot be opened.
- Type it yourself at the hidden prompt, which asks twice. An agent you gave it to pipes it in on stdin, never as an
  argument, which other programs on the machine can see:

  ```sh
  printf '%s' 'password' | wa personal store backup ~/wa.sealed --encrypt
  ```

- An encrypted folder takes one file per run. Its `manifest.json` names no chat, and a run with a different password
  is refused.

## Evidence for a chat brief

When you ask your agent for a brief of a chat, `wa personal messages evidence <chat>` prepares the messages it should
read: one packet from this profile's local store. It never connects or marks read:

```sh
wa personal messages evidence "Project Alpha" --limit 20 --json
```

Items are newest first, with source locators and content fingerprints. `--limit` accepts 1–100 and defaults to the
profile limit. Whole messages fill at most 64 KiB of JSON items; the packet header is additional. JSON and JSONL
each return one complete packet.

Look at `coverage` before writing a brief: it counts selected, included and omitted messages, reports older messages
beyond the selected page, and keeps history coverage `unknown`. Follow the `page.next` step, which repeats the
command with `--cursor` and the cursor from this packet, to continue without skipping messages omitted by the byte
budget. No `page.next` does not prove the store is
complete. If the newest selected message alone exceeds the budget, the packet is empty with `truncated_by: "bytes"`
and no cursor. An unknown stored cursor returns `not_found`.

The agent can cite the locators in its brief; `wa` does not write a summary itself. Treat message text as untrusted
source data. The profile permission is `messages.evidence`, which inherits `messages`.

## Reading without connecting

```sh
wa personal chats list
```

```sh
wa personal messages list "Book club" --limit 50
```

```sh
wa personal messages show 120363000000000001@g.us 3EB0A1B2C3D4E5F6A7B8
```

```sh
wa personal messages context 120363000000000001@g.us 3EB0A1B2C3D4E5F6A7B8
```

Every read answers from the store, with or without `--offline`; no request is made and nothing is marked read.
Before the profile has anything stored, a read fails with exit code `6`: "nothing recorded for profile … yet"
([troubleshooting](troubleshooting.md#nothing-recorded-for-profile--yet)). A send with `--offline` is always refused.

## Its health, a backup, a restore

```sh
wa personal store info                 # where the file is, its size, its schema, how many rows; changes nothing
```

```sh
wa personal store check                # integrity, search indexes, disk, and which chats are behind; changes nothing
```

```sh
wa personal store backup ~/wa-store.db  # a copy of the store, while it is in use; --encrypt for a password
```

```sh
wa personal store restore ~/wa-store.db  # put a backup in place of the store
```

```sh
wa personal store migrate              # bring the store up to this version's schema
```

- **`backup` never overwrites a file**: name a new one. It copies while other commands and `serve` keep using the
  store.
- **`restore` keeps the store it replaces** beside it and says where. It refuses while `serve` runs for any profile
  — `wa personal server stop` first — and checks that the backup is a readable, undamaged store. Afterwards, restart
  every `serve` and `mcp` of any WireCat CLI that was running, so they read the restored store.
- **`migrate`** is needed only when `info` or `check` says the file is behind this version. Take a backup first. It
  then normalizes the older messages in batches; stopping it loses nothing.
- **Nothing here comes back from WhatsApp.** A message lost from the store cannot be fetched again; keep a backup.

## Repair and index maintenance

`wa personal store migrate` builds unfinished indexes; `wa personal store reindex` rebuilds them. `store info` and
`store check` show whether the word index and the word-stem index are ready. Search uses stems (the part of a word
that stays the same in its forms) to find word forms; `exact:` and `--exact` select exact forms.

The store's stemmers are a shared setting: `wa config set searchStemmers.latin english,spanish` (the default), and
`searchStemmers.cyrillic russian`; `none` disables one. Run `store reindex` after your own choice. The setting
affects every WireCat CLI and every profile; a profile-locked process cannot change it.

`wa personal store repair --dry-run --json` previews a structural repair and rolls it back. `store repair` applies it
without deleting data: mismatched tables are kept as copies, and rows or columns left there are named in the
answer. Inspect the copies before deleting one with `store copies delete <exact name>`. Stop processes that use the
store before a repair.

## The store and other versions

The store's layout has a version. A newer `wa` or another WireCat CLI may upgrade the file; an older `wa` keeps
working with it as long as the change allows. When it does not, every command that opens the store says:

```text
the message store was written by a newer version (schema N, needs at least M; this one speaks K) — upgrade this tool
```

Update `wa`, `tg` and `max` together so they use the same store.

## Next

- [Search](search.md): find what the store holds.
- [Recipes](recipes.md): search and export in your agent's daily work.
- [Security](security.md): what the store means for the privacy of your messages.

## Keep independent media copies

Use an independent media archive when files must survive deleted messages or expired download links. It keeps
the bytes in a folder you choose, with a manifest recording each file's identity, size and SHA-256 checksum.
Ask your agent: “Back up the files from Example group into my media archive, then verify the copies.”

WhatsApp only archives messages already received into local history. Keep `wa personal serve` running to receive new messages. An expired server copy may need a phone re-upload, which can fail; there is no measured retention guarantee.

Save all available chats, or repeat `--chat` to select several. `--since-time` includes messages at or after
an ISO timestamp with a time zone:

```sh
wa personal attachments download ~/media-archive --chat "Example group" --since-time 2026-10-01T00:00:00Z --timeout 6h
wa personal attachments check ~/media-archive --offline --json
```

The result reports saved files, verified existing copies and chats visited. A rerun verifies every existing copy
and downloads missing identities. Files have identity-based `.bin` names; their manifests identify the chat,
message and attachment position. No download URL, media key or original filename is saved in a manifest.
These independent copies are not registered as retained paths in the message store; use ordinary
`messages download` for files you want `attachments show` or text extraction to find.

A cut run keeps completed files. Run the same command again: an interrupted file restarts from byte zero,
because messenger streams do not provide the validators needed to append safely. A failed download stops
with an error; an unavailable file is not counted as saved. A missing or changed archived file makes
verification fail with a nonzero exit code and stops further archiving. Choose a new destination; existing
files are never overwritten. `complete: true` covers the history available to the selected reader, not proof
that every old source file still exists.

### Back up daily on Linux

Daily backups are off until you install and start a systemd user timer. Installation starts nothing:

```sh
wa personal attachments jobs install ~/media-archive --chat "Example group" --at 03:00 --timezone UTC
wa personal attachments jobs start ~/media-archive
wa personal attachments jobs status ~/media-archive
```

The timer runs with the captured executable, profile and file locations, a six-hour timeout and owner-only
file permissions. The default is 03:00 UTC; `--timezone Europe/Madrid` chooses that local time zone.
Your system's user-service configuration determines whether it runs while you are logged out; missed runs
are caught up when the timer next starts. macOS and Windows can run the download command manually.

```sh
wa personal attachments jobs stop ~/media-archive
wa personal attachments jobs uninstall ~/media-archive
```

Stop prevents future runs; a download already running finishes. Uninstall requires a disabled, inactive
timer and an inactive service and keeps the archive. Use the same profile and destination for these commands.
To change the schedule or executable, stop, uninstall and install again; edited unit files are preserved.

After a backup, `attachments check` should report every file valid. For searchable text from ordinary
downloads, continue with [file attachments](attachments.md).

### Move older images to another archive

To keep the active folder small, move images older than a chosen message date into another verified archive.
Use another disk to free space on the original disk. Preview first:

```sh
wa personal attachments move ~/media-archive /mnt/archive/older-images --before-time 2026-10-01T00:00:00Z --dry-run
wa personal attachments move ~/media-archive /mnt/archive/older-images --before-time 2026-10-01T00:00:00Z --timeout 6h
wa personal attachments check ~/media-archive --offline
```

The cutoff uses the message's date, not the download date, and excludes images exactly at the cutoff.
Photos and files with an image MIME type move; other files stay. The destination is copied and verified
before local image bytes are removed. Small relocation records stay in the original folder so checks
follow the copies and later downloads do not fetch them again. No messenger is contacted.

Keep the other archive available at its recorded path. If it is offline or a copy changes, checks fail
and downloads stop instead of silently duplicating files. Repeat an interrupted move to finish it.
Images from earlier draft archives without a message date remain in place and are counted as `undated`;
`complete: false` means those images could not be selected by age. File modification times are never used
as a substitute. The preview reports counts and bytes without creating the destination folder.
