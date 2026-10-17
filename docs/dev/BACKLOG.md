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
   profiles, blocking, number lookup, Markdown and polls are built; what they left open:
   - **History votes ride on `watch`.** cli-core's `HistoryBatch` has no votes, so the engine sends a history push's
     votes as `vote` events after it, and only a running `watch` keeps them (`serve` and `session start` run one). Fix
     in cli-core: votes in `HistoryBatch`, saved by `feed`. A vote whose poll the store does not hold yet (a live vote
     racing its poll's save) is dropped.
   - **Live checks of votes**: the owner's vote from the phone on a poll `wa` created in the own chat decrypts and
     counts once as `chosen` (2026-10-17). Still open: a vote from someone else in a group and in a one-to-one chat,
     and the history votes after a fresh link.
   - **Newer poll fields** (`endTime`, `hideParticipantName`, `pollType`, `correctAnswer` on `PollCreationMessage`)
     would map to `--close-time`, `--anonymous` and `--quiz`; whatsmeow does not build them and no WhatsApp client has
     been seen to show them, so they are not used.
   - **Live checks** of `polls vote` from `wa` (one-to-one, group, phone-addressed group): `polls create` in the own
     chat and `--md` sends work (2026-10-17); a vote cast by `wa` has not been run against WhatsApp.
   - **Group members are never listed.** cli-core refuses `chats members fetch` and `audit` for a messenger whose
     history is `"store"` (`fromStore` in its `services/chats`), and `chats members list` reads only the stored roster,
     so the adapter's `members` is reached by nothing but `chats moderate`. Fix in cli-core: refuse those two only
     with `--offline`.
   - **`chats events`.** WhatsApp's joins and leaves come as live notifications, not as history the engine can
     read back, so `chatEvents` is not built.
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
   - **Live checks** (with item 1): a reaction and a revoke in a group addressed by phone numbers (the own LID chat
     works, 2026-10-17); whether one read receipt for the newest message clears the phone's unread count, or
     each unread message needs its own.
6. **Distribution — first publish.** The engine packages, the release steps and the install tests on three systems are
   built (`scripts/engine-packages.mjs`, `release.yml`, `install-windows.yml`) but have not run in CI or published.
   npm's trusted publishing is set per package, and I think a package must exist on npm before it can trust a
   workflow, so the six `@wirecat/whatsapp-engine-*` names probably need a first publish by hand
   (`bin/release --local`) before `release.yml` can publish them.
8. **Replace the test-matrix waivers with tests.** On 2026-10-17, 138 commands and options have a wa test and 638 are
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
    - **No Go check on a pull request.** `go vet`, `go test` and `gofmt` run only in full validation (`ci.yml`), so
      a broken engine first shows on `main`. A Go step in `standards.yml` needs Go set up from `engine/go.mod` and
      stays inside the two-minute `ci:quick` ceiling.
    - **`engine/cmd/wa-engine/groups.go` is over 500 lines** (MODULARITY: split or explain). Biome's cap covers only
      TypeScript.
    - **Two `setup` tests wait for real** (`--timeout 100ms` in `src/commands/setup.test.ts`); a wait goes through an
      injected sleep (cli-base TESTING).
    - **The engine packages carry no third-party notices.** Each ships a binary linking whatsmeow (MPL-2.0) and
      BSD/MIT Go modules, with only wa's own LICENSE beside it; tg ships `THIRD_PARTY_NOTICES`.
    - **Refuse automatic replies.** wa mounts `replies`, and `serve` applies the rules once
      `permissions.replies.send` is `allow`. That sends without a typed command, against local rule 1 and the skill's
      "not for automatic replies", so wa will refuse `replies` and gets no replies page. Waits on a cli-core switch
      that lets a messenger turn the feature off.
