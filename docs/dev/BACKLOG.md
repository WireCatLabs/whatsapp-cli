# Backlog

Open work, most important first. The plan in flight is
[the foundation plan](https://github.com/WireCatLabs/cli-private/blob/main/plans/2026-10-16-whatsapp-foundation.md) (private).

1. **Live checks of the engine on the owner's number** (NEED-1387: reads, sends only to the own chat): `serve` end to
   end, send to the own LID chat, the lock against a running `serve`, a fresh `session start` keeping the history
   push, `self()` set right after pairing.
3. **A user who gains a LID later.** Their chat would split in two; cli-core cannot re-key a stored chat.
4. **Feature groups**: polls, on-demand older history from the phone. Edit, delete for everyone, reactions,
   mark-read, files, group admin, join requests, profiles, blocking and number lookup are built; what they left open:
   - **Group members are never listed.** cli-core refuses `chats members fetch` and `audit` for a messenger whose
     history is `"store"` (`fromStore` in its `services/chats`), and `chats members list` reads only the stored roster,
     so the adapter's `members` is reached by nothing but `chats moderate`. Fix in cli-core: refuse those two only
     with `--offline`.
   - **Group switches cli-core has no name for**: announcement mode (only admins send), "only admins edit info"
     (WhatsApp's `locked`; cli-core's `onlyOwnerEditsInfo` means the owner alone) and disappearing messages. The
     engine reads them into `providerMetadata`; changing them needs keys in cli-core's `GroupSettings`.
   - **`chats events`.** WhatsApp's joins and leaves come as live notifications, not as history the engine can
     read back, so `chatEvents` is not built.
   - **Admin rights.** A WhatsApp admin has every right; cli-core's `--can` cannot be empty, so `admins add` takes
     the whole list. A messenger flag for "admins have no separate rights" would let it take none.
   - **Group names in a one-shot command.** The engine learns the joined groups only once connected, after cli-core
     resolved the chat, so a connecting command finds a group by its `…@g.us` id, not its name.
   - **The group photo** (`--photo`, whatsmeow's `SetGroupPhoto`) and **communities** are not built.
   - **Live checks** of every group write and of `profile` on a `@lid` person: whatsmeow's `GetUserInfo` has only
     been read, not run, with a LID.
   - **Delete for the owner alone.** whatsmeow has the app-state index (`deleteMessageForMe`) but no builder, so
     `messages delete` without `--for-everyone` is refused rather than built from a guessed patch.
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
   - **Live checks** (with item 1): a reaction and a revoke in a one-to-one chat stored under a LID, and in a group
     addressed by phone numbers; whether one read receipt for the newest message clears the phone's unread count, or
     each unread message needs its own.
5. **Distribution — first publish.** The engine packages, the release steps and the install tests on three systems are
   built (`scripts/engine-packages.mjs`, `release.yml`, `install-windows.yml`) but have not run in CI or published.
   npm's trusted publishing is set per package, and I think a package must exist on npm before it can trust a
   workflow, so the six `@wirecat/whatsapp-engine-*` names probably need a first publish by hand
   (`bin/release --local`) before `release.yml` can publish them.
6. **Join cli-core's parity manifest** (`pnpm parity:seed --cli wa` in cli-core), then turn on `parity:check` in CI.
8. **Replace the test-matrix waivers with tests.** `scripts/test-matrix-untested.ts` waives every shared command as
   tested in cli-core (736 options on 2026-10-16; 23 have wa tests). Each group that gets an engine path gets tests
   through `run()`, and its waiver goes.
9. **A one-shot connection may take messages and drop them.** If WhatsApp hands each queued message to a linked
   device once, a one-shot `messages send` with no `serve` running receives and acknowledges them, and only `serve`
   and `watch` save to the store. Unverified: check live — a message arrives during a one-shot send, then `serve`
   starts — before one-shot connections ship.
10. **Replies in groups name no participant.** A reply sends only the quoted message id; WhatsApp clients also expect
    the quoted sender in groups. The contract has no field for it yet.
11. **The last step of the LID lookup is not built.** The engine maps a phone JID to a LID from whatsmeow's store, the
    history's own mappings and a message's alternate address; a batched `GetUserInfo` request for the rest (plan,
    decision 3) is not done, so such users stay in phone form. Left out on purpose with the groups work: every lookup
    that stores a new mapping (`GetUserInfo`, `IsOnWhatsApp`, `UpdateBlocklist` already do, through `contacts
    profile`, `lookup` and `block`) turns a person's later chats to the LID form, and a chat stored before in phone
    form then splits in two (item 3). Build it with item 3, or only before a chat is first emitted.
12. **cli-core could resolve names from the store for `history: "store"` messengers.** Today it always asks the
    adapter, so the engine keeps its own small chat directory (ARCHITECTURE §4). Raise it in cli-core.
13. **Edits keep the edit's time as the message time.** A live edit carries no original timestamp; check what
    cli-core's store does with an edit's `timestamp` before it shows wrong times.
