# Diagnostics: what a command did

Use this page when a command fails, hangs or takes too long, and you want to see why. By the end you can watch a
command's operations as they happen, keep a record of a run, check your installation and send a problem report that
holds no message text.

A few words this page uses:

- A **run** is one call of `wa`, from start to exit.
- A **run record** is a folder that keeps what one run did: its command, its outcome and one line per operation. It
  never holds message text, names or chat titles.
- **`wa personal doctor`** checks the installation: the version, the profile, the settings, the local store, and
  WhatsApp's own parts — the engine, the device keys and the lock.
- A **problem report** is one JSON file made from `wa personal doctor` and a failed run. You attach it to an issue.

## What you can do

| Task | Command | Keeps anything? |
|---|---|---|
| See each operation as it happens | `wa --trace …` | no, prints to stderr only |
| See the whole failure | `wa --debug …` | no, prints to stderr only |
| Keep a record of one run | `wa --record …` | yes, a run record |
| Find a failed run later | `wa personal runs list` | a failed run is kept by itself |
| Keep a record of every run | `wa personal config set record true` | yes, every run |
| Check the installation | `wa personal doctor`, `wa personal doctor --online` | no |
| Make a problem report | `wa personal doctor reports create` | yes, one file you send |

## Show it: `--trace` and `--debug`

```sh
wa personal --trace messages send 100000000000001@lid "test"
wa personal --debug chats mark-read 100000000000001@lid
```

`--trace` prints each operation on stderr as it happens: what was asked, what came back, with ids, counts, duration
and an error code if there was one. stdout does not change, so a pipe still gets only data. The engine's own log
stays off even then: it names WhatsApp ids, and a phone-number id is a phone number.

`--debug` replaces the one-line error with the failure's whole record — its cause and stack — on stderr.

## Keep it: `--record`

```sh
wa personal --record chats list
wa personal runs list              # recorded runs, newest first
wa personal runs show 20261001T080000Z-process-000001     # one run: its outcome, and one line per operation
wa personal runs path 20261001T080000Z-process-000001     # the folder that holds it
```

The run id above is made up; `runs list` shows the real ones.

A run record is a folder under `runs/<day>/` in the state folder. Its name is the time and the command. It holds two
files:

- `run.json` — the command, the profile, the version of `wa`, Node and the system, when it started and ended, the
  outcome and the error code;
- `events.jsonl` — the same operations `--trace` shows, one per line.

## A failed run is always kept

When a command ends in an error, its run is kept even without `--record`. `run.json` then has
`"keptBecauseFailed": true`. This holds for every command and every error: a bad option, an unknown command, a check
before any work, a refusal because another command holds the device. The record holds only the command's words, such
as `messages send`, never what followed them.

A run that worked leaves no record unless you ask for one, so a problem report always has a failure to attach.
`--no-record`, or `"record": false` in the settings, turns this off too.

Successful searches keep their own history, apart from run records: see
[search](search.md).

## When to record every run

```sh
wa personal config set record true          # this profile
wa personal --no-record chats list          # but not this one
```

By default a run that worked is not written until you ask. A messenger tool that keeps a folder of whom you read and
when would be a diary of your life that nobody asked for.

## How long it lives

**30 days**, or `keep_runs_for_days` in the settings. Old runs are removed only when a new one is kept, a whole day at
a time, by the folder's name, so nothing has to be opened to decide.

## What is never in a record

A run record and `--trace` carry an operation's name, ids, counts, durations and error codes. They never carry:

- the text of a message;
- a chat title or a person's name;
- **what you typed as `<chat>`**, because a typed chat is often a name;
- a phone number, a pairing code or the device keys.

The same is true for a report made from a run.

## Check the installation: `wa doctor`

```sh
wa personal doctor            # connects to nothing
wa personal doctor --online   # also connects once and reads the account; sends nothing
```

Besides the version, the runtime, the profile, the config file and the local store, `doctor` reads three things of
WhatsApp's from disk, without starting anything:

- **`engine`** — whether the engine program is there to start, and its path. When it is missing, the hint says what
  to do: reinstall `wa` with optional packages on, set `WA_ENGINE`, or in a source checkout run `pnpm engine:build`.
- **`device`** — whether the device keys exist, and whether `private.db`, its `-wal` and `-shm` files or their folder
  can be read by other users of this machine. Each such file comes with the `chmod` command that fixes it. `doctor`
  never opens the keys and never changes a file mode itself. Windows is not checked.
- **`lock`** — who last held the device's one connection (`serve (pid 4242)`), and whether that process still runs.
  The engine never clears the name, so a holder counts as running only while its process does.

`--online` connects once. While `serve` runs, it uses `serve`'s connection instead
([one connection per device](sessions.md#one-connection-per-device)).

## A problem report

```sh
wa personal doctor reports create              # about the newest failed run
wa personal doctor reports create --run 20261001T080000Z-process-000001   # a made-up run id
```

It writes a JSON file — what `wa personal doctor` shows plus the run — and says where to send it: a new issue at
[github.com/WireCatLabs/whatsapp-cli/issues](https://github.com/WireCatLabs/whatsapp-cli/issues/new). Read it before
you send it. It holds no message text. `wa doctor reports show` alone shows what a report would hold and writes nothing.

If no failed run is kept, run the failing command again; its failure is kept by itself.

## What to do with runs

The records are JSON, so `jq` answers questions about them. `wa personal runs list --json` answers
`{ items, page, meta }`, and `items` are the runs' `run.json`, newest first:

```sh
wa personal runs list --limit 100 --json | jq '[.items[] | select(.status == "failed") | {command, error_code}]'
wa personal runs list --limit 100 --json | jq '[.items[] | .duration_ms] | add / length'
```

## Search errors and partial runs

```sh
wa personal search runs error_code:authentication_error --json
wa personal search runs status:partial 'started_at>=2026-10-01' --json
```

`search runs` matches literal diagnostic text in the records. Query terms such as `operation:messages.download`,
`profile:work`, `error_code:timeout`, `status:failed` and `started_at:` comparisons/ranges narrow it, alongside `--limit` and `--page`; each page holds up to 100 runs. It reads only the records and never connects.

## Next

- [What an error means and what to do](troubleshooting.md)
- [What reaches the disk at all](security.md)
