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
- **One connection per device.** The owner's `wa <profile> serve` holds it. A scenario that connects needs `serve`
  stopped by the owner first and started again after; an agent never stops the owner's `serve`.
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
| C1 | a write while `serve` runs is refused and names it | with `serve` running, `messages send <Own> "<fixed text>" --dry-run`, then without `--dry-run` | nothing sent; exit code and holder recorded |
| C2 | `serve` and `watch` end, and see a write | `watch --events` in the background, a send to Own from the phone, stop by PID; then the same with `serve` | the message deleted for everyone |
| C3 | the store from live receipt | after C2, `messages list <Own>` and `search messages` find it; `--offline` reads | the owner's store only |

## Not run, and why

| What | Why |
|---|---|
| `session start`, `setup` on a new profile | links a new device to the owner's account; the owner runs it, and the result goes to `docs_ai` |
| `session end` | unlinks the owner's device and deletes its keys |
| anything in a chat other than Own | a real person's chat |
| a send to a number the owner has not written to | the pattern WhatsApp bans for |
