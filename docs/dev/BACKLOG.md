# Backlog

Open work, most important first. The plan in flight is
[the foundation plan](https://github.com/WireCatLabs/cli-private/blob/main/plans/2026-10-16-whatsapp-foundation.md) (private).

1. **Live checks of the engine on the owner's number** (NEED-1387: reads, sends only to the own chat). Done on
   2026-10-17: `serve` receiving a message from the phone and saving it; send, `--md` send, edit, reaction add and
   remove, and delete for everyone in the own LID chat, all through a running `serve`. Still open: a fresh
   `session start` keeping the history push (the owner runs `bin/live-fresh-link`), `self()` set right after
   pairing.
9. **A one-shot connection takes queued messages and drops them.** WhatsApp hands each queued message to a linked
   device once, and only cli-core's `watch` and `feed` save to the store. **Live (2026-10-18, own chat, main
   086622f):** the owner ran `bin/live-oneshot-drop`. The message queued while nothing was connected was 0 by search
   and 0 among the own chat's newest 50, after one `doctor --online` and a restarted `serve`; the control sent while
   `serve` ran was found (1 and 1). So a one-shot connection takes queued messages and they never reach the store.
   Cause: the engine emits them, `wa` keeps an event nobody listens for in memory (`src/engine/events.ts:17`), a
   one-shot command never reads it, and whatsmeow has already sent the receipt that tells WhatsApp it arrived
   ([`message.go:489-496`](https://github.com/tulir/whatsmeow/blob/df33a485cc46/message.go#L489-L496), the version
   in `engine/go.mod`). **Built (2026-10-18):** cli-core 0.343.0 lets every connection that does not watch save what
   arrives (`PassiveUpdates.listen`), and wa's adapter implements it over `engine.listen`: the same events as `watch`,
   without connecting. `session end` ends that listen quietly, since the logout it asked for is not a failure. Tested
   with the fake engine (`src/oneshot-listen.test.ts`). Left: the live re-check, the owner's `bin/live-oneshot-drop`
   (NEED-1387, own chat only). **History pushes, built (2026-10-19, RISK-1258 = A):** cli-core 0.348.0 adds
   `PassiveUpdates.listenHistory`; the adapter implements it with `feed`'s handler (re-keys first) and the same
   logout check as `listen`. The engine now downloads history itself (`ManualHistorySyncDownload`, receipt unchanged,
   `historysync.go`), and close waits up to 3 s for a push still downloading, inside the CLI's 5 s close budget.
   Tested with the fake engine and Go tests; the live re-check is left. Not verified: a push announced after that wait
   ends and before the disconnect is still lost. **Before this (2026-10-18), kept for the research:** a history push
   received by a one-shot connection was dropped, and
   nothing asks the phone to send it again — whatsmeow sends the `hist_sync` receipt as soon as the notification arrives
   ([`message.go:899-906`](https://github.com/tulir/whatsmeow/blob/df33a485cc46/message.go#L899-L906)) and deletes the
   blob from WhatsApp's servers once it is handed on (`message.go:735-736`); re-keys are covered, as the engine
   repeats them at each start (ARCHITECTURE §5). Possible levers, untried: `ManualHistorySyncDownload` with
   `DisableManualHistorySyncReceipt` to hold the receipt back on a one-shot connection, or
   `SendHistorySyncServerErrorReceipt` to ask the phone to upload a push again; either needs a cli-core port that
   hands a one-shot connection's history on, as `listen` hands only messages.
3. **A user who gains a LID later: live check.** Built: the engine announces the re-key (ARCHITECTURE §5) and the
   adapter's `feed` hands it to cli-core's `HistoryBatch.rekeys` (cli-core 0.336.0), tested end to end with the fake
   engine. Left: a live case — a person in phone form who gains a LID — has not been seen yet; the store should then
   hold their chat once, under the LID.
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
5. **Feature groups**: edit, delete for everyone and for the owner alone, reactions, mark-read, files and albums,
   group admin and the group photo, join requests, profiles, blocking, number lookup, Markdown, polls, message pins
   and stars, chat mute, archive, pin, mark-unread, delete and clear, the own name, about and photo, and privacy are built;
   what they left open:
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
   - ~~**`chats events`**~~ — built: live `events.GroupInfo` and the history push's group service messages go to
     cli-core's store (engine protocol 33). Still open: a live check that a push's service messages carry the people
     as the protobuf says (the owner runs `bin/live-chat-events`), the owner's own join or add, which whatsmeow
     sends live as `events.JoinedGroup` (only a history push records it), and `member_stays`, which cli-core does
     not fill from events yet. A live removal whose notification names no sender is a `leave`, while the push's
     `GROUP_PARTICIPANT_REMOVE` stub is a `remove`, so that change gets two ids and two rows; which one the sender-less
     notification is has not been seen. Stub types not read yet (their parameters have not been seen):
     `GROUP_PARTICIPANT_ACCEPT`, `_ADD_REQUEST_JOIN`, `_JOINED_GROUP_AND_PARENT_GROUP` and `_CHANGE_NUMBER`,
     `COMMUNITY_PARTICIPANT_PROMOTE` and `_DEMOTE`, and the `*_RICH` variants.
   - **Names of groups the store lacks, in a one-shot command.** cli-core finds a stored group by name (0.337.0);
     for one the store does not hold, the engine learns the joined groups only once connected, after cli-core asked
     for the name, so such a group is found by its `…@g.us` id only.
   - ~~**Removing a group's photo**~~ — built: `chats update --remove-photo` (cli-core 0.340.0).
   - **Stickers from a file: live check and the limits.** `messages send --sticker-file` (cli-core 0.340.0) uploads
     the `.webp` as an image and sends a `StickerMessage`, with the canvas read from the file's first chunk. A square
     512×512 still sticker of 7.6 KB shows on the phone as a sticker, at the right size and shape (own chat,
     2026-10-18, `bin/live-chat-state` step 9); a non-square one, a still one over 100 KB and an animated one are not
     checked. One cap, 500 KiB, lets an animated sticker through: Meta's Cloud API caps a
     still one at 100 KB, and whether a phone shows a larger still sticker is unknown. `isAnimated` is not set.
     The `.webp` goes as it is: mautrix-whatsapp pads a non-square one to a square and adds a PNG thumbnail before
     sending, and whether a phone shows a non-square sticker well is unknown.
     A sticker to a channel is refused until a channel post's sticker (URL, no key) is seen working.
   - **Communities: only the read of one group.** A group read from WhatsApp carries its community as cli-core's
     `parentChatId` and a community carries `providerMetadata.community` (engine protocol 15); a history push carries
     the same two from the conversation's `ParentGroupID` and `IsParentGroup`, so the store has them. Not seen on a
     live push yet; `IsDefaultSubgroup` (the announcement group) is not carried, as no live read carries it. Listing a community's
     groups (`GetSubGroups`, which also names groups the owner is not in), linking and unlinking (`LinkGroup`,
     `UnlinkGroup`) and creating a group in a community (`ReqCreateGroup.LinkedParentJID`) wait for cli-core: a
     `parent_chat_id` field in the chat-list query and a `GroupAdmin` method for link and unlink behind the send guard.
     **Built (2026-10-19, cli-core 0.348.0):** WhatsApp's unlink notification (`events.GroupInfo.Unlink`, on the
     group's own side) is pushed as a chat with only `jid`, `kind` and `parent: null`, so the store clears the parent
     and keeps the title, counts and last activity. Not verified live: which side of an unlink a member's device
     receives (the community's `sub_group` side is ignored). The link notification (`Link`, `parent_group` side) is
     read the same way and sets the parent to the community.
     `community` stays true-only: a community does not turn back into a plain group.
   - **Live checks** of every group write and of `profile` on a `@lid` person: whatsmeow's `GetUserInfo` has only
     been read, not run, with a LID.
   - **Live checks of the chat-state writes** in the own chat (2026-10-18, `bin/live-chat-state`): `account privacy
     show`, `chats mute` and `unmute` of the own chat by its LID, `messages pin --expire-time 24h` and `unpin`,
     `messages star` and `unstar` of the owner's own message, `chats pin` and `unpin`, `chats archive` and `unarchive`,
     `chats mark-unread` and delete for the owner alone all show on the phone. `chats mark-read` did not take the
     mark-unread off: it sent no read patch, and in the own chat no receipt either. It now sends the patch first;
     a live re-check (step 7) is open.
   - **Live checks of `chats mute`**: the own chat, addressed by its LID, mutes and unmutes (2026-10-18). Open:
     whether the phone applies a mute addressed to a one-to-one chat with someone else by its LID when it keys that
     chat by phone number (whatsmeow maps neither way), and how soon after a fresh link the settings keys arrive.
     Channels are refused; whatsmeow's `NewsletterToggleMute` would mute one, without an end time.
   - **The store does not learn of a mute.** Nothing updates a chat's `muted` after `chats mute`, and the engine
     reads no live mute events, so `inbox` leaves the chat in until the next history push. That push now reads any
     end past the year 9999 (a -1 in the unsigned field) as a mute for good; whether the phone writes it as all ones,
     and whether a timed end is in seconds, is not checked live.
   - **The own profile photo** (`account update --photo`). **Built (2026-10-18):** whatsmeow has no own-photo call;
     `SetGroupPhoto(ctx, types.EmptyJID, jpeg)` sends no `target`, the request Baileys' `updateProfilePicture` sends
     for the own picture, after the square-JPEG check `chats update --photo` uses. Removing it waits, as for a group.
     **Live check** (not run): `account update --photo` with a 640-pixel square JPEG, through `serve`; the phone shows
     the new photo, and whether WhatsApp takes the 190 and 720 pixel ends for an own photo as it does for a group's.
   - **Live checks of `account update`**: not run against WhatsApp. Open: when others see a new name, since `wa`
     sends no presence and WhatsApp learns a name from one; whether `SetStatusMessage` with no duration keeps the
     about for good (whatsmeow sends `ephemeral_duration_sec: 0`, and none of its callers sets one); whether the
     phone refuses an empty about (the engine refuses it first).
   - **Live checks of `chats delete` and `chats clear`**: not run against WhatsApp. Open, as for mute: a one-to-one
     chat addressed by its LID; and whether the phone deletes up to the named message when newer ones arrived
     that the store has not heard of yet (the patch should leave those).
   - **Live checks of `chats archive`, `unarchive`, `pin`, `unpin` and `mark-unread`**: the own chat works
     (2026-10-18). Open, as for mute: a one-to-one chat with someone else addressed by its LID, and a group. Also:
     whether the phone shows a fourth pinned chat (its apps keep three; the server cannot read a patch to refuse one);
     whether pinning an archived chat unarchives it (whatsmeow's, Baileys' and whatsapp-rust's pin patches carry no
     unarchive); and whether an archived chat comes back when a message newer than the patch's range arrives.
   - **`chats mark-read` sends the read patch, then the receipt.** The live check showed a read receipt does not take
     a mark-unread off (2026-10-18), so `mark-read` first sends whatsmeow's `BuildMarkChatAsRead` with read true, up to
     `--until-id` or the newest stored message, then the receipt as before. A refusal for missing settings keys comes
     before the receipt, so nothing goes out; `inbox` and `review --mark-read` stop on it too, where they marked read
     before the keys arrived. Each chat they mark costs one more write, whether or not the phone held it unread: the
     store does not know. A chat the store holds nothing of gets neither. Open: the live re-check, in the own chat
     and in a chat with someone else, and whether the phone drops the read when newer messages arrived than the range
     names (Baileys skips such a patch on its first sync).
   - **An archive or mark-unread with nothing stored.** Baileys accepts an empty message range, whatsapp-rust calls
     one safe, and whatsmeow fills in the current time; `wa` still refuses a chat the store holds nothing of, as
     `chats delete` does. Sending an empty range is an option once a live check shows the phone takes it.
   - **The store keeps a deleted chat.** cli-core's `chats delete` and `chats clear` leave the local store as it is,
     so `messages list` and `search` still show what was deleted (queued to cli-core); the engine also ignores
     whatsmeow's `DeleteChat` and `ClearChat` events, so a deletion made on the phone does not reach the store either.
   - **Live check of delete for the owner alone.** `messages delete` without `--for-everyone` sends a hand-built
     `deleteMessageForMe` patch, pinned against WhatsApp Web's own module, Cobalt and whatsapp-rust. The phone drops
     the owner's own message in the own chat (2026-10-18). Open: that it drops a message from someone else in a group
     (the participant field) and one in a one-to-one chat; and that it keeps the saved files. wa sends the chat id
     the store holds as it is. WhatsApp Web, once the account's one-to-one chats moved to LIDs, writes a chat stored
     by phone number as its LID instead (`WAWebSyncdGetChat.getChatJidMutationIndexForChat`), so a chat the store
     holds by phone number may be dropped; one held by its LID matches.
   - **Live check of starring.** `messages star` and `unstar` send a hand-built `star` patch, pinned against WhatsApp
     Web's `WAWebStarMessageSync`, Cobalt and whatsapp-rust. The phone shows and drops the star on the owner's own
     message in the own chat (2026-10-18). Open: someone else's message in a group (the participant field) and one in
     a one-to-one chat. A chat the store holds by phone number may be dropped, as with delete for the owner alone.
   - **Live check of stars and deletes for the owner alone made on the phone.** The engine passes whatsmeow's
     `events.Star` and `events.DeleteForMe` on as `star` and `delete` events, and a pushed message's starred flag as
     `starred`, but none has come from a real phone yet. Open: that a star set and taken off on the phone reaches
     `messages list <chat> starred:true` in a one-to-one chat and a group, that the history push after a fresh link
     carries the flag at all, and that the app-state chat id lands on the chat the store holds (a phone-number id is
     mapped to the LID only when whatsmeow knows it). A full app-state resync (whatsmeow drops its events) loses the
     stars changed while the device was out of sync.
   - **Messages stored before files were.** A photo with a caption stored by an older `wa` has the caption and no
     attachment, so `messages forward` sends the caption alone and `messages download` finds nothing. The phone does
     not push history again; a re-link would refill it.
   - **Files WhatsApp no longer keeps.** A download asks the owner's phone to upload the file again and fetches the new
     copy; ~~each later download asks the phone again~~ the new path is kept in the stored `providerRef`, so a later
     download and a forward use it. ~~Left: a later push of the same message with the old ref (a history push after a
     re-link) replaces the kept one~~ the adapter's `feed` leaves the ref off a pushed file the store holds with the same keys
     (cli-core #1540 leaves that to wa); a chat re-keyed in the same push is looked up under its new id and misses.
     Not yet run against WhatsApp: the retry in the own
     chat and that a second download no longer asks (the owner runs `bin/live-expired-file` for both), and whether the
     phone answers a receipt for a one-to-one chat with someone else addressed by LID.
   - **Forwarding several contact cards** (`ContactsArrayMessage`) and a live location is refused; a place or a card
     stored before `wa` kept their content too.
   - **Live check of forwarding a place or a contact card**: whether WhatsApp's apps show and open a forwarded place
     and card has not been run (the owner runs `bin/live-forward-card` for it, in the own chat).
   - **Media leftovers**: `metadata refresh` for a channel (`group` reads groups only).
   - **Files to channels: built, one file per post, not checked live.** A photo, video, voice note or document goes
     to a channel the owner runs, uploaded unencrypted (`UploadNewsletterReader`) and posted with its media handle.
     An album to a channel is refused: whatsmeow's newsletter send has no album handling. The fields follow whatsmeow's
     `UploadNewsletter` example (URL, direct path, the plain file's SHA-256, no media key); mautrix-whatsapp posts no
     files to channels, so nothing else confirms them. A channel file has no media key, so `messages forward` of one
     into a chat is refused (`media.channel-file-forward`): it would arrive as a file that does not open.
     **Live check needs a channel the owner owns or administers**; none is known, so there is no `bin/live-*` for
     it: whether the apps show the photo with its preview and caption, and whether the next `messages sync` returns
     it under the same id.
   - **Channels: what following and reading left open.** Downloading a channel post's file (no media key). Mentions in channel
     posts. A live edit or deletion of a post is passed over: WhatsApp addresses it by the server id, which the
     store keeps only in `providerMetadata`. Reactions and view counts (`NewsletterSendReaction`,
     `NewsletterMarkViewed`) are not built. The owner's own posts read back as the channel's (`outgoing: false`):
     whatsmeow does not say, so a post wa sends answers so too. Marking a channel read (`chats read`, `--mark-read`)
     goes out only when typed, as whatsmeow's `MarkRead`, which turns it into a `read-self` receipt naming the
     channel as the sender; whether WhatsApp takes that shape is unverified. A channel's settings (`chats show`,
     `chats update`) are refused as "not a group". A one-shot `chats join` stores no chat row: the push has no `feed` to land in. A history push that
     carries a channel stores its posts without a server id, so `messages sync` cannot count back from one of them.
     The 50 posts per read is wa's choice: whatsmeow sets no limit and WhatsApp's own is not known. **Live checks**
     (read-only, then the owner's own channel): `GetSubscribedNewsletters` and `GetNewsletterMessages` on a linked
     web device, whether a followed channel's new posts arrive live without `NewsletterSubscribeLiveUpdates`, and
     whether a post's message id from a read equals the one a live post carries, and a text post in the owner's own
     channel (whether a `Conversation` message is what WhatsApp's apps show, and whether the next read returns it under
     the id it was sent with).
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
     `AlbumMessage` with stanza type `text`. whatsmeow and mautrix-whatsapp only read albums. The owner runs
     `bin/live-album` for it, in the own chat; it also asks whether a sent photo shows its preview.
   - **No preview on a sent video.** A photo carries a 72-pixel JPEG preview; a video needs a frame decoder, and the
     engine has no pure-Go one (no cgo, no ffmpeg), so a video goes without one. A WEBP photo too: the standard
     library does not decode WEBP. The preview ignores a JPEG's EXIF orientation, so a phone photo taken on its side
     may show a turned preview until the photo downloads.
   - **Message pins**: a pin that arrives (live or in a push) is skipped, so the store does not know what is pinned.
     A 24-hour pin and an unpin in the own chat show on the phone (2026-10-18). Open: a group addressed by phone
     numbers, and that a 24-hour pin ends on the phone.
   - **Live checks** (with item 1): a reaction and a revoke in a group addressed by phone numbers (the own LID chat
     works, 2026-10-17); whether one read receipt for the newest message clears the phone's unread count, or
     each unread message needs its own.
   - **Live checks of `account privacy`**: `show` reads the phone's settings (2026-10-18); `set` has run only against
     the fake engine. Open: whether
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
   goes.
11. **The LID lookups: live check.** The engine asks WhatsApp for the LIDs of its phone-form chats in small paced
    batches (ARCHITECTURE §5), built and tested with a fake clock only. Unverified: that a batched `GetUserInfo` on
    phone JIDs answers with their LIDs, and that WhatsApp says nothing about five at a time, 20 a run. Check it on the
    owner's number with one phone-form chat.
13. **Standards gaps left by the 2026-10-17 audit** (the handbook's areas, where a fix needs design):
    - **Modules entered only through their entry points** (WC-ARCH-8): `src/adapter/` and `src/engine/` have no
      `index.ts`, and `biome.json` lets the composition root import any file in them. Add the rule when tg does, so
      both name their entry points the same way.
14. **How long WhatsApp's rate limit and a ban hold writes is the owner's to set** (WC-PERM-18). WhatsApp's 429 says
    neither how long to wait nor whether reads count, and a ban says nothing about the account's standing. The lead's
    default, under the owner's autonomy mandate: after a 429, every write is held 15 minutes and reads go on; after a
    ban, writes are held until the end WhatsApp gives it, or until `flood clear` or a `doctor --online` that connects
    when it gives none (`src/adapter/errors.ts`). A 429 also stops the background LID lookups for a week (ARCHITECTURE
    §5). Open: the 15 minutes, the week, and whether reads should pause too.
15. **`serve`'s restarts need cli-core** (found 2026-10-18, ARCHITECTURE §4). A unit restarts `serve` by exit code
    only (cli-core's `noRestartOn`), and `device.replaced`, `client.outdated` and a crashed engine all exit 12. So
    after another connection takes the login over, the unit starts `serve` again 30 s later and takes it back, and
    the two push each other off; after `outdated` it restarts for nothing. Needs cli-core: no-restart by reason, or
    a way for an adapter to give an ending its own exit. Also cli-core's: no cap on restarts (`RestartSec=30`, so
    systemd's start limit never trips), no restart on macOS once `noRestartOn` is set (launchd cannot exclude one
    code), none for a `serve` started by hand, and no way to open the connection again inside `serve`.
16. **Phone-form chats stored before the re-key table need cli-core** (found 2026-10-19, ARCHITECTURE §5). The engine
    records a phone-form chat when it emits it, or when a request names it, so a chat cli-core stored in phone form
    before `wa_phone_chats` existed (wa #73) re-keys and gets a LID lookup only once a message, a history push or a
    command touches it. One nothing touches stays in phone form, and a message under its LID later splits it. The
    engine cannot read cli-core's store; the fix is a cli-core port that hands the messenger the stored chat ids once
    (at `feed`'s start, say), which the adapter passes on to the engine.
17. **The first test of `src/groups.test.ts` once hit vitest's 5 s timeout** (found 2026-10-19, in a local
    `pnpm test:coverage` for wa #144, which changed nothing that test runs). Not reproduced: in three later coverage
    runs it took 64 to 130 ms, and CI stayed green. Probably the cold start of a file's first test while other agents'
    suites load the machine. If it comes back, give the first test of a file a longer timeout, or warm the import in
    a setup file, rather than raising the timeout for the whole suite.
18. **A notice for a group the owner left would mark it rejoined** (found 2026-10-19, needs cli-core). cli-core's
    `upsertChat` (0.348.0) clears a stored `left` membership whenever a saved chat leaves membership out, as the
    community link and unlink notices do. WhatsApp probably sends a group's notices only to its members, so it should
    not arise; the fix is in cli-core: a chat that leaves out every kept field is a notice, not the list naming it.
