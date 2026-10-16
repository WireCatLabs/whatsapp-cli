# Plan — WhatsApp CLI foundation on cli-core

2026-10-16. Owner's brief: "use core as much as possible … copy all things from tg cli so we have same linters,
checkers, docs, same structure … very similar to max and telegram and follow all standards — security,
architecture, performance, testing … a solid foundation for next extensibility … use core storage".

## Goal

`wa` — a third messenger on `@wirecat/cli-core`, built like `tg` and `max`: same tooling, same layout, same
shared commands, same store. WhatsApp's protocol runs in the Go engine (whatsmeow, [protocol-decision.md](../protocol-decision.md));
everything above the engine is TypeScript that cli-core already knows how to drive.

## Current state

- Repo holds research docs, `engine/cmd/wa-probe` (Go, read-only probe) and `bin/wa-probe`. No `src/`.
- Live link proven 2026-10-16 on the owner's number: pairing code, history pushes, contacts, one self-send.
- npm has cli-core 0.302.0 / cli-base 0.40.0 (`npm view`). We pin those: cli-core 0.302's peer range is cli-base
  0.40.x. max pins 0.300 / 0.40, tg 0.292 / 0.33.
- cli-core already models a pushed-history messenger: `history: "store"`, `PushedHistory.feed`,
  `serve`/`watch` running `feed` beside `watch` on one connection (`cli-core/src/cli/messenger/watch-command.ts:92`),
  `stored.ts` filling the store from batches (`:193-262`). **No real adapter uses `feed` yet** — we are the first.

## What we copy, from where

| Piece | Source | How |
|---|---|---|
| `config/wirecat/*`, toolchain pins, root config wiring | `WireCatLabs/community` `origin/main` | `scripts/adopt-standards.py` — never by hand |
| `biome.json` boundaries, `vitest.config.ts`, `tsconfig*`, `package.json` shape, `.gitleaks.toml`, `.vale.ini`, `pnpm-workspace.yaml`, testing helpers (`sandbox`, `argv-log`, `mcp-surface`), `contracts/` | max-cli | copy, rename, new paths |
| `program.ts` wiring (shared commands mounted whole), `ci.yml`, `release.yml`, `windows.yml`, `install-windows.yml`, `bin/release`, SECURITY/AGENTS/CLAUDE skeletons, `agent-os/standards` generic files, `docs/dev` skeletons, skill | tg-cli | copy, rename |
| Identical in both | either | as is |

Not copied: max's own `server/` relay, `sharedSubcommand`, own config resolver, `spec/`/`generated/`, bot slices,
probes, captures, legacy-store pieces, `--profile` flag.

## Decisions

1. **Names.** Package `@wirecat/whatsapp-cli`, binary `wa`, env prefix `WA_`, `provider: "whatsapp"` (permanent —
   it is part of every stored key).
2. **History from the store.** `history: "store"`, `fetching.orderBy: "time"`, no `ServerReads`. Reads never
   connect; `serve` keeps the store current through `feed` (history batches) and `watch` (live events).
3. **One canonical id per 1:1 chat, decided in the engine.** cli-core can merge people but not chats, so a chat
   stored once under its phone JID and later under its LID would split its messages. The engine emits every 1:1
   chat in LID form, resolved in this order: whatsmeow's LID store, the history's `PhoneNumberToLIDMapping` and
   `Conversation.lidJID`, a message's `SenderAlt`/`RecipientAlt`, then a batched `GetUserInfo` lookup (whatsmeow
   source; not yet run). Only a user WhatsApp gives no LID for stays in phone form. The phone JID becomes a linked
   identity, never a chat id. LID first because 58 of 71 one-to-one chats in the live run were LIDs, and it keeps
   phone numbers out of chat ids. A user who gains a LID later still splits — NEED-10.
4. **The engine is a port.** `src/engine/contract.ts` declares every request, answer and event as Valibot schemas
   (max's `spec/` idea, small). `GoEngine` spawns the binary and speaks JSON lines; `FakeEngine` serves tests.
   No whatsmeow or engine type crosses the adapter.
5. **One connection per linked device.** Three things open a connection in cli-core today: `serve`, `watch`
   (`listen: true`) and the MCP server (one connection per agent session), plus one-shot writes. Any second one
   makes WhatsApp drop the first (`StreamReplaced`, seen in the probe's handler). The engine takes an exclusive lock
   beside `session.db`; whoever loses gets a refusal naming the holder (`serve`, `watch`, `mcp`, a write). Writes,
   `watch` and MCP while `serve` runs need to go through it — cli-core has no shared way (NEED-8). Until then they
   are refused with that message.
6. **Login.** `wa <profile> session start [qr|phone]` — a local command, as tg's own `session start`
   (`tg-cli/src/commands/session.ts:202`); cli-core has no login command. Phone gives a pairing code. The engine's
   `session.db` lives at `state/profiles/<profile>/session.db`, 0600, dir 0700 — whatsmeow keeps its keys there,
   as mtcute does for tg. One device per file: the engine opens the device by the JID stored for the profile and
   refuses a file holding zero or several devices — never `GetFirstDevice` (the probe's shortcut).
7. **On the wire we look like a browser, not like us.** Pairing name `Chrome (Linux)`, platform `DESKTOP`; the
   linked-device label shows the host OS, never "WhatsApp CLI" (max's rule 2). The probe's label gets fixed.
8. **Engine in development** builds from `engine/` with `pnpm engine:build` (needs Go). Per-platform npm packages
   come in the release phase, not now.
9. **Bot side** (Cloud API) is a later phase; the layout leaves room for `src/cloud/` like tg's `src/bot/`.

## Work items

### Phase 1 — skeleton that passes every check (done 2026-10-16, branch `feat/foundation`)

1. Adopt standards from community `origin/main`; `package.json`, `pnpm install`.
2. Copy configs and CI per the table; rename; `biome.json` boundaries for `adapter/`, `engine/`, `commands/`.
3. `src/bin/wa.ts`, `app.ts`, `program.ts` (shared commands that make sense in store mode), `messenger.ts`.
4. `src/engine/contract.ts` + `FakeEngine`; `src/adapter/` over the engine port, implementing `MessengerCore`,
   `PushedHistory`, `LiveUpdates`.
5. Contract cases (`contractCases({history: "store", orderBy: "time"})`) green against `FakeEngine`.
6. CLAUDE.md, AGENTS.md, SECURITY.md, README, CHANGELOG, docs skeleton, docs/dev ARCHITECTURE/CONVENTIONS/TESTING/BACKLOG.
7. Gates green: `lint`, `typecheck`, `test`, `build`, `standards:check`, `docs:lint`, `contracts:check`.

### Phase 2 — the real engine

JSON-lines engine in Go (hello, login, history, live events, send with caller id, LID map, contacts),
`GoEngine`, login command, `serve` end to end on the owner's number, live checklist.

### Phase 3 — writes through serve, MCP through serve (NEED-8)

### Phase 4 — feature groups

Media, edit/delete, reactions, read state, polls, groups and admin, on-demand older history, contacts.

### Phase 5 — distribution

Engine binaries as `@wirecat/whatsapp-engine-<os>-<arch>` optional deps, release workflow, install tests.

## Test plan

- Contract cases over the real adapter + `FakeEngine` (same as max's seeded fake socket).
- `GoEngine` tested against a tiny fake binary speaking the protocol (no network).
- Leak tests: no phone number or message text in logs, run events, errors.
- Go: `go vet`, unit tests for the event → JSON mapping.

## Open questions

- **NEED-8** — writes while `serve` holds the connection: add a shared "write through serve" to cli-core (all
  messengers benefit; tg and max already need something like it) or copy max's relay into `wa`.
  RISK: a one-shot connection with no `serve` may receive queued messages, acknowledge them and drop them on
  close (unverified; BACKLOG item 10). If so, every connection should be `serve`, and writes must go through it.
- **NEED-9** — `docs_ai/` is public in this repo; max keeps it in private `cli-private`. Move it?
- **NEED-10** — a user who gains a LID after their chat was stored in phone form splits into two chats. Re-key in
  cli-core (a chat-merge operation) or accept the rare split?
