# Diagnostics: what a command did

Use this page when a command fails, hangs or takes too long, and you want to see why. By the end you can watch a
command's operations as they happen, keep a record of a run, check your installation and send a problem report that
holds no message text.

A few words this page uses:

- A **run** is one call of `wa`, from start to exit.
- A **run record** is a folder that keeps what one run did: its command line, its outcome and one line per operation.
  Those lines never hold message text, names or chat titles. What it keeps of the command line you typed is under
  [What you typed](#what-you-typed).
- **`wa personal doctor`** checks the installation: the version, the profile, the settings, the local store, and
  WhatsApp's own parts — the engine, the device keys and the lock.
- A **problem report** is one JSON file made from `wa personal doctor` and a failed run. You attach it to an issue.

## What you can do

| Task | Command | Keeps anything? |
|---|---|---|
| See each operation as it happens | `wa --trace …` | no, prints to stderr only |
| See the whole failure | `wa --debug …` | no, prints to stderr only |
| Find a run later | `wa personal runs list` | every run is kept by itself |
| Keep one run out | `wa personal --no-record …` | nothing |
| Keep only failed runs | `wa personal config set record false` | failed runs |
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
- `events.jsonl` — the same operations `--trace` shows, one per line. Under each operation are the requests it made,
  marked `"level": "wire"`: to the WhatsApp engine (`"transport": "wa-engine"`, the engine's request name such as
  `send` or `older`), or to Meta's Graph API for `bot` commands (`"transport": "http"`, the method and the path with
  ids as `:id`). Each has its duration, outcome and error code. An engine request keeps a message's id when it has
  one and never a chat's: a chat id holds a phone number. A media download keeps no address at all.

## Every run is kept

Every run is kept without `--record`, a run that worked too. A failed run is kept for every command and every error:
a bad option, an unknown command, a check before any work, a refusal because another command holds the device. What the record keeps of the command line is
under [What you typed](#what-you-typed); a run whose settings did not load hides every typed value that may be text.

Every run is recorded, the ones that worked too, so a problem report always has the run to attach.
`--no-record` keeps nothing for one run; `"record": false` in the settings keeps failed runs only.

Successful searches keep their own history, apart from run records: see
[search](search.md).

## When to keep only failed runs

```sh
wa personal config set record false         # profile "personal": failed runs only
wa personal --no-record chats list          # this run: nothing at all
```

A run that worked holds the ids of the chats you read and, with `record_input` on, what you typed (a message you
sent, a chat named by its title). It is kept only on this computer, readable only by you, for 7 days. Set `record`
to `false` if you would rather not keep it at all.

## How long it lives

A run that worked lives **7 days** (`keep_successful_runs_for_days`), a failed one **30 days** (`keep_runs_for_days`).
The runs folder also stays under **200 MB** (`runs_size_limit_mb`): past it, the oldest runs that worked go first.
Old runs are removed only when a new one is kept, a whole day at a time, by the folder's name, so nothing has to be
opened to decide.

## What is never in a record

A run's events and `--trace` carry an operation's name, ids, counts, durations and error codes. They never carry:

- the text of a message;
- a chat title or a person's name;
- a phone number, a pairing code or the device keys.

### What you typed

`run.json` also keeps the command line. What it keeps depends on your version of `wa`:

- **A version that lists `record_input` in `wa personal config show`** keeps the command line as you typed it — a
  chat's name, a search, message text — so you can read back what you ran. A secret is always `[redacted]`: the value
  of an option named for a token, password, passphrase, secret, credential, cookie, authorization or API key; a
  password inside a URL; a long string that looks like a token. To hide every typed value that may be text again:

  ```sh
  wa personal config set record_input false
  ```

- **An older version** keeps the command's words and option names, such as `messages send --md`. Every value that may
  be text, such as what you typed as `<chat>`, is `[redacted]`.

A problem report made from a run hides those typed values in every version.

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

**`config.issues`** lists every problem in the config file: invalid JSON (with the line and column where reading
stopped), a setting or a permission key `wa` does not know, a value of the wrong type. Each says what the value has to
be, never the value itself. All but invalid JSON come with the `config unset` command that removes them (`fix`).
`doctor` still answers, with exit code `0`.

**`files`** names each private file or folder that other users of this machine can read: the config file (it wants
`0600`) and its folder (`0700`), the store with its `-wal` and `-shm` files, the send journal and the runs folder. Each
problem is `{ path, mode, want }`, and stderr prints the `chmod` that fixes it: `to make it private: chmod 600
'<path>'`. With no profile named, or when the settings are refused, `files` checks the config file and its folder only.
`doctor` never changes a file mode itself. Windows is not checked.

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
