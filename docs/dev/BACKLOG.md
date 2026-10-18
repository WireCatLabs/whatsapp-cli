# Backlog

Open work, most important first. The plan in flight is
[the foundation plan](https://github.com/WireCatLabs/cli-private/blob/main/plans/2026-10-16-whatsapp-foundation.md) (private).

1. **Live checks of the engine on the owner's number** (NEED-1387: reads, sends only to the own chat). Done on
   2026-10-17: `serve` receiving a message from the phone and saving it; send, `--md` send, edit, reaction add and
   remove, and delete for everyone in the own LID chat, all through a running `serve`. Still open: a fresh
   `session start` keeping the history push, `self()` set right after pairing.
3. **A user who gains a LID later.** Their chat would split in two; cli-core cannot re-key a stored chat.
4. **Older history from the phone: live checks.** `messages sync <chat>` asks the phone since cli-core 0.316.0
   (`historyOnDemand`), tested end to end with the fake engine; `--all` keeps refusing, as wa has no chat list to walk.
   **Live (2026-10-17, own chat, through `serve`):** with the app in the background the phone sent nothing for 75 s;
   once the owner opened WhatsApp it answered the queued requests (2 older messages, saved by `serve` as a history
   push because no request was waiting any more), and a new request then got an empty answer — the chat's true start,
   confirmed by the owner. So the LID form of the own chat works. Still open: a chat with more than 50 older messages
   (one chunk or several), and matching by `PeerDataRequestSessionID` so a late answer is credited to its request.
   Ask cli-core what reads `fetched:<chat>` (`completeness.ts` uses only its time): wa's first page is the one before
   the oldest stored message, not the newest. Live checks before calling it done (NEED-1387, own chat only): whether
   the phone finds a chat named by its LID when it knows it by phone number; whether a 50-message answer comes in one
   `ON_DEMAND` chunk; whether the notification's `PeerDataRequestSessionID` equals the request's message id, which
   would match an answer more surely than its chat.
5. **Feature groups**: edit, delete for everyone, reactions, mark-read, files, group admin, join requests,
   profiles, blocking, number lookup, Markdown, polls and message pins are built; what they left open:
   - **A live vote that races its poll is dropped.** History votes go into the store with the push that carries
     them (cli-core 0.322.0); a live vote whose poll the store does not hold yet is passed over.
   - **Live checks of votes**: the owner's vote from the phone on a poll `wa` created in the own chat decrypts and
     counts once as `chosen` (2026-10-17). Still open: a vote from someone else in a group and in a one-to-one chat,
     and the history votes after a fresh link.
   - **Newer poll fields** (`endTime`, `hideParticipantName`, `pollType`, `correctAnswer` on `PollCreationMessage`)
     would map to `--close-time`, `--anonymous` and `--quiz`; whatsmeow does not build them and no WhatsApp client has
     been seen to show them, so they are not used.
   - **Live checks** of `polls vote` from `wa` (one-to-one, group, phone-addressed group): `polls create` in the own
     chat and `--md` sends work (2026-10-17); a vote cast by `wa` has not been run against WhatsApp.
   - **`chats events`.** WhatsApp's joins and leaves come as live notifications, not as history the engine can
     read back. cli-core 0.336.0 answers `chats events` from the store (`HistoryBatch.events`, the `chat_event`
     watch event); the engine does not push them yet, so it always shows nothing.
   - **Group names in a one-shot command.** The engine learns the joined groups only once connected, after cli-core
     resolved the chat, so a connecting command finds a group by its `…@g.us` id, not its name.
   - **The group photo** (`--photo`, whatsmeow's `SetGroupPhoto`) and **communities** are not built.
   - **Live checks** of every group write and of `profile` on a `@lid` person: whatsmeow's `GetUserInfo` has only
     been read, not run, with a LID.
   - **Delete for the owner alone.** whatsmeow has the app-state index (`deleteMessageForMe`) but no builder, so
     `messages delete` without `--for-everyone` is refused rather than built from a guessed patch. Until it is built,
     `WHATSAPP.deleteForMe` is `false`, so an agent's MCP delete is refused; building it means setting that to `true`.
   - **Messages stored before files were.** A photo with a caption stored by an older `wa` has the caption and no
     attachment, so `messages forward` sends the caption alone and `messages download` finds nothing. The phone does
     not push history again; a re-link would refill it.
   - **Files WhatsApp no longer keeps.** A download of an expired file is `not_found`; WhatsApp's apps ask the sender's
     phone to upload it again (whatsmeow's `SendMediaRetryReceipt`), which is not built. A forward of one reaches the
     recipient as a file that will not open.
   - **`watch --jsonl` prints a file's keys.** cli-core's watch writes the message as the adapter gave it, `providerRef`
     included, while every other answer leaves it out (`messageItem`). The keys are needed for the store, so the fix
     is in cli-core's watch output, not here.
   - **Media leftovers**: albums (one file per message here), thumbnails on sent photos and videos, files to
     channels, forwarding a place or a contact card, `metadata` (needs the group read).
   - **Message pins**: a pin always lasts 7 days (cli-core's `messages pin` has no duration to pass 24 hours or 30
     days); a pin that arrives (live or in a push) is skipped, so the store does not know what is pinned. Live check
     open: a pin and an unpin in the own chat and in a group addressed by phone numbers.
   - **Live checks** (with item 1): a reaction and a revoke in a group addressed by phone numbers (the own LID chat
     works, 2026-10-17); whether one read receipt for the newest message clears the phone's unread count, or
     each unread message needs its own.
6. **Distribution — first publish.** The engine packages, the release steps and the install tests on three systems are
   built (`scripts/engine-packages.mjs`, `release.yml`, `install-windows.yml`) but have not run in CI or published.
   npm's trusted publishing is set per package, and I think a package must exist on npm before it can trust a
   workflow, so the six `@wirecat/whatsapp-engine-*` names probably need a first publish by hand
   (`bin/release --local`) before `release.yml` can publish them.
8. **Replace the test-matrix waivers with tests.** On 2026-10-18, 132 commands and options have a wa test and 591 are
   waived in `scripts/test-matrix-untested.ts`. The group wildcards for `messages`, `chats`, `contacts`, `account`
   and `doctor` are gone: every waiver there names its command and the cli-core test that covers it, so a new
   subcommand shows up as missing. Each command that gets an engine path gets tests through `run()`, and its waiver
   goes.
9. **A one-shot connection may take messages and drop them.** If WhatsApp hands each queued message to a linked
   device once, a one-shot `messages send` with no `serve` running receives and acknowledges them, and only `serve`
   and `watch` save to the store. Unverified: check live — a message arrives during a one-shot send, then `serve`
   starts — before one-shot connections ship.
11. **The last step of the LID lookup is not built.** The engine maps a phone JID to a LID from whatsmeow's store, the
    history's own mappings and a message's alternate address; a batched `GetUserInfo` request for the rest (plan,
    decision 3) is not done, so such users stay in phone form. Left out on purpose with the groups work: every lookup
    that stores a new mapping (`GetUserInfo`, `IsOnWhatsApp`, `UpdateBlocklist` already do, through `contacts
    profile`, `lookup` and `block`) turns a person's later chats to the LID form, and a chat stored before in phone
    form then splits in two (item 3). Build it with item 3, or only before a chat is first emitted.
12. **cli-core could resolve names from the store for `history: "store"` messengers.** Today it always asks the
    adapter, so the engine keeps its own small chat directory (ARCHITECTURE §4). Raise it in cli-core.
13. **Standards gaps left by the 2026-10-17 audit** (the handbook's areas, where a fix needs design):
    - **The engine links `go.mau.fi/libsignal`, which is GPL-3.0**, through whatsmeow (`engine/THIRD_PARTY_NOTICES`),
      while the engine packages declare Apache-2.0. What licence the shipped binary carries, and what source offer it
      needs, is the owner's decision.
    - **Two `setup` tests wait for real** (`--timeout 100ms` in `src/commands/setup.test.ts`); a wait goes through an
      injected sleep (cli-base TESTING).
    - **Modules entered only through their entry points** (WC-ARCH-8): `src/adapter/` and `src/engine/` have no
      `index.ts`, and `biome.json` lets the composition root import any file in them. Add the rule when tg does, so
      both name their entry points the same way.
    - **`engine/cmd/wa-engine/engine.go` holds six jobs in 573 lines** (WC-LAY-8): request dispatch, linking, the chat
      directory, sends, event handling and error sorting. Split linking, the directory and events into their own files
      when the next change touches one of them. Nothing caps a Go file's length, as Biome caps a TypeScript file.
    - **The test-matrix argv log misses `--version`** (WC-ARCH-4): cli-core's `run()` logs each parsed command from a
      `preAction` hook, which `--version` never reaches, so `run()` in `src/program.ts` still appends that one line.
      It belongs in cli-core.
14. **How long WhatsApp's rate limit and a ban hold writes is the owner's to set** (WC-PERM-18). WhatsApp's 429 says
    neither how long to wait nor whether reads count, and a ban says nothing about the account's standing. The lead's
    default, under the owner's autonomy mandate: after a 429, counted writes are held 15 minutes and reads go on; after
    a ban, writes are held until the end WhatsApp gives it, or until `doctor --online` connects again when it gives
    none (`src/adapter/errors.ts`). Open:
    - the 15 minutes, and whether reads should pause too;
    - a ban is reported as cli-core's `frozen` (the only standing that both holds writes and is lifted by
      `doctor --online`), not `banned`, which cli-core never holds on;
    - cli-core keeps no hold without an end, so a ban WhatsApp gives no end for is held a year on;
    - cli-core holds only the writes it counts toward the send limit: a reaction or a read receipt still goes during a
      hold (seen in a test on 2026-10-17), though WhatsApp probably counts them against a limited account too.
