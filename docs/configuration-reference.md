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

`~/.config/whatsapp-cli/config.json`. `default_profile` at the top names the profile used when neither the first
word nor `WA_PROFILE` names one. Without any of them, a command that uses an account stops with exit code `2` and
lists the profiles on this computer.

| Setting | Default | What it does | Overridden for one run by |
|---|---|---|---|
| `limit` | `20` | rows per page of a list | `--limit` |
| `timeout_ms` | none | how long **one** request may wait, in milliseconds; for the whole command use `--timeout` | none |
| `color` | from the terminal | colour in the table view | none; with no setting, `NO_COLOR` turns it off |
| `sender_colors` | `false` | a colour per sender in the table view of messages | none |
| `catch_up_marks_read` | `false` | `inbox` and `review` mark each chat they show read. The other side sees it | `--mark-read`, `--no-mark-read` |
| `search_catch_up` | `false` | prepare newly stored chats for local search: their graph and, where installed, their vectors | `--catch-up`, `--no-catch-up` |
| `picture_search` | `false` | search stored pictures by what they show, once the model is downloaded | none |
| `record` | `false` | keep every run | `--record`, `--no-record` |
| `keep_runs_for_days` | `30` | recorded runs older than this are removed when the next one is kept | none |
| `permissions` | everything allowed, except deleting and a few other changes ask; reply rules may not send | what the profile may do, per command | none; `--yes` only answers `ask`, it never lifts `deny` |
| `sends_per_hour` | `30` | the most sends in any hour | none |
| `requests_per_minute` | the CLI's pace | requests a minute, shared by every process of the profile; `0` turns it off | `WA_REQUESTS_PER_MINUTE` |
| `transcribe_with` | `auto` | who turns voice into text: `auto`, `messenger` or `local` | `--local`, or `--model` |
| `speech_model` | none | which downloaded speech model `--local` uses | `--model` |
| `read_other_bots` | `false` | for bot profiles; `wa` has none yet | none |
| `update_check` | `true` | the daily "a newer version exists" line; only under `defaults` | none; `WA_NO_UPDATE_CHECK`, `NO_UPDATE_NOTIFIER` or `CI` turn it off |
| `skill_hint` | `true` | a line, at most once a day, for an agent whose copy of the skill is missing or older; only under `defaults` | none |
| `embedding_provider` | `local` | local model or `openai` | `--provider` |
| `embedding_model` | provider default | embedding model | `--model` |
| `embedding_base_url` | provider default | embedding API endpoint | `--base-url` |
| `embedding_dims` | model default | integer 1–65,536 | `--dims` |
| `analysis_provider` | `agent` | `agent`, `openai` or `anthropic` | `build --provider` |
| `analysis_model` | none | analysis model | `build --model` |
| `analysis_base_url` | provider default | analysis API endpoint | `build --base-url` |
| `models` | none | external models by purpose | `WA_MODELS_*` variables |

The file is written `0600` when first created. It holds no secret.

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
| `WA_NO_UPDATE_CHECK` | `1` turns off the daily "a newer version exists" line |
| `NO_COLOR` | no colour in the table view |
| `WA_EMBEDDING_*`, `WA_ANALYSIS_*`, `WA_MODELS_*` | model settings |
