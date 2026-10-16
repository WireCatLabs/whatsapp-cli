# WhatsApp protocol layer — decision

**2026-10-16. Decision: whatsmeow (Go), as a sidecar engine that our TypeScript adapter drives.** Replaces the
earlier "TypeScript on Baileys" recommendation in [research.md](research.md) (same day). Evidence:
[research/](research/).

Marks: **[V]** verified (GitHub data, source, or run here) · **[D]** docs/maintainer · **[I]** inference.

## What the serious projects run on

Only *four* real protocol implementations exist. Everything else — gateways, CLIs, MCP servers — wraps one of them.

| Project | Underneath | Note |
|---|---|---|
| [Beeper](https://www.beeper.com) via [mautrix/whatsapp](https://github.com/mautrix/whatsapp) | **whatsmeow** (pinned 2026-10-15) **[V]** go.mod | Commercial product; whatsmeow's author works at Beeper/Automattic **[V]** GitHub profile |
| [openclaw/wacli](https://github.com/openclaw/wacli) | **whatsmeow** **[V]** | Best CLI |
| [Evolution API](https://github.com/evolution-foundation/evolution-api) → [Evolution Go](https://github.com/evolution-foundation/evolution-go) | Baileys **pinned at rc.9**, no push since 2026-07-14 → new product on **whatsmeow** **[V]** | Moving off Baileys |
| [WAHA](https://github.com/devlikeapro/waha) | Engines: whatsapp-web.js fork, Baileys fork, GOWS (whatsmeow over gRPC) **[V]** | Docs: GOWS is "a future replacement for NOWEB engine" (= Baileys) **[D]** [engines page](https://waha.devlike.pro/docs/how-to/engines/) |
| [GOWA](https://github.com/aldinokemal/go-whatsapp-web-multidevice), [nchat](https://github.com/d99kris/nchat), [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp), [neonize](https://github.com/krypton-byte/neonize) | **whatsmeow** **[V]** | |
| [OpenClaw](https://github.com/openclaw/openclaw) (the agent, 392k★, TS) | **Baileys 7.0.0-rc14**, pinned **[V]** package.json | Same org ships wacli on whatsmeow |
| [baileyrs](https://github.com/oxidezap/baileyrs), [felipeadeildo/whatsapp-mcp](https://github.com/felipeadeildo/whatsapp-mcp) | **whatsapp-rust** via WASM **[V]** | Young |

The signal is not the count. It is the **direction**: two gateway products that ran Baileys (Evolution, WAHA) are
moving to whatsmeow, and the only commercially funded implementation is whatsmeow.

## The options, scored

| | Modern | Reliable | Extensible | Fits cli-core | Distribution | License | Bus factor |
|---|---|---|---|---|---|---|---|
| **whatsmeow sidecar** | Go, contexts throughout since 2025-10 | **Best.** Same-day fixes to protocol breaks; 80 commits in the last 3 months **[V]**; Beeper depends on it | Low-level access (raw nodes, peer messages, app state); built-in SQL store for keys, LIDs, app state **[V]** | Engine = connection owner under `serve`; TS keeps the store | **17–18 MB static binary, `CGO_ENABLED=0`, 6 targets built from one Linux box** **[V]** | MPL-2.0, unmodified → fine next to MIT **[D]** | tulir 1,261 commits, next 135 — but paid to maintain it |
| Baileys (npm) | TS, v7 RC for 13 months | **Stalled.** 7 commits in 3 months, no human push since 2026-08-06, needed fixes not on npm **[V]** | Good, same level as whatsmeow | In-process, ideal shape | npm; one binary 102 MB **[V]** | **GPL-3.0** libsignal dependency | Top contributors inactive |
| Baileys, our fork | Same | Only as good as our own protocol work | Same | Same | Same | Same GPL issue | **Us** |
| whatsapp-rust (napi-rs addon or baileyrs/WASM) | **Most modern.** Rust, MIT, ≥100 commits in 3 months **[V]** | Young: v0.7.0, releases every 2–3 months; baileyrs got **405 (rejected) in our test** **[V]** | Aims at parity; plugins, transports, storages crates | Addon = in-process | napi needs per-platform prebuilds (Biome-style); WASM route has a native dep | MIT | **One person**: 1,680 commits, next 13 **[V]** |
| Browser libs (whatsapp-web.js, wppconnect, venom) | Scrape WhatsApp Web | Break on every web release | DOM-level | Poor | Needs Chromium | Mixed | — |
| Gateways (Evolution, WAHA, GOWA) | Servers wrapping the above | As their engine | REST/webhooks only | A server between us and the socket | Docker | Mixed; WAHA's current GOWS source is paid ([gows](https://github.com/devlikeapro/gows): "available for WAHA PRO") **[V]** | — |
| Cloud API | Official | Official | Send + webhooks only, no history | Separate "business" mode later | — | — | Meta |

## Why whatsmeow, against your two objections

**"Another dependency."** It ships inside our npm package as per-platform `optionalDependencies`, the way Biome ships
`@biomejs/cli-linux-x64` in our own `node_modules` **[V]**. One `npm i -g`, nothing else. A single binary or
`.deb` bundles both.

**"It's not TypeScript."** True — this is the real cost. Two languages in one repo, Go in CI. In return:

- **Reliability is the thing we cannot build ourselves.** WhatsApp changes the protocol several times a year.
  Whoever fixes it fastest decides whether our CLI works on Monday. **[V]** fix table in
  [libraries](research/2026-10-16-libraries.md#fix-speed-after-protocol-breaks).
- **wacli's Go becomes copyable, not just readable.** It is MIT. Its LID migration, history backfill and app-state
  recovery can move into our engine with attribution. In TypeScript we would have to rewrite them.
- **The Go side is a translator, not a product.** Device keys stay in a Go-owned `session.db` (whatsmeow's
  `sqlstore`). Messages, chats and people flow as neutral JSON to the TS adapter and into cli-core's store, as today.

## How the Go engine fits in the repo

The Go engine is a precedent we already run: **esbuild is a Go program shipped through npm.** It is in our tree
(`esbuild@0.25.12` under cli-core, pulled in by Vite/Vitest), comes as 26 per-platform `@esbuild/*` packages, and
its JavaScript side starts the binary with `child_process.spawn(… "--service=0.25.12" …)` and talks to it over
stdin/stdout **[V]** `node_modules/esbuild/lib/main.js:1978`. We copy that shape.

### Layout — one repo, all source kept

```
whatsapp-cli/
  src/                     TypeScript: CLI, Messenger, adapter, engine clients
  src/engine/contract.ts   the engine contract (types + JSON schema) — the swap point
  engine/                  Go module: our engine (~4–7k lines), depends on whatsmeow
    go.mod, go.sum         whatsmeow pinned to a commit; go.sum = checksums
    main.go, …
  npm/engine-<os>-<arch>/  six tiny package.json shells, filled by CI
```

- **Size [I]:** wacli's whatsmeow layer is 3.9k lines of Go and its app logic 7.7k **[V]** `wc -l`. We need the first
  and part of the second (history, LIDs, event conversion): roughly **4–7k lines of Go**, no store, no CLI. wacli is
  MIT, so those parts can be copied with attribution.
- **Yes, all our Go source lives in the repo**, under `engine/`. whatsmeow does **not**: it is a normal Go module
  dependency, pinned to a commit in `go.mod` and checksummed in `go.sum`, downloaded at build time like an npm
  package. No vendoring needed. (Go can vendor with `go mod vendor` if we ever want offline builds.)
- **License (MPL-2.0).** Unmodified whatsmeow: link the upstream source and add it to `THIRD_PARTY_NOTICES`. If we
  ever patch it, the patched files must stay available — our repo is public, so a fork under WireCatLabs covers it.
  **[D]** [MPL 2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)

### Build — on every release, in CI

- **Release:** a GitHub Actions job on the release tag runs `go build` six times from one Linux runner
  (`CGO_ENABLED=0 GOOS=… GOARCH=…`) — about a minute; **[V]** all six built here with no extra toolchain. Each
  binary goes into its `@wirecat/whatsapp-engine-<os>-<arch>` package; then the main package is published with those
  six as `optionalDependencies` at the **exact same version**. npm installs only the one matching the machine.
- **Development:** `pnpm build` also runs `go build -o bin/wa-engine ./engine` for the local machine. An environment
  variable (`WA_ENGINE`) points the CLI at any engine binary, for tests and for a hand-built one.
- **Go is needed only by whoever builds the engine** — CI and contributors who touch `engine/`. Users and TS-only
  contributors never need it (TS contributors can use the published engine package).
- **Single binary / `.deb` / Homebrew:** ship two files (`wa` + `wa-engine`) side by side. For one-file `bun
  --compile`, the engine is embedded as a file and extracted to a cache folder on first run — doable, more work.

## How Node talks to the engine

**A child process with pipes. Requests on stdin, answers and events on stdout, logs on stderr. One JSON object per
line.**

```
→ {"id":7,"method":"send","params":{"chat":"34600…@s.whatsapp.net","text":"hi","clientId":"3EB0…"}}
← {"id":7,"result":{"messageId":"3EB0…","timestamp":1760000000}}
← {"event":"message","data":{"chat":"…","id":"…","from":"…","text":"…","ts":1760000001}}
← {"event":"history","data":{"type":"ON_DEMAND","chats":[…],"messages":[…],"progress":42}}
```

- **Handshake.** The engine's first line is `{"event":"hello","protocol":1,"engine":"0.4.0","whatsmeow":"df33a48"}`.
  The adapter refuses a protocol it does not know, so a mismatched engine fails loudly (esbuild does the same with
  `--service=<version>`).
- **Lifecycle.** `serve` spawns and owns the engine. A one-shot command with no `serve` running spawns a short-lived
  one. The engine exits when its stdin closes, so a crashed parent never leaves an orphan holding the WhatsApp
  connection. A crashed engine is restarted with backoff.
- **Never two engines per login.** The server drops the older connection (`StreamReplaced`) **[V]** source. A lock
  file next to `session.db` makes the second engine fail fast.
- **Sends are retry-safe.** whatsmeow lets the caller choose the message id (`SendRequestExtra.ID`) **[V]**
  [send.go](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/send.go). We pass
  cli-core's `sendId`, so a repeat after a lost answer is the same message. A request sent with no answer becomes
  cli-core's `outcome_unknown`.
- **Big payloads stay off the pipe.** Media goes through files: the engine downloads to a path and returns the path;
  uploads take a path. History batches are split into chunks of a few hundred messages.
- **Errors** carry a code from cli-core's closed list (`authentication_error`, `rate_limited`, `not_found`, …), mapped
  inside the engine, plus whatsmeow's own text for diagnostics.
- **Two databases, clear owners.** `session.db` (Go, whatsmeow's `sqlstore`): device keys, encryption sessions, app
  state, the LID ↔ phone map. cli-core's store (TS): chats, messages, people, search. The LID map is also sent to TS
  as events, so names and search work without asking Go.

## The swappable engine

The adapter never sees whatsmeow, Go or a pipe. It sees one TypeScript interface:

```ts
interface WhatsAppEngine {
  start(onEvent: (event: EngineEvent) => void): Promise<EngineHello>
  call<M extends EngineMethod>(method: M, params: EngineParams[M]): Promise<EngineResult[M]>
  stop(): Promise<void>
}
```

- **`src/engine/contract.ts` is the contract:** every method, its parameters and result, every event — in
  WhatsApp's terms (chat JID, message id, LID, history batch), not whatsmeow's protobufs and not cli-core's domain.
  The adapter turns contract types into cli-core types; the engine turns its library's types into contract types.
- **Implementations:**
  - `GoEngine` — spawns the Go binary, JSON lines (first).
  - `BaileysEngine` — in-process Baileys, same contract (if Baileys recovers, or for a no-Go build).
  - `RustEngine` — whatsapp-rust as a napi addon (when it matures).
  - `FakeEngine` — in memory, for every command test. No WhatsApp, no Go.
- **Contract tests** run against any engine: replay recorded event streams through it and check the output; a live
  suite (opt-in, real test number) checks login, history, send, edit, react, revoke.
- **A capability list in `hello`** (`"capabilities":["polls","newsletters",…]`) lets an engine that lacks something
  say so; the adapter refuses with cli-core's "this messenger cannot …".
- **Cost of the contract:** it is a second model to keep in sync, and it tends toward the lowest common denominator.
  An escape hatch — `raw` on events, a `call("raw", …)` method — keeps library-specific features reachable without
  widening the contract for one engine.

## What whatsmeow can do

From its public API at `df33a48` **[V]**: 136 exported `Client` methods, 75 event types (counted with `grep` over the module source). Grouped by what our CLI
would use; links go to the source file. Base:
`https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/`

| Area | What it can do | Methods / events | cli-core group |
|---|---|---|---|
| Login | QR, pairing code (phone number), passkey pairing, logout | `GetQRChannel`, `PairPhone`, `SendPasskeyResponse`, `Logout`; `QR`, `PairSuccess`, `LoggedOut` | core |
| Connection | Connect, reconnect, proxy (HTTP/SOCKS), passive mode, keep-alive | `Connect`, `ResetConnection`, `SetProxy`, `SetSOCKSProxy`, `SetPassive`; `Connected`, `Disconnected`, `StreamReplaced`, `ClientOutdated`, `KeepAliveTimeout` | core |
| Account health | Temporary ban with reason and expiry; the new-contact "timelock" with its end time | `TemporaryBan`, `NotifyAccountReachoutTimelock` | `AccountHealth` |
| History | At pairing; on demand from the phone (~50 per request); re-request a message that failed to decrypt | `BuildHistorySyncRequest`, `BuildUnavailableMessageRequest`, `DownloadHistorySync`; `HistorySync`, `OfflineSyncCompleted` | `PushedHistory` |
| Receive | All messages, decrypt retries, undecryptable notices | `Message`, `UndecryptableMessage`, `SendMediaRetryReceipt` | `LiveUpdates` |
| Send | Text and media to people and groups, replies, mentions, own message id, link previews (we build them) | `SendMessage` + `SendRequestExtra{ID}`, `GenerateMessageID` | core |
| Edit / delete | Edit own message, delete for everyone, delete for me | `BuildEdit`, `BuildRevoke`, `RevokeMessage`; `DeleteForMe` | `MessageEditing` |
| Reactions | Send, receive, encrypted reactions | `BuildReaction`, `EncryptReaction`, `DecryptReaction` | `MessageReactions` |
| Polls | Create, vote, decrypt votes | `BuildPollCreation`, `BuildPollVote`, `DecryptPollVote` | `MessagePolls` |
| Media | Upload, download, thumbnails, sticker packs, media re-upload request | `Upload`, `Download*`, `DownloadThumbnail`, `FetchStickerPack`; `MediaRetry` | `MessageMedia` |
| Read state | Read receipts, delivery receipts, mark chat read | `MarkRead`, `appstate.BuildMarkChatAsRead`; `Receipt`, `MarkChatAsRead` | `ReadState` |
| Chat state | Archive, pin, mute, star, delete chat, clear chat, labels | `appstate.BuildArchive`, `BuildPin`, `BuildMute`, `BuildStar`, `BuildDeleteChat`, `BuildLabel*`, `SendAppState`; `Archive`, `Pin`, `Mute`, `Star`, `ClearChat` | `ChatFolders` (labels) |
| Presence | Online/offline, typing, subscribe to someone's presence | `SendPresence`, `SendChatPresence`, `SubscribePresence`; `Presence`, `ChatPresence` | — |
| Contacts | Is a number on WhatsApp, user info, devices, profile photos, about, business profile, contact QR links | `IsOnWhatsApp`, `GetUserInfo`, `GetUserDevices`, `GetProfilePictureInfo`, `GetBusinessProfile`; `Contact`, `PushName`, `Picture`, `UserAbout` | `ContactBook`, `PersonProfiles` |
| LIDs | LID ↔ phone map, kept in `sqlstore` | `StoreLIDPNMapping`, store `LIDStore` | — |
| Groups | Create, info, join by link/invite, leave, members add/remove/promote/demote, join requests, name, topic, description, photo, announce-only, locked, add mode, invite link | `CreateGroup`, `GetGroupInfo`, `JoinGroupWithLink`, `UpdateGroupParticipants`, `GetGroupRequestParticipants`, `SetGroup*`, `GetGroupInviteLink`; `GroupInfo`, `JoinedGroup` | `GroupAdmin`, `GroupModeration`, `JoinRequests`, `InviteLinks` |
| Communities | Sub-groups, link/unlink a group | `GetSubGroups`, `LinkGroup`, `UnlinkGroup`, `GetLinkedGroupsParticipants` | — |
| Channels | Create, follow, unfollow, info, read posts, live updates, react, mute | `CreateNewsletter`, `FollowNewsletter`, `GetNewsletterMessages`, `NewsletterSubscribeLiveUpdates`, `NewsletterSendReaction` | — |
| Privacy | Privacy settings, status privacy, block list, disappearing timers | `GetPrivacySettings`, `SetPrivacySetting`, `GetBlocklist`, `UpdateBlocklist`, `SetDisappearingTimer`, `SetDefaultDisappearingTimer` | `AccountSettings` |
| Profile | Push name, status text, photo | `SetStatusMessage`, `appstate.BuildSettingPushName` | `AccountEditing` |
| Calls | **Receive offers and reject only** — no audio/video | `RejectCall`; `CallOffer`, `CallTerminate` | — |
| Other | Meta AI bot profiles, business message links, order details, Facebook/Instagram message variants | `GetBotProfiles`, `ResolveBusinessMessageLink`, `GetOrderDetails`, `SendFBMessage` | — |

**Not possible** (README **[D]** and API): calls; broadcast-list sending; status posting is "experimental, may not
work for large contact lists"; scheduled messages (WhatsApp has none); **no server-side history** — the phone must be
online to answer history requests. Editing someone else's message, reading "seen by" in large groups beyond receipts,
and message search on the server do not exist in WhatsApp either.

## Downsides of the engine approach

1. **Two languages.** Go in the repo, in CI, in code review. A bug can live on either side of the pipe.
2. **A process boundary.** Every call is serialized to JSON and back; debugging spans two processes and two logs; a
   change in one place (a new message field) touches the contract, Go and TS.
3. **Two databases.** `session.db` and cli-core's store must agree, e.g. on LIDs. Backup and "reset this account"
   must cover both.
4. **Install size.** +17–18 MB per platform (only one platform is downloaded). Bigger than `tg` today.
5. **npm optional-dependency quirks.** `--omit=optional`, or a lockfile made on another OS, can skip the engine
   package. esbuild handles this with a fallback download and a clear error **[I]**; we need the same check at startup.
6. **Unsigned binaries.** Through npm, macOS and Windows usually run them without prompts; a downloaded standalone
   binary needs signing and notarization, and Go binaries sometimes trip Windows antivirus heuristics **[I]**.
7. **whatsmeow has no versions.** Each update is a commit bump with possible small API breaks (one large break in the
   last year) **[V]** commit log. Kept small by the thin engine.
8. **The contract is extra work.** Worth it only if we really might swap engines — which we want, but it is a cost
   on day one.

## Disconfirming evidence

- **whatsmeow [#1197](https://github.com/tulir/whatsmeow/issues/1197) is open since 2026-07-02**: sending to *new
  contacts* fails (error 463, "timelock"). It is **server-side and hits every open-source library** — Baileys tracks
  the same thing in [#2441](https://github.com/WhiskeySockets/Baileys/issues/2441) and
  [#2707](https://github.com/WhiskeySockets/Baileys/issues/2707) **[V]**. A commenter notes Beeper does not report it;
  Beeper runs a [whatsmeow fork](https://github.com/beeper/whatsmeow) **[V]** — why it differs is unknown. For a
  personal CLI it matters little: messaging strangers is what we would block anyway.
- **No tags.** Every update is a pin bump. One year: 242 commits, one marked "BREAKING CHANGE" (2025-10-27, contexts
  everywhere) and about a dozen small removals **[V]** commit log. Manageable behind a pinned, thin engine.
- **Concentration.** One author writes most of whatsmeow. The difference from Baileys and whatsapp-rust is that he is
  paid to, by a company whose product depends on it.

## Verified here, 2026-10-16

- Minimal whatsmeow program, pure-Go SQLite (`modernc.org/sqlite`, dialect `sqlite` accepted by `sqlstore`),
  `CGO_ENABLED=0`: **17.7 MB static binary, reached the QR code**, created `session.db`.
- Cross-compiled linux/darwin/windows × amd64/arm64 from Linux, no extra toolchain: all six built (17–18 MB).
  Only the Linux one was run.
- Not tested: a real login, history batches, send, macOS/Windows runs.

## First live link, 2026-10-16

`bin/wa-probe link` on the owner's main number (whatsmeow `df33a48`, desktop profile, full sync requested). Totals
only; no content was stored. **[V]**

- **Pairing code works.** Linked 27 s after start; connected 3 s later. No ban, logout or warning event.
- **All history came in 4 seconds**, in six pushes: `INITIAL_BOOTSTRAP` (every chat, ~1 message each), `RECENT`,
  then one `FULL` chunk at progress 100 %. About 1.9k messages over ~200 chats. Nothing more arrived afterwards.
- **"Full" is far from full.** The phone sent ~1.6k messages in the `FULL` chunk, probably much less than the account holds **[I]**.
  Older history probably has to come from on-demand requests to the phone; the phone decides the size; not yet tested
  what `BuildHistorySyncRequest` returns.
- **Most private chats are LIDs.** In the `FULL` chunk, 58 of 71 one-to-one chats had a LID id, not a phone
  number. LID → phone mapping is a day-one need, not an edge case.
- **Sending works.** `bin/wa-probe send-self` sent one text to the account's own chat; the owner saw it on the
  phone.
- **Contacts arrive through app-state sync**, not history: whatsmeow held ~300 contacts at the end of the 15-minute
  run. No events arrived after the first minute except 9 live messages. No alert at any point.
