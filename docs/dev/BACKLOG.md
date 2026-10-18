# Backlog

Open work, most important first. The plan in flight is
[the foundation plan](https://github.com/WireCatLabs/cli-private/blob/main/plans/2026-10-16-whatsapp-foundation.md) (private).

1. **Live checks of the engine on the owner's number** (NEED-1387: reads, sends only to the own chat). Done on
   2026-10-17: `serve` receiving a message from the phone and saving it; send, `--md` send, edit, reaction add and
   remove, and delete for everyone in the own LID chat, all through a running `serve`. Still open: a fresh
   `session start` keeping the history push (the owner runs `bin/live-fresh-link`), `self()` set right after
   pairing.
9. **A one-shot connection may take messages and drop them.** If WhatsApp hands each queued message to a linked
   device once, a one-shot `messages send` with no `serve` running receives and acknowledges them, and only `serve`
   and `watch` save to the store. Unverified: check live — a message queued while nothing is connected, one
   one-shot connection, then `serve`. The owner runs `bin/live-oneshot-drop` for it; a message arriving during a
   longer one-shot `messages send` is not covered by it.
3. **A user who gains a LID later.** Their chat would split in two; cli-core cannot re-key a stored chat.
4. **Older history from the phone: live checks.** `messages sync <chat>` asks the phone since cli-core 0.316.0
   (`historyOnDemand`), tested end to end with the fake engine; `--all` keeps refusing, as wa has no chat list to walk.
   **Live (2026-10-17, own chat, through `serve`):** with the app in the background the phone sent nothing for 75 s;
   once the owner opened WhatsApp it answered the queued requests (2 older messages, saved by `serve` as a history
   push because no request was waiting any more), and a new request then got an empty answer — the chat's true start,
   confirmed by the owner. So the LID form of the own chat works. **Built (2026-10-18):** more than 50 is cli-core's
   paging, 50 per page, 2 s apart, each page counting back from the last one's oldest (pinned through `run()` in
   `src/older-history.test.ts`); within a page the engine asks again from the oldest message the phone sent when it
   sent fewer than asked (at most three asks, 1 s apart, 25 s in all); each request goes under an id the engine
   chose, and an answer whose `PeerDataRequestSessionID` names it is credited to it, one naming an earlier request
   is saved as a history push, and any other is matched by its chat as before. Still open, live (NEED-1387, own chat
   only; scenario H1 in [live-scenarios.md](live-scenarios.md), which the owner runs with
   `bin/live-older-history`): whether a 50-message answer comes in one `ON_DEMAND` notification or several;
   whether `PeerDataRequestSessionID` equals the request's id (mautrix-whatsapp logs both and matches neither); whether the phone finds a chat named by its LID when it knows it by phone number. cli-core
   sets `fetched:<chat>` on the first page of a run without `before`, read only for its time (`stats` `fetched_at`,
   the search's oldest fetch); for wa that page counts back from the oldest stored message, not the chat's newest —
   reported to the lead for cli-core to decide.
5. **Feature groups**: edit, delete for everyone, reactions, mark-read, files, group admin, join requests,
   profiles, blocking, number lookup, Markdown, polls, message pins, chat mute, chat delete/clear and the own name
   and about are built; what they left open:
   - **A live vote that races its poll is dropped.** History votes go into the store with the push that carries
     them (cli-core 0.322.0); a live vote whose poll the store does not hold yet is passed over.
   - **Live checks of votes**: the owner's vote from the phone on a poll `wa` created in the own chat decrypts and
     counts once as `chosen` (2026-10-17). Still open: a vote from someone else in a group and in a one-to-one chat,
     and the history votes after a fresh link.
   - **Newer poll fields** (`endTime`, `hideParticipantName`, `pollType`, `correctAnswer` on `PollCreationMessage`)
     would map to `--close-time`, `--anonymous` and `--quiz`; whatsmeow does not build them and no WhatsApp client has
     been seen to show them, so they are not used.
   - **Live checks** of `polls vote` from `wa` (one-to-one, group, phone-addressed group): `polls create` in the own
     chat and `--md` sends work (2026-10-17); a vote cast by `wa` has not been run against WhatsApp
     (the owner runs `bin/live-poll-vote` for it, in the own chat).
   - **`chats events`.** WhatsApp's joins and leaves come as live notifications, not as history the engine can
     read back. cli-core 0.336.0 answers `chats events` from the store (`HistoryBatch.events`, the `chat_event`
     watch event); the engine does not push them yet, so it always shows nothing.
   - **Names of groups the store lacks, in a one-shot command.** cli-core finds a stored group by name (0.337.0);
     for one the store does not hold, the engine learns the joined groups only once connected, after cli-core asked
     for the name, so such a group is found by its `…@g.us` id only.
   - **Removing a group's photo** (whatsmeow's `SetGroupPhoto` with no bytes) waits for a cli-core option;
     `chats update --photo` sets one.
   - **Communities: only the read of one group.** A group read from WhatsApp carries its community as cli-core's
     `parentChatId` and a community carries `providerMetadata.community` (engine protocol 15). Still open: the store
     gets chats only from history pushes, and `convert.go` does not read the pushed conversation's
     `GetParentGroupID`, `GetIsParentGroup` and `GetIsDefaultSubgroup` yet, so `chats list` and `chats show` lack them. Listing a community's
     groups (`GetSubGroups`, which also names groups the owner is not in), linking and unlinking (`LinkGroup`,
     `UnlinkGroup`) and creating a group in a community (`ReqCreateGroup.LinkedParentJID`) wait for cli-core: a
     `parent_chat_id` field in the chat-list query, a `GroupAdmin` method for link and unlink behind the send guard,
     and a store upsert that can clear a parent once a group is unlinked.
   - **Live checks** of every group write and of `profile` on a `@lid` person: whatsmeow's `GetUserInfo` has only
     been read, not run, with a LID.
   - **Live checks of the chat-state writes** in the own chat: `account privacy show`, `chats mute` and `unmute`,
     `messages pin` and `unpin`, and delete for the owner alone (W6). The owner runs `bin/live-chat-state` for them;
     its last table names the line of this item each answer settles, and it skips what is not built yet.
   - **Live checks of `chats mute`**: not run against WhatsApp. Open: whether the phone applies a mute addressed
     to a one-to-one chat by its LID when it keys that chat by phone number (whatsmeow maps neither way), and how
     soon after a fresh link the settings keys arrive. Channels are refused; whatsmeow's `NewsletterToggleMute`
     would mute one, without an end time.
   - **The store does not learn of a mute.** Nothing updates a chat's `muted` after `chats mute`, and the engine
     reads no live mute events, so `inbox` leaves the chat in until the next history push. That push may read it
     wrong too: `convert.go` takes `muteEndTime > 0` as seconds, while a mute for good is -1 in app state and the
     history field is unsigned — whether the phone writes it as all ones, and in which unit, is not checked.
   - **The own profile photo** (`account update --photo`) is refused. whatsmeow has no own-photo call, but
     `SetGroupPhoto(ctx, types.EmptyJID, jpeg)` sends the request Baileys' `updateProfilePicture` sends for the own
     picture (no `target`). It needs the square-JPEG check `groupPhoto` from `chats update --photo` (PR #55); build it
     on that once both are in.
   - **Live checks of `account update`**: not run against WhatsApp. Open: when others see a new name, since `wa`
     sends no presence and WhatsApp learns a name from one; whether `SetStatusMessage` with no duration keeps the
     about for good (whatsmeow sends `ephemeral_duration_sec: 0`, and none of its callers sets one); whether the
     phone refuses an empty about (the engine refuses it first).
   - **Live checks of `chats delete` and `chats clear`**: not run against WhatsApp. Open, as for mute: a one-to-one
     chat addressed by its LID; and whether the phone deletes up to the named message when newer ones arrived
     that the store has not heard of yet (the patch should leave those).
   - **Live checks of `chats archive`, `unarchive`, `pin`, `unpin` and `mark-unread`**: not run against WhatsApp.
     Open, as for mute: a one-to-one chat addressed by its LID. Also: whether the phone shows a fourth pinned chat
     (its apps keep three; the server cannot read a patch to refuse one); whether pinning an archived chat unarchives
     it (whatsmeow's, Baileys' and whatsapp-rust's pin patches carry no unarchive); whether `chats mark-read`, which
     sends a read receipt and no app-state patch, clears a mark-unread on the phone; and whether an archived chat comes
     back when a message newer than the patch's range arrives.
   - **`chats mark-read` after a `mark-unread`.** `mark-read` sends a read receipt only; the app-state patch that
     undoes a mark-unread is the same one with read true (whatsmeow's `BuildMarkChatAsRead`). If the live
     check shows the receipt leaves the mark, `mark-read` also sends that patch. Open then: a second write that can
     fail with `settings.keys-missing` after the receipt went out, and `inbox`/`review --mark-read` doing it per chat.
   - **An archive or mark-unread with nothing stored.** Baileys accepts an empty message range, whatsapp-rust calls
     one safe, and whatsmeow fills in the current time; `wa` still refuses a chat the store holds nothing of, as
     `chats delete` does. Sending an empty range is an option once a live check shows the phone takes it.
   - **The store keeps a deleted chat.** cli-core's `chats delete` and `chats clear` leave the local store as it is,
     so `messages list` and `search` still show what was deleted (queued to cli-core); the engine also ignores
     whatsmeow's `DeleteChat` and `ClearChat` events, so a deletion made on the phone does not reach the store either.
   - **Live check of delete for the owner alone.** `messages delete` without `--for-everyone` sends a hand-built
     `deleteMessageForMe` patch, pinned against WhatsApp Web's own module, Cobalt and whatsapp-rust, but not yet sent
     to WhatsApp. Open: that the phone drops a message from someone else in a group (the participant field), one in a
     one-to-one chat, and the owner's own; and that it keeps the saved files. wa sends the chat id the store holds as
     it is. WhatsApp Web, once the account's one-to-one chats moved to LIDs, writes a chat stored by phone number as
     its LID instead (`WAWebSyncdGetChat.getChatJidMutationIndexForChat`), so a chat the store holds by phone number
     may be dropped; one held by its LID matches.
   - **Live check of starring.** `messages star` and `unstar` send a hand-built `star` patch, pinned against WhatsApp
     Web's `WAWebStarMessageSync`, Cobalt and whatsapp-rust, but not yet sent to WhatsApp. Open: that the phone shows
     and drops the star on someone else's message in a group (the participant field), one in a one-to-one chat, and the
     owner's own. A chat the store holds by phone number may be dropped, as with delete for the owner alone.
   - **The store does not know what is starred.** cli-core's `Message` has no star and the engine ignores whatsmeow's
     `events.Star`, so neither a star from `wa` nor one from the phone reaches the store, and nothing lists starred
     messages. Both need cli-core first.
   - **A delete for the owner alone made on the phone does not reach the store.** The engine ignores whatsmeow's
     `events.DeleteForMe`, so `messages list` and `search` still show the message. cli-core already takes an
     incoming deletion event and marks the message deleted; the engine only has to map this one to it.
   - **Messages stored before files were.** A photo with a caption stored by an older `wa` has the caption and no
     attachment, so `messages forward` sends the caption alone and `messages download` finds nothing. The phone does
     not push history again; a re-link would refill it.
   - **Files WhatsApp no longer keeps.** A download asks the owner's phone to upload the file again and fetches the new
     copy, but the new path is not kept: cli-core's store has no write for a stored attachment's `providerRef`, so each
     later download asks the phone again, and a forward still sends the old path, which reaches the recipient as a
     file that will not open. The fix is a cli-core port to update a stored attachment's ref. Not yet run against
     WhatsApp: whether the phone answers a receipt for a one-to-one chat addressed by LID.
   - **Forwarding several contact cards** (`ContactsArrayMessage`) and a live location is refused; a place or a card
     stored before `wa` kept their content too.
   - **Media leftovers**: files to channels; `metadata refresh` for a channel (`group` reads groups only).
   - **Albums: only the first file is stored.** An album goes as an `AlbumMessage`, then each file as a plain photo
     or video tied to it by `MessageAssociation` (`MEDIA_ALBUM`), but cli-core's `Sent` holds one message, so the
     store keeps the photo's message and not the others; WhatsApp is not seen to echo a device's own sends back to
     it. The fix is in cli-core (a send that answers several messages). cli-core also passes at most one `--photo`
     and one `--file`, so an album has two files. Receiving: an album's announcement is dropped, and each file is
     stored as its own message if the apps send it unwrapped; one wrapped in `associatedChildMessage` would be dropped.
   - **Live check of an album**: whether WhatsApp accepts the album and its apps group the files has not been run.
     The shape matches Baileys 7.0.0-rc14, the one open-source sender found (`lib/Utils/messages.js`, `album` and
     `albumParentKey`): each file is a plain photo or video whose `messageContextInfo.messageAssociation` is
     `MEDIA_ALBUM` with the parent key `{remoteJid, fromMe: true, id}`. Baileys, like whatsmeow, sends the
     `AlbumMessage` with stanza type `text`. whatsmeow and mautrix-whatsapp only read albums.
   - **No preview on a sent video.** A photo carries a 72-pixel JPEG preview; a video needs a frame decoder, and the
     engine has no pure-Go one (no cgo, no ffmpeg), so a video goes without one. A WEBP photo too: the standard
     library does not decode WEBP. The preview ignores a JPEG's EXIF orientation, so a phone photo taken on its side
     may show a turned preview until the photo downloads.
   - **Message pins**: a pin that arrives (live or in a push) is skipped, so the store does not know what is pinned.
     Over MCP, an `expire_time` WhatsApp does not offer is refused only after the engine started (cli-core checks it
     inside the tool's online step). Live check open: a pin and an unpin in the own chat and in a group addressed by
     phone numbers, and that a 24-hour pin ends on the phone.
   - **Live checks** (with item 1): a reaction and a revoke in a group addressed by phone numbers (the own LID chat
     works, 2026-10-17); whether one read receipt for the newest message clears the phone's unread count, or
     each unread message needs its own.
   - **Live checks of `account privacy`**: `show` and `set` have run only against the fake engine. Open: whether
     `calladd` `known` is the phone's "silence unknown callers" (Baileys says "mute unknown calls",
     WhiskeySockets/Baileys#872), and whether WhatsApp really refuses `groupadd` `none` (Baileys#966 says so, so
     `--chat-invites nobody` is refused up front; whatsmeow still lists it).
     Also open: that `status` is the about text's audience and `profile` the photo's, that `readreceipts` `none`
     also hides others' receipts from the owner, and that `chats mark-read` with receipts off clears the phone's
     unread count (whatsmeow then sends `read-self`, `receipt.go`). cli-core 0.336 has no "contacts except" for
     `chatInvites`, so such a groups setting is left out of `show`; asked of cli-core (upstream queue, S1).
6. **Distribution — releases from CI.** 0.1.0 of `@wirecat/whatsapp-cli` and the six `@wirecat/whatsapp-engine-*`
   packages was published by hand with `bin/release --local` (`npm view` lists 0.1.0 for all seven). Next, the owner
   sets npm's trusted publishing on each of the seven packages, so later releases go through `release.yml`, which has
   not published yet. The install tests on three systems (`install-windows.yml`) have run once, by hand.
8. **Replace the test-matrix waivers with tests.** On 2026-10-18, after a third round, 199 commands and options have a
   wa test and 525 are waived in `scripts/test-matrix-untested.ts`. The group wildcards for `messages`, `chats`, `contacts`, `account`
   and `doctor` are gone: every waiver there names its command and the cli-core test that covers it, so a new
   subcommand shows up as missing. Each command that gets an engine path gets tests through `run()`, and its waiver
   goes. A `store gaps repair --background` job never runs: cli-core 0.336.0 hands it `--timeout 0`, which the job
   refuses. `src/older-history.test.ts` asserts that refusal, so it fails once cli-core is fixed.
11. **The last step of the LID lookup is not built.** The engine maps a phone JID to a LID from whatsmeow's store, the
    history's own mappings and a message's alternate address; a batched `GetUserInfo` request for the rest (plan,
    decision 3) is not done, so such users stay in phone form. Left out on purpose with the groups work: every lookup
    that stores a new mapping (`GetUserInfo`, `IsOnWhatsApp`, `UpdateBlocklist` already do, through `contacts
    profile`, `lookup` and `block`) turns a person's later chats to the LID form, and a chat stored before in phone
    form then splits in two (item 3). Build it with item 3, or only before a chat is first emitted.
13. **Standards gaps left by the 2026-10-17 audit** (the handbook's areas, where a fix needs design):
    - **Modules entered only through their entry points** (WC-ARCH-8): `src/adapter/` and `src/engine/` have no
      `index.ts`, and `biome.json` lets the composition root import any file in them. Add the rule when tg does, so
      both name their entry points the same way.
14. **How long WhatsApp's rate limit and a ban hold writes is the owner's to set** (WC-PERM-18). WhatsApp's 429 says
    neither how long to wait nor whether reads count, and a ban says nothing about the account's standing. The lead's
    default, under the owner's autonomy mandate: after a 429, every write is held 15 minutes and reads go on; after a
    ban, writes are held until the end WhatsApp gives it, or until `flood clear` or a `doctor --online` that connects
    when it gives none (`src/adapter/errors.ts`). Open: the 15 minutes, and whether reads should pause too.
15. **`serve`'s restarts need cli-core** (found 2026-10-18, ARCHITECTURE §4). A unit restarts `serve` by exit code
    only (cli-core's `noRestartOn`), and `device.replaced`, `client.outdated` and a crashed engine all exit 12. So
    after another connection takes the login over, the unit starts `serve` again 30 s later and takes it back, and
    the two push each other off; after `outdated` it restarts for nothing. Needs cli-core: no-restart by reason, or
    a way for an adapter to give an ending its own exit. Also cli-core's: no cap on restarts (`RestartSec=30`, so
    systemd's start limit never trips), no restart on macOS once `noRestartOn` is set (launchd cannot exclude one
    code), none for a `serve` started by hand, and no way to open the connection again inside `serve`.
