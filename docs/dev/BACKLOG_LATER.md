# Backlog — later

Someday work (P3): nice-to-haves, research, live checks that settle edge cases. Same ids, rules and one-line format
as [BACKLOG.md](BACKLOG.md); an item moves there when it becomes P2. The research is in
[BACKLOG-NOTES.md](BACKLOG-NOTES.md).

## Identity and history

- **WA-22** · P3 · live · A person in phone form who gains a LID is stored once, under the LID.
  [Notes](BACKLOG-NOTES.md#wa-22--a-user-who-gains-a-lid-later-live-check)
- **WA-23** · P3 · live · Batched `GetUserInfo` answers phone JIDs with their LIDs, and the pace is accepted.
  [Notes](BACKLOG-NOTES.md#wa-23--the-lid-lookups-live-check)
- **WA-46** · P3 · core · Each re-key of a stored phone-form chat is its own store write; batch them in cli-core.
  [Notes](BACKLOG-NOTES.md#wa-46--each-re-key-of-a-stored-phone-form-chat-is-its-own-store-write)

## Groups, communities and channels

- **WA-24** · P3 · live · Chat events: people in a push's service messages, the owner's own join, unread stub types —
  `bin/live-chat-events`. [Notes](BACKLOG-NOTES.md#wa-24--chat-events-live-checks)
- **WA-25** · P3 · core · A group the store lacks is found by its `…@g.us` id only in a one-shot command.
  [Notes](BACKLOG-NOTES.md#wa-25--names-of-groups-the-store-lacks-in-a-one-shot-command)
- **WA-27** · P3 · core · Communities: list a community's groups, link and unlink one, create one in it.
  [Notes](BACKLOG-NOTES.md#wa-27--communities-only-the-read-of-one-group)
- **WA-28** · P3 · live · Every group write, and `profile` on a `@lid` person.
  [Notes](BACKLOG-NOTES.md#wa-28--group-writes-and-profile-on-a-lid-person-live-checks)
- **WA-47** · P3 · live · Groups the owner left: the notices reach the device; a group left while offline.
  [Notes](BACKLOG-NOTES.md#wa-47--groups-the-owner-left-built-not-checked-live)
- **WA-39** · P3 · engine · `metadata refresh` for a channel (`group` reads groups only).
  [Notes](BACKLOG-NOTES.md#wa-39--metadata-refresh-for-a-channel)

## Messages and files

- **WA-26** · P3 · live · Stickers from a file: non-square, still over 100 KB, animated.
  [Notes](BACKLOG-NOTES.md#wa-26--stickers-from-a-file-live-check-and-the-limits)
- **WA-29** · P3 · live · A reaction and a revoke in a phone-addressed group; one receipt clearing the unread count.
  [Notes](BACKLOG-NOTES.md#wa-29--a-reaction-and-a-revoke-in-a-phone-addressed-group-live-checks)
- **WA-35** · P3 · live · Delete for the owner alone and stars beyond the own chat, and the ones made on the phone.
  [Notes](BACKLOG-NOTES.md#wa-35--delete-for-the-owner-alone-and-stars-live-checks)
- **WA-36** · P3 · core · A message pin that arrives is skipped, so the store does not know what is pinned.
  [Notes](BACKLOG-NOTES.md#wa-36--message-pins-that-arrive-are-skipped)
- **WA-37** · P3 · engine · A photo stored by an older `wa` has its caption and no file; only a re-link refills it.
  [Notes](BACKLOG-NOTES.md#wa-37--messages-stored-before-files-were)
- **WA-38** · P3 · engine · Forward several contact cards and a live location; check a forwarded place and card.
  [Notes](BACKLOG-NOTES.md#wa-38--forwarding-several-contact-cards-a-live-location-a-place-or-a-card)
- **WA-40** · P3 · core · An album stores only its first file, and holds at most a photo and a video.
  [Notes](BACKLOG-NOTES.md#wa-40--albums-only-the-first-file-is-stored)
- **WA-41** · P3 · engine · No preview on a sent video or WEBP photo; EXIF orientation ignored.
  [Notes](BACKLOG-NOTES.md#wa-41--no-preview-on-a-sent-video-or-webp-photo)
- **WA-42** · P3 · engine · Newer poll fields (close time, anonymous, quiz): unused until a client shows them.
  [Notes](BACKLOG-NOTES.md#wa-42--newer-poll-fields)
- **WA-48** · P3 · core · A reaction sent with `reactions add` goes to WhatsApp only, not to the store
  (`CHANGELOG.md`, 0.3.0); tg stores its own.

## Account and chat state

- **WA-30** · P3 · engine · `EmitAppStateEventsOnFullSync` stays off; changes made while out of sync are lost.
  [Notes](BACKLOG-NOTES.md#wa-30--emitappstateeventsonfullsync-stays-off)
- **WA-31** · P3 · live · `account update --photo` with a square JPEG through `serve`.
  [Notes](BACKLOG-NOTES.md#wa-31--the-own-profile-photo-live-check)
- **WA-32** · P3 · live · `account update`: name, about with no duration, empty about.
  [Notes](BACKLOG-NOTES.md#wa-32--account-update-live-checks)
- **WA-33** · P3 · live · `account privacy set` and what each setting means on the phone.
  [Notes](BACKLOG-NOTES.md#wa-33--account-privacy-live-checks)
- **WA-34** · P3 · engine · An archive or mark-unread of a chat the store holds nothing of, once the phone is seen to
  take an empty range. [Notes](BACKLOG-NOTES.md#wa-34--an-archive-or-mark-unread-with-nothing-stored)

## Commands

- **WA-49** · P3 · cli · 🚩 Mount cli-core's `schedule` (agent runs on a timer), as tg and max do — `src/program.ts`.

## Code and tests

- **WA-43** · P3 · ops · Replace the test-matrix waivers with tests — `scripts/test-matrix-untested.ts`.
  [Notes](BACKLOG-NOTES.md#wa-43--replace-the-test-matrix-waivers-with-tests)
- **WA-44** · P3 · ops · Entry points for `src/adapter/` and `src/engine/` (WC-ARCH-8), when tg does the same.
  [Notes](BACKLOG-NOTES.md#wa-44--modules-entered-only-through-their-entry-points-wc-arch-8)
- **WA-45** · P3 · ops · The first test of `src/groups.test.ts` once hit the 5 s timeout; not reproduced.
  [Notes](BACKLOG-NOTES.md#wa-45--a-flaky-first-test-in-srcgroupstestts)
