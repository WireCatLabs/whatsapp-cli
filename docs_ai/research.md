# WhatsApp CLI — what to build on

Research as of **2026-10-16**. Question: base the WhatsApp CLI on [openclaw/wacli](https://github.com/openclaw/wacli),
or build our own in TypeScript on `@wirecat/cli-core`, like `tg` and `max`?

Evidence, with every link and source anchor:

- [research/2026-10-16-existing-tools.md](research/2026-10-16-existing-tools.md) — code read of wacli at
  `7a06c82`, inventory of 21 other CLIs, MCP servers and gateways.
- [research/2026-10-16-libraries.md](research/2026-10-16-libraries.md) — protocol libraries, GitHub/npm data,
  source anchors at pinned commits, the Bun test.
- [research/2026-10-16-official-api-and-policy.md](research/2026-10-16-official-api-and-policy.md) — Meta's
  Cloud API, pricing, AI-chatbot policy, Coexistence, Terms of Service, ban risk.

Marks: **[V]** verified (code read, GitHub/npm data, or run on this machine) · **[D]** docs or a maintainer says
so · **[I]** inference.

## Recommendation

> **Superseded 2026-10-16** for the protocol layer — see [protocol-decision.md](protocol-decision.md): whatsmeow (Go)
> as a sidecar engine, not Baileys. Still true below: build our own on cli-core, don't wrap wacli. The Baileys
> points (RISK-1, the GPL catch, the fork plan) no longer drive the design.
>
> Before: "Build our own, in TypeScript, on Baileys — behind the cli-core adapter."

**Build our own on cli-core — behind the adapter.** Do not wrap wacli. Use wacli and wu-cli as references to read,
not as dependencies.

Why, in order of weight:

1. **One store, not two.** cli-core already owns the store, search, MCP, the send guard, `serve` and `inbox`.
   wacli owns its own SQLite store and schema. Wrapping it means syncing wacli's store into ours, through a
   webhook that drops events and a change feed we poll. Two stores of the same messages is the cost we would
   pay forever. **[V]** (existing-tools §1.4, §1.7)
2. **cli-core was built for this shape.** `Messenger.history = "store"`, the `PushedHistory.feed` group and the
   "one socket per linked device" rule are already in
   [cli-core ADAPTERS.md](../../cli-core/docs/dev/ADAPTERS.md). Baileys pushes history batches and live events
   into our process, which is exactly what `feed` and `watch` take. **[V]**
3. **One language.** Baileys is TypeScript, so the adapter, the protocol and our tests sit in one stack. Install
   friction is *not* a strong argument either way: a Go binary can ship inside the npm package as per-platform
   `optionalDependencies`, as Biome does in our own `node_modules` (`@biomejs/cli-linux-x64` …). **[V]**
4. **wacli's gaps hit the commands we care about.** While its `sync --follow` runs, `history backfill`,
   `messages delete/revoke/forward` and group admin fail on the store lock; live message content leaves the
   daemon only through a best-effort webhook; there is no MCP and no recipient allowlist. **[V]** code read
   (existing-tools §1.6–1.11). Not run — a live test could show it behaves better.
5. **The protocol is done for us.** max-cli included a protocol client written by hand (~4,300 lines). For
   WhatsApp, Baileys is that layer. **[V]**

Keep the protocol library behind the adapter, so a whatsmeow sidecar or Baileyrs can replace Baileys later
without touching commands (see RISK-1).

## How hard is it to build with agents

**Reference: max-cli.** First commit 2026-09-18, v0.55 on 2026-10-15 — 28 days, 878 commits, 24.5k lines of
source (protocol + client ~4.3k, adapter 525, session 817) and 27k lines of tests. **[V]** `git log`, `wc -l`.

WhatsApp is easier on the protocol (Baileys) and harder on state (we keep everything the phone pushes). My
estimate **[I]**:

| Stage | What | Effort with agents |
|---|---|---|
| 1. Spike | Real login, pairing code + QR, history batches into cli-core's store, one send. Proves Baileys on Bun with a real account. **Use Baileys' main-branch commit, not npm** (see RISK-1) | 1–2 days |
| 2. MVP | Adapter core + `PushedHistory` + `LiveUpdates`; auth-state store in SQLite (keys, `lid-mapping`, `device-list`, `tctoken`); `serve` as the only connection owner, commands go through it; `chats`, `messages list/search/send`, `inbox`, `watch`, MCP — mostly free from cli-core | ~1 week |
| 3. Parity with tg/max | Media, edits, reactions, polls, receipts, groups, backfill on demand, contract cases, docs | 2–3 weeks |

**The hard parts** (where wacli's code is worth reading first — it is MIT):

- **LIDs.** WhatsApp is replacing phone numbers with hidden per-user ids ("LIDs"). Baileys can look up phone →
  LID, but LID → phone only for pairs it has already seen; its mapping event is "not always emitted yet". **[D]**
  wacli rewrites rows from LID to phone number on each sync start. **[V]**
- **History.** The server does not answer "list chats" or "give me messages". Everything comes as pushes from
  the phone, at pairing and on request (`fetchMessageHistory`), and the phone must be online. Full history needs
  the `Desktop` browser profile. **[V]** source.
- **One connection.** A second process with the same login kicks the first off (`connectionReplaced`, 440), and
  Baileys' sample reconnect loop would make two processes fight. **[V]** source. So `serve` holds the socket and
  every command talks to it, as max-cli's commands go through `max serve`.
- **Auth-state store.** Baileys' file store is "not for production" by its own comment. **[V]** We write a
  SQLite one with transactions.

## Should we bother?

**Yes, if WhatsApp is a messenger you use daily** — it becomes a third
adapter on the same core, so every cli-core feature (search, replies, rankings, MCP, guard) lands for free.

**Not yet, if you only want to read and send now.** Then install wacli today (`brew` or a release binary) and
use it directly. It costs nothing to try and does not commit us to anything.

## Distribution: exe / deb

- **npm, like tg** — works now, no native modules in Baileys' core. **[V]**
- **One binary** — `bun build --compile` on Baileys 7.0.0-rc14 produced a 102 MB binary that started from an
  empty folder and reached the QR code. **[V]** run on this machine 2026-10-16. Not tested: a real login, media.
  `sharp` (image thumbnails) is a native addon and will not embed; use `jimp` or no thumbnails. **[I]**
- **.deb / Homebrew / winget** wrap that binary; no new problem.
- **A Go sidecar would not need a separate install either.** If Baileys dies and we move to whatsmeow, the binary
  ships inside the npm package per platform, Biome-style. So "it's not TypeScript" costs us a second language,
  not a second install.
- **License catch (SEC-1).** Baileys is MIT, but its dependency `libsignal` is **GPL-3.0**. Through npm the user
  installs it themselves. A single binary *embeds* it, and the distributed binary probably falls under GPL. **[I]**,
  not legal advice. Baileyrs (MIT Rust replacement) or Baileys' WASM-libsignal branch would remove this.

## Risks

**RISK-1 · Baileys maintenance has stalled.** No human push since 2026-08-06; 50 open PRs, none merged since
2026-08-05; npm "latest" has been a v7 release candidate for 13 months; a fix for full history (#2741) is on the
main branch but not on npm. In February a protocol break was fixed on main the same day but reached npm 10 weeks
later. **[V]** whatsmeow (Go) fixed its breakages the same day.

This is not only a future risk. Full history needs the `Desktop` browser profile; on npm rc14 that profile gets
error 428 ([#2677](https://github.com/WhiskeySockets/Baileys/issues/2677)), and the fix
([#2741](https://github.com/WhiskeySockets/Baileys/pull/2741)) is only on the main branch. **[V]** So the
history-into-store design does not work from npm Baileys. A git dependency inside a published npm package needs git
and a build at install time, and Bun blocks install scripts. **Plan: publish our own pinned fork of Baileys to npm
from day one**, and keep the protocol behind the adapter so whatsmeow or Baileyrs can replace it.

**RISK-2 · Account bans.** WhatsApp's Terms forbid unofficial clients and automation; the help center says linking
to an unofficial app may lead to a ban. **[D]** Every ban report in the libraries' trackers involves bulk sending,
cold contacts or status posts. **[V]** issue search. Rules for the CLI: no messages to unknown numbers, no bulk
sends, read-mostly, a warning at first login. cli-core's send guard (recipient list, hourly limit) already fits.

**RISK-3 · The phone is the server.** Linked devices are logged out after ~14 days without the phone; on-demand
history needs the phone online. **[D]** secondary sources only.

## The two modes, like tg

| | Personal account | Business (official) |
|---|---|---|
| Telegram analogue | MTProto, `tg` | Bot API, `tg bot` |
| WhatsApp route | Linked device over the unofficial protocol (Baileys) | [Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) |
| History | What the phone pushes; we store it | None. No endpoint to list chats or read past messages **[I]** from the docs index |
| Inbound | Live on the socket | Webhook only: public HTTPS, no polling **[D]** — needs a tunnel or a small always-on receiver |
| Cost | Free | Per delivered template; replies inside the 24-hour window are free **[D]** |
| Rules | Against the Terms; ban risk | General-purpose AI assistants banned since 2026-01-15 **[D]** |

**The WhatsApp Business *app* has no API.** Its number can move to the Cloud API through "Coexistence" (keeps the
app, syncs 180 days of history), but Meta allows that only to registered partners ("Tech Providers"). **[D]**
For your own Business-app number, linking as a device (the personal route) is the practical way.

Business mode is a later phase, not part of the decision above.

## Existing tools, briefly

| Tool | Verdict |
|---|---|
| [openclaw/wacli](https://github.com/openclaw/wacli) — Go, MIT, 2.8k★, weekly releases | Best existing CLI. Reference for LID handling, backfill, send spacing. One main author (89 commits in the last 3 months; the next author 11). |
| [ibrahimhajjaj/wu-cli](https://github.com/ibrahimhajjaj/wu-cli) — TS, MIT, Baileys | Closest to our design: daemon, FTS5, MCP, allowlist. 14★, one author — read, don't depend. |
| [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) — 6.6k★ | No push since 2025-07. |
| [devlikeapro/waha](https://github.com/devlikeapro/waha), [GOWA](https://github.com/aldinokemal/go-whatsapp-web-multidevice), [Evolution API](https://github.com/evolution-foundation/evolution-api) | REST gateways for servers, not local CLIs. |
| [mautrix/whatsapp](https://github.com/mautrix/whatsapp) | AGPL — no code reuse. |
| Browser-based libs (whatsapp-web.js, wppconnect, venom) | Need Chromium. Out. |
| [oxidezap/baileyrs](https://github.com/oxidezap/baileyrs) — Baileys API on Rust/WASM, MIT | Watch: fixes the GPL issue and is very active, but 6 months old and rejected by the server (405) in our test today. **[V]** |
| Meta | No official CLI. A "WhatsApp Business Tools MCP" beta (2026-09) helps set up Cloud API accounts; not an inbox. **[D]** press only |
