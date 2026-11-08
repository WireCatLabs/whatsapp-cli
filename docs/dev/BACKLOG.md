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

- **WA-1** · P1 · core · 🚧 `fix/wa-1-own-contact` · Validate contact writes on a spare account before exposing
  them. Reopened 2026-11-08: the 18:26 run's PASS was wrong. The owner had linked profile `spar` with his main phone,
  so the number typed was the main account's own, and the name landed in the main account's contact for itself (the
  chat with himself); his public profile name did not change, and the person on the spare phone still shows only the
  number. The engine now refuses a contact for the account's own number or LID, and `bin/live-contact-write` has the
  engine confirm the spare phone's number before
  the write. Re-run on a profile linked from the spare phone. List writes remain in WA-56; bulk contact import needs a
  bounded write policy. Until validated, their adapter methods stay in `lacks`; unsupported session termination and
  contact removal stay in `never`. [Notes](BACKLOG-NOTES.md#wa-1--contact-writes-on-a-spare-account)
- **WA-4** · P1 · live · Closed 2026-11-08: `bin/live-album` showed a captioned photo and video in the own chat as
  one album, both files opening. It ran on the main account (profile `spar` was its second device), not a spare; the
  result stands, since grouping depends on the message, not on which account sent it. Still unverified: an album
  without a caption (WA-68). [Notes](BACKLOG-NOTES.md#wa-4--album-does-the-phone-group-a-photo-and-a-video)
- **WA-5** · P1 · live · Closed 2026-11-08: `bin/live-fresh-link spar` linked a second device with its history push
  kept and the own id recorded, `WA-5: PASS`. It ran on the main account, which is what the script is for: it links
  a second device of the owner's account. That device is unlinked again. [Notes](BACKLOG-NOTES.md#wa-5--linking-live-checks)

## Next (P2)

- **WA-68** · P2 · live · Does a photo and a video sent without text group as one album on the phone? The guide
  says they may show as two messages until a phone shows otherwise.
- **WA-63** · P2 · core · Store a "could not be decrypted" placeholder for an undecryptable message, replaced when
  the phone's resend arrives with the same id (the resend itself is on: `AutomaticMessageRerequestFromPhone`). Needs
  a cli-core decision on how a placeholder looks in the shared store (a flag, not searchable text) —
  `engine/cmd/wa-engine/events.go`.
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
- **WA-21** · P2 · engine · Channels: save a post's file, and what following and reading left open —
  `engine/cmd/wa-engine/`. [Notes](BACKLOG-NOTES.md#wa-21--channels-post-files-and-what-following-left-open)
- **WA-50** · P2 · engine · 🟡 `feat/wa-launch-reads` · Contact patch code and unit tests are ready, and the patch
  needs the person's LID; `contacts add|rename` stay disabled until WA-1's spare-account check passes.
