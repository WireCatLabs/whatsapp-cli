# Live scenarios

What a person checks on the real WhatsApp before a change ships. The suite never contacts WhatsApp
([TESTING.md](TESTING.md)), so these are the other half, run by hand. The `test-live` skill picks the ones a change
touches. They are also how [BACKLOG.md](BACKLOG.md) item 1, the live checks of the engine on the owner's number, gets
done. The rules for running them are shared with tg-cli and max-cli: cli-core's
[RELEASING.md, "Live checks"](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/RELEASING.md#live-checks).

**Nothing on this page names a real chat, person, number or id.** This repository is public. The scenarios name
roles. The owner's profile name, ids and the dated results live in `docs_ai/live-cast.md` of the main checkout,
which is the private repository and never part of this one.

## The rules on WhatsApp

- **Sends go only to the owner's own chat**, the chat with the account's own LID (`…@lid`). No other chat is
  written to, not even a group the owner runs. WhatsApp bans accounts for messages to strangers and for bulk sends,
  so a live check never risks either.
- **The device is the main install's.** A worktree's `bin/wa` keeps its own `.wa/` folder with no device, and no
  worktree links one: a second linked device is a change to the owner's account. Live checks run the owner's
  installed `wa` against the owner's profile, by the owner or with the owner's yes for that run.
- **One connection per device.** The owner's `wa <profile> serve` holds it, and a command that connects goes
  through it (C1). W and C2 need `serve` stopped by the owner first and started again after; an agent never stops
  the owner's `serve`.
- **Read receipts only with the owner's yes.** `chats mark-read` and `--mark-read` tell the other side; in the own
  chat they tell no one, so that is where they run.
- **Record the shape, never the content**: exit codes, one JSON value on stdout, stderr empty or one diagnostic, the
  keys and the item counts.

## The cast, by role

| Role | What it is | May a scenario write there? |
|---|---|---|
| **Own** | the chat with the owner's own account, by its LID | yes: messages it sends itself, deleted for everyone after |
| **Store** | the owner's local store, filled by `serve` | read only |

Only these. Never a real person's chat, not even to read it for a check.

## Scenarios

Every command runs with `--json` and a timeout.

### R — reads (no connection)

| Id | What | Commands | Puts back |
|---|---|---|---|
| R1 | reads answer from the store and exit, beside a running `serve` | `chats list --limit 3`, `messages list <Own> --limit 2`, `inbox`, `search messages`, `store status` | nothing changed |
| R2 | `doctor` reads the engine, the keys' modes and the lock | `doctor`; with `serve` running, `lock.running` is `true` and names `serve` | nothing changed |

### W — writes in the own chat (`serve` stopped)

| Id | What | Commands | Puts back |
|---|---|---|---|
| W1 | a send and its id | `messages send <Own> "<fixed test text>"`; the answer's message id | deleted for everyone in W4 |
| W2 | an edit within 20 minutes | `messages edit <Own> <id> "<fixed text>"` | deleted in W4 |
| W3 | a reaction on and off | `reactions add <Own> <id> 👍`, `reactions remove <Own> <id>` | removed |
| W4 | delete for everyone | `messages delete <Own> <id> --for-everyone` | gone |
| W5 | a read receipt, only with the yes | `chats mark-read <Own>` | cannot be unread; harmless in the own chat |
| W6 | delete for the owner only | a second send to Own, then `messages delete <Own> <id>`; the phone no longer shows it | gone from the owner's devices |
| W7 | a star on and off | `messages star <Own> <id>`; the phone shows the star; `messages unstar <Own> <id>` | unstarred |

### C — the one connection

| Id | What | Commands | Puts back |
|---|---|---|---|
| C1 | a write while `serve` runs goes through `serve` | with `serve` running, `messages send <Own> "<fixed text>"`; then `messages list <Own> --limit 1` has it, and `doctor` still shows `lock.running` naming `serve` | the message deleted for everyone |
| C2 | `serve` and `watch` end, and see a write | `watch --events` in the background, a send to Own from the phone, stop by PID; then the same with `serve` | the message deleted for everyone |
| C3 | the store from live receipt | after C2, `messages list <Own>` and `search messages` find it; `--offline` reads | the owner's store only |

### H — older history from the phone (WhatsApp open on the phone)

Record counts and yes/no only. The engine's log line per `ON_DEMAND` batch carries exactly that: how it was matched
(`session`, `session-other-chat`, `chat`, `late`, `none`), how many messages, the chunk and progress, and whether the
notification's `PeerDataRequestSessionID` and `OriginalMessageID` are the id of the request waiting at that moment. `session-other-chat` would
also say the phone answered the LID chat under another id, such as its phone number.

| Id | What | Commands | Puts back |
|---|---|---|---|
| H1 | one 50-message page comes as one `ON_DEMAND` notification or several, and the notification names the request by its id | with `WA_ENGINE_LOG` set to a file kept like `private.db`, `messages sync <Own> --limit 50 --no-catch-up` on an Own chat with more than 50 older messages on the phone; count the log's `on-demand history` lines for the one page, note each line's match and its two yes/no values (script: `bin/live-older-history`) | nothing: the store keeps the page; the log file is deleted after |

## Scripts the owner runs

Five checks need a person at the phone, so they are scripts in `bin/`. Only the owner runs them, from a terminal;
an agent never does (`WC-TEST-18`). Each takes the profile as its one argument and never picks one: without it, or
with a name that is not there, it stops and lists the profiles `account list` knows (`WC-ACCT-3`). Each runs the
main checkout's `bin/wa`, the one whose `serve` holds the device, with `--json`, `--no-input` and a `--timeout`
(`WC-LIFE-5`). Three calls differ: the restarted `serve` runs without a timeout, and `live-fresh-link` runs
`session start` without `--no-input`, since it draws the QR code on the terminal, and through `node` with a
throwaway store (below). The script asks before each step and passes `--yes` only after that. It prints exit
codes, counts and yes or no: never a message's text, an id or a phone number (`WC-SECR-1`). A failed `wa` call
shows only its command words, exit code and error code, since cli-core's JSON error names the chat and message it
was about (`WC-SECR-6`); `session start` is the exception, as its QR code is on the same stream. A closed terminal,
Ctrl-C or Ctrl-\ ends a script through its `EXIT` trap. The shared helpers are in `bin/lib/live.sh`.

| Script | Covers | What it changes | How it is put back |
|---|---|---|---|
| `bin/live-oneshot-drop <profile>` | [BACKLOG](BACKLOG.md) item 9: does a one-shot connection take a queued message that then never reaches the store? | stops `serve`; two messages from the phone to the own chat | starts `serve` again on every exit path; the owner deletes the two messages from the phone |
| `bin/live-poll-vote <profile>` | BACKLOG item 5, a vote cast by `wa`; W-style, own chat only | a poll and a vote in the own chat, through the running `serve` | the poll is deleted for everyone at the end; if the script stops early, it says to delete it from the phone |
| `bin/live-older-history <profile>` | H1: one 50-message page as one `ON_DEMAND` notification or several, and whether it names the request by its id | restarts `serve` with the engine's log on; one history request from this device to the own phone | starts `serve` again as it was on every exit path; deletes the log |
| `bin/live-fresh-link <new-profile>` | BACKLOG item 1, a fresh `session start` keeping the history push | links a second device to the owner's account, after the owner types `yes` | not undone by the script: `bin/wa <new-profile> session end`, or the phone's Linked devices screen |
| `bin/live-chat-state <profile>` | BACKLOG item 5, the chat-state writes: privacy read back, mute, message pin, star (W7), chat pin, archive, mark-unread and mark-read, delete for the owner alone (W6); own chat only | a 1-hour mute of the own chat, a marker message pinned for 24 hours and starred, the own chat pinned, archived and marked unread, through the running `serve` | each undone in the script; the marker deleted for the owner (or for everyone where that is not built); if it stops early, it says what to undo from the phone |

**`live-oneshot-drop`**, step by step:

1. It reads the device lock with `doctor` (no connection). The lock names the Go engine's PID. It checks that the
   engine runs with `--holder serve`, and that the engine's parent is exactly `node <main>/dist/bin/wa.js
   <profile> serve`. Otherwise it stops nothing: a `serve` started another way cannot be started again the same
   way.
2. It counts a fresh marker word in the store (`search messages --offline`, and the own chat's newest 50 with
   `messages list me --offline`). Both must be 0.
3. After the owner's Enter it reads the lock again, and stops nothing if it changed. It stops `serve` with
   `kill <pid>` and waits until both processes are gone and the lock is free.
4. The owner sends the marker word to the own chat from the phone, while no device of this profile is connected,
   so WhatsApp queues it.
5. One one-shot connection: `doctor --online`, which connects and sends nothing (`WC-LIFE-1`).
6. It waits for the lock to be free, then starts `serve` again from the main checkout with
   `setsid nohup bin/wa <profile> serve`, stdin and stdout on `/dev/null`, and its diagnostics where the stopped
   `serve` had them (the file or terminal behind its stderr; `/dev/null` for a pipe). It waits until `doctor`
   shows the lock held by `serve` (`WC-LIFE-11`). The `EXIT` trap does the same on any earlier exit once `serve`
   was stopped.
7. The owner sends a control word while `serve` runs. Both words are counted again.

The last lines give the verdict:

| `doctor --online` | Marker | Control | Verdict |
|---|---|---|---|
| exit 0 | missing | found | BACKLOG item 9 holds: the one-shot took the queued message and it never reached the store |
| exit 0 | found | found | not dropped this time; item 9 is not cleared, as `doctor --online` may end before WhatsApp delivers the queue |
| exit 0 | either | missing | no verdict: `serve` is not saving messages at all |
| other | any | any | no verdict: the one-shot may never have connected; also when a store read failed |

`serve` is started in its own session (`setsid`, where there is one), so a Ctrl-C at a later prompt does not stop
it; the last line says whether `serve` holds the lock. A one-shot `messages send` stays connected longer than
`doctor --online`, so a found marker leaves the send case open. The marker is sent
before the one-shot connects, not during it, because `doctor --online` ends too fast for a person to send in
time; a queued message is the case item 9 worries about. While `serve` is stopped, other people's messages are in
the same position, and that is said before step 3.

**`live-poll-vote`** needs `serve` running, so its writes go through it and no one-shot connection takes the
device. It reads the own chat's id from `account list` (it must be in LID form) and never prints it. Then:
`polls create` with a question carrying a fresh run number and the answers `yes` and `no`; `polls show` for the
answer ids; `polls vote` for `yes`; `polls show` again after 10 s; `messages delete --for-everyone`. It prints the
votes per answer and whether the owner's vote is the chosen one, from the vote's answer and from the store.

**`live-older-history`** restarts `serve`, because the engine reads `WA_ENGINE_LOG` only when it starts. It finds
and checks `serve` as `live-oneshot-drop` does (the helpers are shared in `bin/lib/live.sh`), and stops nothing when
`serve` already runs with `WA_ENGINE_LOG` set. Then:

1. It creates the log file beside the device keys (the folder of `doctor`'s device path), mode 600, under a fresh
   run number.
2. After the owner's Enter it stops `serve` by its PID and starts it again the same way, with `WA_ENGINE_LOG` set
   to that file, and waits until `serve` holds the lock.
3. After a second Enter, `messages sync <Own> --limit 50 --no-catch-up` goes through `serve`: one page, which the
   engine asks the phone for with a peer message from this device to the own phone. It prints the exit code and
   `fetched`.
4. It waits 30 s for later notifications and reads the log. Then it stops the logging `serve` (only if the lock
   names the PID it started) and starts `serve` as it was, without the log. The `EXIT` trap does the same on any
   earlier exit. Signals are ignored while it puts `serve` back, so a second Ctrl-C cannot leave it half done. The
   result below is printed even when this fails.
5. It prints the log's `on-demand history` lines in order, one row each, then the totals: answers, how many of them
   were credited to the waiting ask (`session` or `chat`), messages credited, the count per match, both yes/no values
   as logged, and how many lines carry a session id equal to one of the request ids this device sent (`session`,
   `session-other-chat` and `late`). The logged yes/no compares only with the ask waiting at that moment, so a
   `late` line logs `false` although its session id is an earlier request's: one already answered (a second
   notification for it) or one that stopped waiting. Several notifications means a `late` or `none` line. Chunk order
   and progress are printed as the phone sent them, without a verdict, since their base is not known. No line at all
   is no verdict: the store may already hold the chat's start, or the phone was offline.
6. The `EXIT` trap deletes the log.

**`live-fresh-link`** refuses a profile that `account list` shows or that has device keys. It says plainly that it
links a second device and goes on only after `yes`. It runs `session start qr --timeout 15m`; the QR code shows on
the terminal. The device keys go to the main checkout's `.wa/state`, like any profile there. The pushed history
goes to a throwaway store, removed at the end, because the store keys an account by its WhatsApp id and not by its
profile: the push would otherwise land in the owner's store. It prints `already_linked` and the history counts
(chats, messages, people). On every exit, Ctrl-C included, it removes the throwaway store and, while the new
profile has device keys, says how to unlink it.

**`live-chat-state`** needs `serve` running, and works in the own chat only, by its LID id from `account list`,
never printed. After each step it asks the owner what the phone shows and records yes or no:

1. `account privacy show`, read only. It prints each setting that came back with its value (`everyone`,
   `contacts`, `true`, `false`: no person's data) and the phone screen to compare it with, under Settings >
   Privacy.
2. `chats mute --until 1h`, then `chats unmute`: muted on the phone, then not.
3. `messages send` of a marker with a fresh run number, `messages pin --expire-time 24h` on it, then
   `messages unpin`. 24 hours is the shortest pin, so a pin left by a stopped script ends by itself.
4. `messages star` on the marker, then `messages unstar`, scenario W7: the star on the phone, then not.
5. `chats pin` on the own chat, then `chats unpin`: at the top of the chat list with the pin icon, then not. It
   asks first, and leaves the step out (`kept`) when the own chat is pinned already, whose pin the unpin would take
   off, or when three chats are.
6. `chats archive`, then `chats unarchive`: in Archived, then back in the chat list. It comes after the chat pin,
   since whatsmeow's archive patch also unpins the chat.
7. `chats mark-unread`, then `chats mark-read`: the unread dot in the chat list, then whether it stays; the owner
   does not open the chat, which would clear the dot by itself. `wa` sends a read receipt
   only for someone else's message and the own chat has none, so `mark-read` sends nothing there.
8. `messages delete` of the marker without `--for-everyone`, scenario W6: gone from the owner's devices.

A step whose command the build lacks is skipped with "not built in this checkout yet". `chats mute`, `chats unmute`,
`account privacy show`, `messages star` and `unstar`, `chats pin` and `unpin`, `chats archive` and `unarchive`,
`chats mark-unread`, and the `--expire-time` option of `messages pin` are looked up in `commands`. `messages pin`
and `messages delete` are listed in every build, so the script reads their refusal: cli-core's "this messenger
cannot pin a message", or wa's delete that is only for everyone so far, both exit 2 before anything is sent. Without delete for the owner, it deletes the marker
for everyone (W4) after an Enter. On a failure it prints the exit code and the error's code, never its message,
which can quote the chat. It ends with a table of step, answer (yes, no, failed or skipped) and the BACKLOG item 5
line a yes settles:

| Step | Settles, when yes |
|---|---|
| privacy show | "Live checks of `account privacy`", the `show` half; a match of `calls` says whether `calladd` `known` is the phone's "silence unknown callers" |
| mute, unmute | "Live checks of `chats mute`": a one-to-one chat addressed by its LID. How soon the settings keys arrive after a fresh link stays open |
| pin, unpin | "Message pins": the pin and unpin in the own chat. A group addressed by phone numbers stays open |
| star, unstar | "Live check of starring": the owner's own message in the own chat (W7). Someone else's message, in a group or a one-to-one chat, stays open |
| chats pin, unpin, archive, unarchive, mark-unread | "Live checks of `chats archive`, `unarchive`, `pin`, `unpin` and `mark-unread`": a one-to-one chat addressed by its LID. A fourth pinned chat, pinning an archived chat, and an archived chat that a newer message brings back stay open |
| mark-read | "`chats mark-read` after a `mark-unread`", for the own chat only. A no is expected: without the read patch, `wa` cannot undo a mark-unread there. Whether a receipt in a chat with someone else clears it stays open |
| delete for you only | "Live check of delete for the owner alone": the owner's own message. Someone else's message in a group, a one-to-one chat with another person, and the saved files stay open |

Left out on purpose: each changes what other people see, or destroys history, so the owner checks it by hand if
wanted.

- `account update` changes the name everyone sees. By hand: `bin/wa <profile> account update --first-name
  "<the same first name>"`, and the phone's profile screen shows it.
- `chats delete` and `chats clear` destroy the own chat's history on the owner's devices. By hand, only on a chat
  the owner can lose: `bin/wa <profile> chats clear <chat>`, and the phone shows it empty.
- `account privacy set` changes who can reach the owner. By hand: set one setting to the value `privacy show`
  printed (`bin/wa <profile> account privacy set --calls contacts`), so nothing changes, and see the phone agree.

## Not run, and why

| What | Why |
|---|---|
| `session start`, `setup` on a new profile | links a new device to the owner's account; only the owner runs it, through `bin/live-fresh-link`, and the result goes to `docs_ai` |
| `session end` | unlinks the owner's device and deletes its keys |
| anything in a chat other than Own | a real person's chat |
| a send to a number the owner has not written to | the pattern WhatsApp bans for |
