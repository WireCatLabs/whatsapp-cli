# Backlog

Open work for this cycle only, one item per line, most important first. Someday work is in
[BACKLOG_LATER.md](BACKLOG_LATER.md); the research behind an item is in [BACKLOG-NOTES.md](BACKLOG-NOTES.md).
What `wa` does today: [`../commands.md`](../commands.md) (generated). How it is built: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Rules

- **An id is permanent** and never reused. Take one with `bin/next-id WA`: one counter for every worktree on the
  machine, under a lock, and never below the highest number on any branch.
- **One item:** id · priority · area · the task as a title · where the work starts · a link to the details. Areas:
  `engine` (Go, whatsmeow) · `cli` (commands, output, help) · `core` (needs a cli-core change) · `live` (a check on
  the owner's number, own chat only, NEED-1387) · `docs` · `ops` (tooling, CI, release) · `risk`.
- **Priority:** **P1** — broken, lies to users, install or first-run failure, security: fixed before `wa` is
  advertised · **P2** — this cycle · **P3** — someday, in [BACKLOG_LATER.md](BACKLOG_LATER.md).
- **Mark:** none — not started · 🚧 `<branch>` — taken · 🟡 — half done, the rest named · ⏸️ — deferred by the
  owner · 🚩 — waits on an owner decision.
- **Claim before code:** put `🚧 <branch>` on the line in the first push of the branch.
- **Close in the PR that ships the work:** delete the line here and its entry in the notes. Users read what shipped in
  [`CHANGELOG.md`](../../CHANGELOG.md).

## Launch blockers (P1)

- **WA-1** · P1 · core · Help and `commands --json` offer commands that fail with exit 2 `input.invalid`
  (`chats folders *`, `account sessions *`, `chats inspect`, `contacts add|remove|rename|import`, `messages comments`).
  Owner (2026-10-23): implement what WhatsApp allows (WA-50..53, WA-55), hide only what it cannot do — `account
  sessions end` (only the phone ends other devices) and `contacts remove` (whatsmeow cannot send it) — in cli-core
  `src/cli/messenger/lacks.ts`. The usage docs also wrongly say WhatsApp has no folders, comments or contact edits.
  Evidence per command: cli-private `research/comparisons/wa.md`.
- **WA-4** · P1 · live · A photo and a video "go as one album" (`docs/roadmap.md:8`, `docs/usage.md:224`), but the
  last live run showed two messages: run `bin/live-album`, then fix the docs or the send.
  [Notes](BACKLOG-NOTES.md#wa-4--album-does-the-phone-group-a-photo-and-a-video)
- **WA-5** · P1 · live · A fresh `session start` keeps the history push and sets `self()` — `bin/live-fresh-link`.
  [Notes](BACKLOG-NOTES.md#wa-5--linking-live-checks)
- **WA-6** · P1 · live · A one-shot command no longer drops queued messages — re-run `bin/live-oneshot-drop`.
  [Notes](BACKLOG-NOTES.md#wa-6--one-shot-connections-live-re-check)

## Next (P2)

- **WA-7** · P2 · cli · 🚧 `feat/bot-*` Bots through Meta's Cloud API, `wa <profile> bot` (PRs #207–#210, #214) —
  plan: cli-private `plans/2026-10-22-wa-bot-api/handoff.md`.
- **WA-8** · P2 · core · 🚧 `feat/media-archive` Checked file archives, `attachments download|check|jobs` (PR #203),
  waits on cli-core #1758.
- **WA-9** · P2 · ops · List `wa` on wirecat.dev once the P1 items are closed: an entry in cli-docs `tools.json`
  with its `docsRef`.
- **WA-10** · P2 · cli · Mount cli-core's `guide`, as tg and max do — `src/program.ts`.
- **WA-11** · P2 · engine · 🚩 How long a rate limit and a ban hold writes (15 min, a week) — `src/adapter/errors.ts`.
  [Notes](BACKLOG-NOTES.md#wa-11--how-long-a-rate-limit-and-a-ban-hold-writes)
- **WA-12** · P2 · core · `serve` restarted by its unit takes the login back from the connection that replaced it —
  cli-core `noRestartOn` by reason. [Notes](BACKLOG-NOTES.md#wa-12--serves-restarts-need-cli-core)
- **WA-13** · P2 · engine · A file WhatsApp no longer keeps does not download (`media.retry-failed`): find how the
  apps get the new copy's key — `bin/live-expired-file`. [Notes](BACKLOG-NOTES.md#wa-13--files-whatsapp-no-longer-keeps)
- **WA-14** · P2 · live · Older history from the phone: the open questions of scenario H1 —
  `bin/live-older-history`. [Notes](BACKLOG-NOTES.md#wa-14--older-history-from-the-phone-live-checks)
- **WA-15** · P2 · live · Chat-state writes in a one-to-one chat addressed by LID and in a group, and the
  `chats mark-read` re-check — `bin/live-chat-state`.
  [Notes](BACKLOG-NOTES.md#wa-15--chat-state-writes-beyond-the-own-chat-live-checks)
- **WA-16** · P2 · live · Polls: a vote cast by `wa`, votes from others, history votes, and a live vote that races
  its poll — `bin/live-poll-vote`. [Notes](BACKLOG-NOTES.md#wa-16--polls-and-votes-live-checks-and-the-race)
- **WA-17** · P2 · core · Chat state from the phone not stored yet: pins, deleted and cleared chats, and
  `lastMessageAt` moving back (cli-core #1728). [Notes](BACKLOG-NOTES.md#wa-17--chat-state-from-the-phone-what-is-not-stored-yet)
- **WA-18** · P2 · ops · Add `wa` to cli-base's cross-CLI audit (`audit.yml`, `audit/baseline/`) and to cli-private
  `bin/standards-audit.sh` (slice B1 of the standards handoff).
- **WA-19** · P2 · engine · Business-app features whatsmeow reaches: labels and another business's profile
  (NEED-1608 = A) — plan: cli-private `plans/2026-10-22-wa-business-app/handoff.md`.
- **WA-20** · P2 · risk · npm 11.17 warns that the `postinstall` is not covered by `allowScripts`; an npm that
  enforces it skips `WA_INSTALL_AGENT` (`docs/installation.md:24`) — check npm 12, document `--allow-scripts`.
- **WA-21** · P2 · engine · Channels: save a post's file, and what following and reading left open —
  `engine/cmd/wa-engine/`. [Notes](BACKLOG-NOTES.md#wa-21--channels-post-files-and-what-following-left-open)
- **WA-50** · P2 · engine · `contacts add|rename` through one app-state contact change, as wacli does on the same
  library. Test on a spare account first: a bad app-state write breaks sync on every device.
- **WA-51** · P2 · engine · `chats inspect` for group and channel invite links: whatsmeow previews a group link
  without joining; channel links already work.
- **WA-52** · P2 · engine · `account sessions list` as linked device ids (WhatsApp sends no device names); `end`
  refused with a clear reason.
- **WA-53** · P2 · engine · `chats folders list|show` from WhatsApp Lists, which reach every linked device; needs
  WA-30 first, and pairs with WA-19 business labels.
- **WA-30** · P2 · engine · `EmitAppStateEventsOnFullSync` stays off; changes made while out of sync are lost.
  [Notes](BACKLOG-NOTES.md#wa-30--emitappstateeventsonfullsync-stays-off)
