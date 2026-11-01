# Configuration reference

Use this page when you need the exact name, default or scope of a setting, or the name of an environment variable.
It lists every setting `wa` reads and which value wins.

No setting can hold a secret: the file has no field for the device keys, a phone number or a chat id.

## Which value wins

For each setting, the first of these that is set:

1. an option on the command line (`--limit 50`, `--record`, `--timeout 30s`)
2. an environment variable (`WA_PROFILE`, `WA_TIMEOUT`)
3. the profile's own entry in the config file
4. `defaults` in the config file, shared by every profile
5. the built-in default

`wa <profile> config show` prints each setting in force and where it came from.

## The file

`~/.config/whatsapp-cli/config.json`. No setting picks a profile: the first word (`wa work …`) or `WA_PROFILE` names
it. Without either, a command that uses an account stops with exit code `2` and lists the profiles on this computer.

| Setting | Default | What it does | Overridden for one run by |
|---|---|---|---|
| `limit` | `20` | rows per page of a list | `--limit` |
| `timeout_ms` | none | how long **one** request may wait, in milliseconds; for the whole command use `--timeout` | none |
| `color` | from the terminal | colour in the table view | none; with no setting, `NO_COLOR` turns it off |
| `sender_colors` | `false` | a colour per sender in the table view of messages | none |
| `search_catch_up` | `false` | prepare newly stored chats for local search: their graph and, where installed, their vectors | `--catch-up`, `--no-catch-up` |
| `picture_search` | `false` | search stored pictures by what they show, once the model is downloaded | none |
| `search_reranker` | `mmarco` | the model that reranks the first 50 hits of `search messages --discover`: `mmarco` (136 MB), `bge-reranker-v2-m3` (588 MB) or `off`. A reranker that is not downloaded is skipped, and discovery says so; `wa models download mmarco` downloads it | none |
| `record` | `true` | keep every run; `false` keeps failed runs only ([diagnostics](diagnostics.md)) | `--record`, `--no-record` (keeps nothing) |
| `record_input` | `true` | keep a run's command line as typed, secrets hidden; `failed` keeps it only in a run that failed; `false` writes `[redacted]` for every typed value that may be text ([diagnostics](diagnostics.md#what-you-typed)) | none |
| `keep_runs_for_days` | `30` | failed runs older than this are removed when the next run is kept | none |
| `keep_successful_runs_for_days` | `7` | runs that worked, older than this, are removed when the next run is kept | none |
| `runs_size_limit_mb` | `200` | the runs folder's size limit; past it, the oldest runs that worked are removed first | none |
| `permissions` | everything allowed, except deleting and a few other changes ask | what the profile may do, per command | none; `--yes` only answers `ask`, it never lifts `deny` |
| `sends_per_hour` | `30` | the most sends in any hour | none |
| `requests_per_minute` | the CLI's pace | requests a minute, shared by every process of the profile; `0` turns it off | `WA_REQUESTS_PER_MINUTE` |
| `transcribe_with` | `auto` | who turns voice into text: `auto`, `messenger` or `local` | `--local`, or `--model` |
| `speech_model` | none | which downloaded speech model `--local` uses | `--model` |
| `read_other_bots` | `false` | accept messages identified as coming from other bots; bot profiles only | none |
| `update_check` | `true` | the daily "a newer version exists" line; only under `defaults` | none; `WA_NO_UPDATE_CHECK`, `NO_UPDATE_NOTIFIER` or `CI` turn it off |
| `skill_hint` | `true` | a line, at most once a day, for an agent whose copy of the skill is missing or older; only under `defaults` | none |
| `embedding_provider` | `local` | local model or `openai` | `--embedding-provider` |
| `embedding_model` | provider default | embedding model | `--model` |
| `embedding_base_url` | provider default | embedding API endpoint | `--base-url` |
| `embedding_dims` | model default | integer 1–65,536 | `--dims` |
| `models` | none | external models by purpose | `WA_MODELS_*` variables |

The settings for search stemming, phone countries, tasks and account groups (`search_stemmers.*`, `phone_countries`,
`task_*`, `account_groups.*`) are listed under [`wa config set`](commands.md#wa-config-set).

The file is written `0600`, readable by you only, in a `0700` folder, and `config set` keeps it so. It holds no
secret. `wa doctor` names the file or its folder when other users can read it ([diagnostics](diagnostics.md#check-the-installation-wa-doctor)).

A setting the file does not know, a permission key that names no command, a value of the wrong type or a file that is
not valid JSON stops every command but `config` and `doctor`, with exit code `3`. The message names the first problem
and the `config unset` that removes it. `wa personal doctor` lists every problem in the file
([diagnostics](diagnostics.md#check-the-installation-wa-doctor)).

## A bot profile

A WhatsApp Business number on Meta's Cloud API (`wa <profile> bot …`) keeps its settings under `bot` in the file:
`wa <profile> config set --bot <setting> <value>`. They are ids from the App Dashboard's API setup page, not secrets;
the access token lives in the system keychain ([a WhatsApp Business number as a bot](bot.md)).

| Setting | Default | What it does | Overridden for one run by |
|---|---|---|---|
| `phone_number_id` | none | the business number every `bot` command speaks for | `--phone-number-id` on `bot api` commands |
| `waba_id` | none | the WhatsApp Business Account that holds the number's templates | `--waba-id` on `bot api` commands |
| `graph_version` | `v23.0` | the Graph API version in every request | none |

## Environment variables

| Variable | What it does |
|---|---|
| `WA_PROFILE` | the profile, when the first word does not name one |
| `WA_PROFILE_LOCK` | pins the process to one profile; any other is refused |
| `WA_TIMEOUT` | the same as `--timeout`: `500ms`, `30s` or `2m` for the whole command |
| `WA_REQUESTS_PER_MINUTE` | the same as `requests_per_minute`, and wins over it |
| `WA_CONFIG_DIR`, `WA_STATE_DIR`, `WA_CACHE_DIR` | move the three directories |
| `MESSAGING_STORE` | the path of the local store file |
| `WIRECAT_STATE_DIR` | the WireCat folder every CLI shares: the local store and the speech models |
| `WA_READ_ONLY` | `1` makes this process read-only: every change, linking and unlinking the device included, is refused |
| `WA_ENGINE` | the path of an engine program to run instead of the installed one |
| `WA_ENGINE_LOG` | where the engine appends its warnings, phone numbers masked; unset, the profile's provider log, which `doctor` counts (`provider_log`) |
| `WA_NO_UPDATE_CHECK` | `1` turns off the daily "a newer version exists" line |
| `NO_COLOR` | no colour in the table view |
| `WA_EMBEDDING_*`, `WA_MODELS_*` | model settings |
