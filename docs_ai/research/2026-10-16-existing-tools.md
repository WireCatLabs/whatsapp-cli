# WhatsApp CLI: existing tools, and should we base ours on openclaw/wacli?

Research date 2026-10-16. Code read at openclaw/wacli commit `7a06c827e2304d03a815c2d88f8b634aca9f7eb1` (2026-10-15).
Permalink base used below: `W = https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1`.
Tags: **[code]** = I read it in source. **[docs]** = only the repo docs/README say so. **[api]** = from `gh api`.

## Short answer

wacli is the strongest existing tool by far. It is MIT, very active, and already covers most of what `tg` does
(local SQLite store with full-text search, JSON output, a change feed, send through a running sync daemon).
Wrapping it as a subprocess from a TS adapter works for **read, search, send, edit, react, polls, chat state**.
It is **weak for two adapter features**: live updates (only a best-effort webhook) and history backfill while the
daemon runs (the command fails on the store lock). It has **no MCP server** and **no send allowlist**.
The verdict table at the end maps each adapter capability.

## 1. openclaw/wacli deep dive

### 1.1 Project health [api]

| Fact | Value | Source |
|---|---|---|
| Repo | `steipete/wacli` redirects to `openclaw/wacli` | https://github.com/openclaw/wacli |
| Language / license | Go, MIT | [LICENSE](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/LICENSE) |
| Stars / forks | 2814 / 370 | `gh api repos/openclaw/wacli` |
| Created / last push | 2025-12-12 / 2026-10-15 | same |
| Releases | 25 tags from v0.8.0 (2026-05-06) to v0.21.0 (2026-10-11); 8 releases in the last 6 weeks | https://github.com/openclaw/wacli/releases |
| Contributors | 62 unique commit authors overall; last 3 months: Peter Steinberger 89 commits, next is 11, README's "current maintainer" dinakars777 has 2 | `git log` on the clone |
| Protocol library | whatsmeow `v0.0.0-20261007…` (pinned 8 days before HEAD) | [go.mod](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/go.mod) |
| Packaging | Prebuilt archives linux/darwin/windows, Homebrew tap, Docker; cgo required | [README](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/README.md), [.goreleaser.yaml](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/.goreleaser.yaml) |
| Open issues | 6 open issues (+ PRs = 10) | https://github.com/openclaw/wacli/issues |

Release binaries are built with FTS5: the release script refuses a binary without `-tags sqlite_fts5`
**[code]** ([scripts/release-common.mjs:386](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/scripts/release-common.mjs#L386)).

Bus factor: one person writes most of the code, even though the README names a different maintainer.

### 1.2 Commands [code]

From the cobra `Use:` strings in `cmd/wacli/*.go`:

- `auth` (+ `status`, `logout`), `accounts list|add|use|show|remove`
- `sync` (`--once`/`--follow`, `--events`, `--webhook`, `--send-spacing`, `--max-messages`, `--max-db-size`, `--download-media`, `--presence-mode quiet`)
- `history coverage|fill --dry-run|backfill`
- `messages list|search|show|context|export|starred|changes|edit|forward|delete|revoke|purge`
- `send text|file|sticker|voice|location|react|poll|select|status`, `poll vote|show`, `polls list`
- `chats list|show|mark-read|mark-unread|archive|pin|mute (+ inverses)|cleanup`
- `contacts search|show|refresh|resolve|check|import-system|alias|tags`
- `groups list|info|rename|participants|invite|join|leave|prune|admin…`, `channels list|info|join|leave`
- `media download|retry|backfill`, `calls list`, `presence subscribe|typing|paused`, `profile …`
- `store stats|cleanup`, `doctor`, `docs`, `version`

Global flags: `--store`, `--account`, `--json`, `--events`, `--timeout` (5m), `--lock-wait`, `--read-only` /
`WACLI_READONLY=1` **[code]** ([root.go:71-78](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/root.go#L71-L78)).

### 1.3 JSON output contract

- Envelope `{"success":bool,"data":…,"error":string|null}`, one line on stdout **[code]**
  ([internal/out/out.go:9-25](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/out/out.go#L9-L25)).
- On failure with `--json`, the error envelope goes to **stderr**, and the process exits 1 **[code]**
  ([root.go:117](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/root.go#L117), [main.go:16-18](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/main.go#L16-L18)). A wrapper must read stderr on non-zero exit.
- `--events` writes NDJSON `{"event","data","ts"}` to stderr for `auth`, `sync`, `history backfill` **[code]**
  ([internal/out/events.go:17-21](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/out/events.go#L17-L21)).
- **Field naming is inconsistent.** `store.Message` has untagged fields that serialize as `ChatJID`, `MsgID`,
  `Timestamp`, `FromMe`, `Text`, next to tagged snake_case `quoted_msg_id`, `deleted_at` **[code]**
  ([internal/store/types.go:72-104](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/store/types.go#L72-L104)). `Chat` is all snake_case
  ([types.go:12-20](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/store/types.go#L12-L20)). Webhook payloads are PascalCase **[docs]** ([docs/sync.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/docs/sync.md)).
- No schema version in the envelope. The CHANGELOG shows additive JSON changes and care to keep shapes
  ("preserving public chat JSON fields", #255), but no written stability promise **[docs]** ([CHANGELOG.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/CHANGELOG.md)).
  The docs say direct SQLite "schema can evolve between releases" **[docs]** ([docs/integrations.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/docs/integrations.md)).

Verdict: machine-readable, practically stable, but not a versioned contract. Pin the wacli version in our adapter
and keep contract tests on its output.

### 1.4 Store schema [code]

- Two SQLite files per store: `session.db` (owned by whatsmeow, keys) and `wacli.db` (owned by wacli) **[docs]**.
- `wacli.db` tables: `chats` (with `unread`, `unread_count`, `archived`, `pinned`, `muted_until`), `contacts`,
  `groups`, `group_participants`, `contact_aliases`, `contact_tags`, `messages`, `message_receipts`,
  `message_payload_purges`, `message_local_media_aliases`, `status_messages`, `call_events`, `starred`, `polls`,
  `poll_votes`, `message_locations` ([internal/store/schema.sql](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/store/schema.sql)), plus
  app-state recovery tables and `schema_migrations` ([internal/store/migrations.go](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/store/migrations.go)).
- `messages` keyed `UNIQUE(chat_jid, msg_id)`, soft delete (`deleted_at`, `deletion_reason`), edits (`edited`, `edited_ts`),
  reactions as rows (`reaction_to_id`, `reaction_emoji`), media metadata including `media_key`
  ([schema.sql:58-101](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/store/schema.sql#L58-L101)).
- FTS5 table `messages_fts(text, media_caption, filename, chat_name, sender_name, display_text)` kept by triggers;
  default tokenizer (no trigram, no stemming); falls back to `LIKE` if FTS5 is missing
  ([migrations.go:930-960](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/store/migrations.go#L930-L960)).
- **Change feed**: `message_changes(sequence, operation upsert|delete|identity_move, chat_jid, msg_id, …)`
  ([internal/store/changes.go:37](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/store/changes.go#L37)), exposed as
  `messages changes --since CHECKPOINT` with `next_checkpoint`, `has_more`, `store_id` **[docs]** ([docs/messages.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/docs/messages.md)).
  This is the best hook for a TS adapter.

### 1.5 History

- Initial history comes in the pairing handshake. `auth` supports `--history-days`, `--history-max-per-chat`,
  `--full-history`, `--history-size-mb`; the phone decides what it sends; a full sync can pause for hours **[docs]** ([docs/auth.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/docs/auth.md)).
- `events.HistorySync` is handled in sync: blobs are downloaded manually and each conversation is parsed with
  `ParseWebMessage` and stored **[code]** ([internal/app/sync_events.go:126](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/app/sync_events.go#L126),
  [:714-760](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/app/sync_events.go#L714-L760)).
- On-demand backfill: `history backfill --chat JID --count ≤500 --requests ≤100` anchors on the oldest local
  message and calls `RequestHistorySyncOnDemand` **[code]** ([internal/app/backfill.go:164](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/app/backfill.go#L164)).
  It retries with the other identity (LID vs phone) because the phone answers some chats only by one of them (#444) **[docs]**.
- **Backfill takes the store lock and is not delegated**, so it fails while `sync --follow` runs **[code]**
  ([cmd/wacli/history.go:149](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/history.go#L149)).

### 1.6 One connection per device: how one-shot commands coexist with `sync`

- Each store has a `LOCK` file with `flock`; a second writer gets `store is locked (another wacli is running?)`
  **[code]** ([internal/lock/lock.go:22-52](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/lock/lock.go#L22-L52)). `--lock-wait` polls every 100 ms.
- Read commands (`messages`, `chats list`, `contacts search`, `doctor`) do not need the lock and read SQLite in WAL mode.
- `sync --follow` opens a Unix socket `<store>/.send.sock` (mode 0600). Locked write commands send one JSON
  request over it (protocol version 1) **[code]** ([cmd/wacli/send_ipc.go:23-24](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/send_ipc.go#L23-L24),
  [:111-164](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/send_ipc.go#L111-L164), [:186-232](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/send_ipc.go#L186-L232)).
  The daemon runs them one at a time, with optional random spacing, and refuses requests whose caller deadline passed.
- Delegated (from `tryDelegateSend` callers): `send text|file|sticker|voice|location|react|poll|select`, `poll vote`,
  `messages edit`, `presence`, `chats` state, `contacts check`, `media download` **[code]**.
- **Not delegated, so they fail while sync runs**: `history backfill`, `send status`, `messages delete|revoke|forward|purge`,
  group admin/rename/invite/participants, `profile`, `channels`, `chats cleanup` **[code]** (they call
  `newApp(ctx, flags, true, …)` without delegation, e.g. [messages_delete.go:42](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/messages_delete.go#L42),
  [send_status_cmd.go:71](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/send_status_cmd.go#L71)).

### 1.7 Live updates

- `--events` NDJSON carries lifecycle, warnings, typing, presence, receipts, history progress; **not message
  content** **[code]** (event names collected from `emitEvent` calls in `internal/app`).
- Message content leaves the daemon only by `--webhook URL` (HMAC signed), for **live** messages, receipts and typing.
  Best-effort: no retry, drops when the queue is full **[docs]** ([docs/sync.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/docs/sync.md)), enqueued only from
  the live message path, not from history sync **[code]** ([sync_events.go:599-627](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/app/sync_events.go#L599-L627)).
- So a subprocess adapter needs: a localhost webhook receiver for low latency, plus `messages changes` polling to
  catch edits, deletes, history batches and dropped webhooks.

### 1.8 Auth

QR in terminal, `--qr-format text` for raw payload, `--phone` pairing code; with `--events` QR and pair codes are
NDJSON events **[docs]** ([docs/auth.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/docs/auth.md)); `qr_code`/`pair_code` events exist **[code]**.
Passkey-gated linking is not supported **[docs]**. Device label/platform can be set by `WACLI_DEVICE_LABEL`,
`WACLI_DEVICE_PLATFORM` **[code]** ([main.go:21-30](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/main.go#L21-L30)).

### 1.9 Send guardrails

- Present: `--read-only` mode; self-send refused without `--allow-self`; stderr warning when sends are under 5 s apart
  **[code]** ([send_helpers.go:21](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/send_helpers.go#L21), [:134](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/cmd/wacli/send_helpers.go#L134));
  daemon `--send-spacing 500ms-5s`; no blind retry after an uncertain send; `store_warning` instead of a resend **[docs]** ([docs/send.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/docs/send.md)).
- Missing: recipient allowlist, confirmation step, dry-run for send. Ambiguous names prompt in a TTY and need
  `--pick N` in scripts **[docs]**. I found no allowlist/confirm code in `cmd/wacli/send*.go` **[code]**.

### 1.10 LID handling [code]

Store identity is phone-number JIDs. LIDs are mapped with whatsmeow's `ResolveLIDToPN`
([internal/app/jid.go:20-22](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/app/jid.go#L20-L22), [internal/wa/contacts.go:80](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/wa/contacts.go#L80)).
On sync start, older LID rows are moved to the phone JID across chats, messages, receipts, polls, locations
([internal/app/lid_migration.go](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/app/lid_migration.go), [internal/store/lid_migration.go](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/store/lid_migration.go),
called at [sync.go:202](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/app/sync.go#L202)). Unknown LIDs stay as LIDs. The change feed emits `identity_move`.

### 1.11 MCP

None. The docs tell you to write an external MCP that runs `wacli --read-only --json …` with an allowlist
**[docs]** ([docs/integrations.md](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/docs/integrations.md)); no MCP code in `cmd/` or `internal/` **[code]** (grep).

### 1.12 Bans and disconnects in issues

No open issue about bans. Search: https://github.com/openclaw/wacli/issues?q=ban
Closed ones relevant to stability: #290 sync silently stops ingesting (fixed), #268 stale connection, #279
"Client outdated (405)", #30 "Can't link new device", #355 passkey linking, #53 no send rate limit (closed),
#444 LID backfill unanswered. Open data-quality risk: **#365 group history 0% searchable after fresh sync**
(https://github.com/openclaw/wacli/issues/365).

### 1.13 Account selection risk

Without `--account`/`--store`, wacli uses `default_account` from `config.yaml` or the default store dir **[code]**
([internal/config/config.go:189](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/config/config.go#L189), `DefaultAccount` at [:28](https://github.com/openclaw/wacli/blob/7a06c827e2304d03a815c2d88f8b634aca9f7eb1/internal/config/config.go#L28)). Our rule forbids picking an account
implicitly, so the adapter must always pass `--account` or `--store`.

## 2. Wrapping wacli from a TS adapter

Design: one `wacli sync --follow --events --webhook http://127.0.0.1:PORT --webhook-secret …` child per account,
supervised by our process; every other call is `execFile("wacli", ["--account", A, "--json", …])` with no shell.

| Adapter capability | wacli surface | Status |
|---|---|---|
| chats (list, unread) | `chats list --json` / read-only SQLite | Covered |
| history read + search | `messages list|search|context --json`, FTS5 | Covered (FTS default tokenizer; #365) |
| send text/media | delegated `send …` | Covered (no allowlist: we add it) |
| edit | delegated `messages edit` | Covered |
| reactions | delegated `send react` | Covered |
| polls | delegated `send poll`, `poll vote`, `poll show` | Covered |
| delete/revoke | `messages delete|revoke` | **Blocked while sync runs** (stop daemon or `--lock-wait`) |
| live updates | webhook (live only, best-effort) + `messages changes` poll | Degraded |
| pushed history batches | no push; poll `messages changes` | Degraded |
| on-demand backfill | `history backfill` | **Blocked while sync runs** |
| MCP | none | Missing (we build it, as with `tg`) |
| QR in our UI | `auth --events --qr-format text` | Covered |

Cost of wrapping: one process spawn per call (Go binary, fast), parsing PascalCase/snake_case mixed JSON, a
version pin, a supervisor, the webhook receiver, and a stop-sync-run-restart dance for backfill and deletes.
The `.send.sock` protocol could be called directly from Node as a fast path, but it is internal (version 1, no
promise). Forking to add delegation for backfill/delete and a message stream on `--events` is small Go work, but
then we own a Go fork of a fast-moving repo.

What we lose by wrapping: one language stack, our shared TS store/schema (wacli owns its schema), in-process
events, and control over reconnect policy and history-sync handling.
What we gain: about 10 months of edge cases already fixed (LID migration, app-state recovery,
undecryptable retries, uncertain-send handling, media retry).

## 3. Brief inventory of other tools (metadata re-checked 2026-10-16 [api])

| Repo | Lang / license | ★ | Last push | Library | What it is |
|---|---|---|---|---|---|
| [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) | Go+Python / MIT | 6633 | 2025-07-13 | whatsmeow ([go.mod](https://github.com/lharries/whatsapp-mcp/blob/main/whatsapp-bridge/go.mod)) | Go bridge + Python MCP over SQLite. **Stale 15 months** |
| [verygoodplugins/whatsapp-mcp](https://github.com/verygoodplugins/whatsapp-mcp) | Go / unclear | 243 | 2026-10-01 | whatsmeow (fork of lharries, README) | Maintained lharries fork |
| [FelixIsaac/whatsapp-mcp-extended](https://github.com/FelixIsaac/whatsapp-mcp-extended) | Go / MIT | 39 | 2026-10-08 | whatsmeow (README) | 26 tools, webhooks |
| [vicentereig/whatsapp-cli](https://github.com/vicentereig/whatsapp-cli) | Go / none | 202 | 2026-08-08 | whatsmeow ([go.mod](https://github.com/vicentereig/whatsapp-cli/blob/main/go.mod)) | wacli's inspiration; no license |
| [eddmann/whatsapp-cli](https://github.com/eddmann/whatsapp-cli) | Go / MIT | 25 | 2026-05-26 | whatsmeow | Small scriptable CLI |
| [ibrahimhajjaj/wu-cli](https://github.com/ibrahimhajjaj/wu-cli) | **TS / MIT** | 14 | 2026-10-08 | **Baileys**, better-sqlite3, MCP SDK ([package.json](https://github.com/ibrahimhajjaj/wu-cli/blob/main/package.json)) | `gh`-style CLI: daemon, FTS5, MCP, per-chat opt-in allowlist, backfill, remote over SSH (README). 1 contributor |
| [felipeadeildo/whatsapp-mcp](https://github.com/felipeadeildo/whatsapp-mcp) | TS / GPL-3.0 | 92 | 2026-10-08 | `@oxidezap/baileyrs` (Rust core) | MCP on Cloudflare Workers |
| [jlucaso1/whatsapp-mcp-ts](https://github.com/jlucaso1/whatsapp-mcp-ts) | TS / none | 74 | 2026-01-23 | Baileys | MCP, no license |
| [delltrak/wamcp](https://github.com/delltrak/wamcp) | TS / none | 25 | 2026-10-15 | Baileys | 61-tool MCP |
| [d99kris/nchat](https://github.com/d99kris/nchat) | C++ / MIT | 1993 | 2026-10-03 | whatsmeow (cgo, [go.mod](https://github.com/d99kris/nchat/blob/master/lib/wmchat/go/go.mod)) | TUI for Telegram+WhatsApp, not scriptable |
| [normen/whatscli](https://github.com/normen/whatscli) | Go / none | 1068 | 2026-08-08 | whatsmeow | Old TUI |
| [he4rt/wpp-tui](https://github.com/he4rt/wpp-tui) | TS / none | 16 | 2026-09-07 | Baileys + Ink | TUI |
| [aldinokemal/go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice) (GOWA) | Go / MIT | 4915 | 2026-10-15 | whatsmeow | REST gateway + MCP mode (README) |
| [devlikeapro/waha](https://github.com/devlikeapro/waha) | TS / Apache-2.0 | 7608 | 2026-10-15 | engines: whatsapp-web.js, Baileys (NOWEB), whatsmeow (GOWS) (README) | REST gateway, Docker |
| [evolution-foundation/evolution-api](https://github.com/evolution-foundation/evolution-api) | TS / custom | 9856 | 2026-07-14 | Baileys + Cloud API (README) | Multi-tenant gateway |
| [mautrix/whatsapp](https://github.com/mautrix/whatsapp) | Go / **AGPL-3.0** | 1906 | 2026-10-15 | whatsmeow | Matrix bridge (Beeper uses it) |
| [42wim/matterbridge](https://github.com/42wim/matterbridge) | Go / Apache-2.0 | 7587 | 2024-12-12 | whatsmeow | Chat bridge, inactive |
| Libraries: [tulir/whatsmeow](https://github.com/tulir/whatsmeow) Go MPL-2.0 7582★ · [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) JS MIT 11345★ · [wwebjs/whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js) Apache-2.0 22738★ (Puppeteer) · [oxidezap/whatsapp-rust](https://github.com/oxidezap/whatsapp-rust) Rust MIT 907★ (was jlucaso1) | | | all pushed 2026-10-11..15 | | |

Official Meta: no Meta-published MCP server or CLI found; community MCPs wrap the Cloud API, which is for
business numbers only, not personal accounts ([dragapp overview](https://www.dragapp.com/blog/whatsapp-mcp-server/),
[glama listing](https://glama.ai/mcp/servers/p8jhe2q40u)). Hedged: a narrow search can miss things.

Paid gateways for personal numbers (they run WhatsApp Web for you; your messages pass through them):
[Whapi.Cloud](https://whapi.cloud/price) about $29/month per number, free sandbox 5 chats / 150 msgs per day;
[Green-API](https://green-api.com/en/docs/about-tariffs) free Developer plan limited to 3 chats, paid per instance;
Wassenger pricing not found. None fit a local-first agent CLI.

## 4. Verdict

- **wacli (wrap): viable.** Best coverage, MIT, active, prebuilt binaries. Gaps: live updates (webhook + change
  feed polling), backfill and delete blocked while sync runs, no MCP, no allowlist, mixed JSON casing, single main author.
- **wacli (fork): viable but costly.** Small Go changes would remove the gaps (delegate backfill/delete, stream
  stored messages on `--events`). We would then maintain a Go fork beside a TS codebase.
- **Build in TS on Baileys: viable.** Fits the shared adapter interface natively (pushed history batches, live
  events in-process). wu-cli (MIT, TS, Baileys) is a code reference for daemon + FTS5 + MCP + allowlist. We would
  re-solve what wacli already solved (LID mapping, app-state recovery, uncertain sends).
- **lharries/whatsapp-mcp: no.** Stale since 2025-07.
- **mautrix/whatsapp: no** for code reuse (AGPL).
