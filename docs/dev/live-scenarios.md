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

### C — the one connection

| Id | What | Commands | Puts back |
|---|---|---|---|
| C1 | a write while `serve` runs goes through `serve` | with `serve` running, `messages send <Own> "<fixed text>"`; then `messages list <Own> --limit 1` has it, and `doctor` still shows `lock.running` naming `serve` | the message deleted for everyone |
| C2 | `serve` and `watch` end, and see a write | `watch --events` in the background, a send to Own from the phone, stop by PID; then the same with `serve` | the message deleted for everyone |
| C3 | the store from live receipt | after C2, `messages list <Own>` and `search messages` find it; `--offline` reads | the owner's store only |

## Scripts the owner runs

Three checks need a person at the phone, so they are scripts in `bin/`. Only the owner runs them, from a terminal;
an agent never does (`WC-TEST-18`). Each takes the profile as its one argument and never picks one: without it, or
with a name that is not there, it stops and lists the profiles `account list` knows (`WC-ACCT-3`). Each runs the
main checkout's `bin/wa`, the one whose `serve` holds the device, with `--json`, `--no-input` and a `--timeout`
(`WC-LIFE-5`). Three calls differ: the restarted `serve` runs without a timeout, and `live-fresh-link` runs
`session start` without `--no-input`, since it draws the QR code on the terminal, and through `node` with a
throwaway store (below). The script asks before each step and passes `--yes` only after that. It prints exit
codes, counts and yes or no: never a message's text, an id or a phone number (`WC-SECR-1`). The shared helpers are
in `bin/lib/live.sh`.

| Script | Covers | What it changes | How it is put back |
|---|---|---|---|
| `bin/live-oneshot-drop <profile>` | [BACKLOG](BACKLOG.md) item 9: does a one-shot connection take a queued message that then never reaches the store? | stops `serve`; two messages from the phone to the own chat | starts `serve` again on every exit path; the owner deletes the two messages from the phone |
| `bin/live-poll-vote <profile>` | BACKLOG item 5, a vote cast by `wa`; W-style, own chat only | a poll and a vote in the own chat, through the running `serve` | the poll is deleted for everyone at the end; if the script stops early, it says to delete it from the phone |
| `bin/live-fresh-link <new-profile>` | BACKLOG item 1, a fresh `session start` keeping the history push | links a second device to the owner's account, after the owner types `yes` | not undone by the script: `bin/wa <new-profile> session end`, or the phone's Linked devices screen |

**`live-oneshot-drop`**, step by step:

1. It reads the device lock with `doctor` (no connection). The lock names the Go engine's PID. It checks that the
   engine runs with `--holder serve`, and that the engine's parent is exactly `node <main>/dist/bin/wa.js
   <profile> serve`. Otherwise it stops nothing: a `serve` started another way cannot be started again the same
   way.
2. It counts a fresh marker word in the store (`search messages --offline`, and the own chat's newest 50 with
   `messages list me --offline`). Both must be 0.
3. It stops `serve` with `kill <pid>` and waits until both processes are gone and the lock is free.
4. The owner sends the marker word to the own chat from the phone, while no device of this profile is connected,
   so WhatsApp queues it.
5. One one-shot connection: `doctor --online`, which connects and sends nothing (`WC-LIFE-1`).
6. It starts `serve` again with `setsid nohup bin/wa <profile> serve`, stdin and stdout on `/dev/null`, its diagnostics in
   `<main>/.wa/serve.log`, and waits until `doctor` shows the lock held by `serve` (`WC-LIFE-11`). The `EXIT`
   trap does the same on any earlier exit, Ctrl-C included, once `serve` was stopped.
7. The owner sends a control word while `serve` runs. Both words are counted again.

A control found and a marker missing means the one-shot took the message: BACKLOG item 9 holds. A marker found
does not clear item 9: `doctor --online` may end before WhatsApp delivers the queue, and a one-shot `messages send`
stays connected longer. `serve` is started in its own session (`setsid`, where there is one), so a Ctrl-C at a
later prompt does not stop it; the last line says whether `serve` holds the lock. The marker is sent
before the one-shot connects, not during it, because `doctor --online` ends too fast for a person to send in
time; a queued message is the case item 9 worries about. While `serve` is stopped, other people's messages are in
the same position, and that is said before step 3.

**`live-poll-vote`** needs `serve` running, so its writes go through it and no one-shot connection takes the
device. It reads the own chat's id from `account list` (it must be in LID form) and never prints it. Then:
`polls create` with a question carrying a fresh run number and the answers `yes` and `no`; `polls show` for the
answer ids; `polls vote` for `yes`; `polls show` again after 10 s; `messages delete --for-everyone`. It prints the
votes per answer and whether the owner's vote is the chosen one, from the vote's answer and from the store.

**`live-fresh-link`** refuses a profile that `account list` shows or that has device keys. It says plainly that it
links a second device and goes on only after `yes`. It runs `session start qr --timeout 15m`; the QR code shows on
the terminal. The device keys go to the main checkout's `.wa/state`, like any profile there. The pushed history
goes to a throwaway store, removed at the end, because the store keys an account by its WhatsApp id and not by its
profile: the push would otherwise land in the owner's store. It prints `already_linked` and the history counts
(chats, messages, people), and how to unlink.

**`live-delete-for-me`** is not written yet: it waits until wa can delete a message for the owner only
(`messages delete` without `--for-everyone`).

## Not run, and why

| What | Why |
|---|---|
| `session start`, `setup` on a new profile | links a new device to the owner's account; only the owner runs it, through `bin/live-fresh-link`, and the result goes to `docs_ai` |
| `session end` | unlinks the owner's device and deletes its keys |
| anything in a chat other than Own | a real person's chat |
| a send to a number the owner has not written to | the pattern WhatsApp bans for |
