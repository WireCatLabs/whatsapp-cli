# Backlog notes

The research behind backlog items, moved here word for word from the numbered backlog of 2026-10-23, so that
[BACKLOG.md](BACKLOG.md) and [BACKLOG_LATER.md](BACKLOG_LATER.md) stay one line per item. Each heading is the item's id;
"was item N" is its number in the old backlog, which the `bin/live-*` scripts still cite. Add to an entry when
new findings come in; delete it with its item once the item ships.

## WA-4 · Album: does the phone group a photo and a video

Was item 5, "Live check of an album":

   - **Live check of an album**: WhatsApp accepts the album and the phone shows both files, but as two messages, not one
     album (2026-10-20, before the message secret and the LID parent key). Whether the phone groups them now is not
     checked; `bin/live-album` sends with a caption, which matters: WhatsApp Web's defaults send an album of fewer than
     four files only with a caption (`album_v2_min_items_to_send_as_album_enabled` 4,
     `album_v2_min_items_to_send_album_with_caption` 2). If it still shows two messages, the next difference is the
     wrapper: WhatsApp Web can wrap each file in `associatedChildMessage` (behind its flag
     `wa_web_wrap_associated_child_message_enabled`, off by default), which whatsmeow does not unwrap. The shape matches
     Baileys 7.0.0-rc14, the one open-source sender found (`lib/Utils/messages.js`, `album` and `albumParentKey`): each
     file is a plain photo or video whose `messageContextInfo.messageAssociation` is `MEDIA_ALBUM` with the parent key
     `{remoteJid, fromMe: true, id}`. Baileys, like whatsmeow, sends the `AlbumMessage` with stanza type `text`, and
     puts a message secret and a reporting token on every message, as wa now does. whatsmeow and mautrix-whatsapp only
     read albums. The owner runs `bin/live-album` for it, in the own chat; it also asks whether a sent photo shows its
     preview.

## WA-5 · Linking: live checks

Was item 1:

1. **Linking: live checks** (NEED-1387, own chat only). A fresh `session start` must keep the history push
   (the owner runs `bin/live-fresh-link`), and `self()` must be set immediately after pairing.

## WA-6 · One-shot connections: live re-check

Was item 9:

9. **One-shot connections: live re-check.** Passive message and history listeners save what a command's
   connection receives (`src/oneshot-listen.test.ts`); the engine waits up to 3 seconds for history downloads
   before closing (`engine/cmd/wa-engine/historysync.go`). The owner must run `bin/live-oneshot-drop` again,
   in the own chat, and confirm that the queued message survives `doctor --online` and the restarted `serve`.
   Not verified: a push announced after the close wait ends. Consider holding its history receipt only if
   the live run still loses a push; this also needs a cli-core port. See [history handling](ARCHITECTURE.md#3-history-comes-from-the-store).

## WA-11 · How long a rate limit and a ban hold writes

Was item 14:

14. **How long WhatsApp's rate limit and a ban hold writes is the owner's to set** (WC-PERM-18). WhatsApp's 429 says
    neither how long to wait nor whether reads count, and a ban says nothing about the account's standing. The lead's
    default, under the owner's autonomy mandate: after a 429, every write is held 15 minutes and reads go on; after a
    ban, writes are held until the end WhatsApp gives it, or until `flood clear` or a `doctor --online` that connects
    when it gives none (`src/adapter/errors.ts`). A 429 also stops the background LID lookups for a week (ARCHITECTURE
    §5). Open: the 15 minutes, the week, and whether reads should pause too.

## WA-12 · `serve`'s restarts need cli-core

Was item 15:

15. **`serve`'s restarts need cli-core** (found 2026-10-18, ARCHITECTURE §4). A unit restarts `serve` by exit code
    only (cli-core's `noRestartOn`), and `device.replaced`, `client.outdated` and a crashed engine all exit 12. So
    after another connection takes the login over, the unit starts `serve` again 30 s later and takes it back, and
    the two push each other off; after `outdated` it restarts for nothing. Needs cli-core: no-restart by reason, or
    a way for an adapter to give an ending its own exit. Also cli-core's: no cap on restarts (`RestartSec=30`, so
    systemd's start limit never trips), no restart on macOS once `noRestartOn` is set (launchd cannot exclude one
    code), none for a `serve` started by hand, and no way to open the connection again inside `serve`.

## WA-13 · Files WhatsApp no longer keeps

Was item 5, "Files WhatsApp no longer keeps":

   - **Files WhatsApp no longer keeps.** A download asks the owner's phone to upload the file again and fetches the new
     copy; the new path is kept in the stored `providerRef`, so a later
     download and a forward use it. The adapter's `feed` leaves the ref off a pushed file the store holds with the same keys
     (cli-core #1540 leaves that to wa); a chat re-keyed in the same push is looked up under its new id and misses.
     Not yet run against WhatsApp: the retry in the own
     chat and that a second download no longer asks (the owner runs `bin/live-expired-file` for both), and whether the
     phone answers a receipt for a one-to-one chat with someone else addressed by LID.

## WA-14 · Older history from the phone: live checks

Was item 4:

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

## WA-15 · Chat-state writes beyond the own chat: live checks

Was item 5, "Live checks of the chat-state writes":

   - **Live checks of the chat-state writes** in the own chat (2026-10-18, `bin/live-chat-state`): `account privacy
     show`, `chats mute` and `unmute` of the own chat by its LID, `messages pin --expire-time 24h` and `unpin`,
     `messages star` and `unstar` of the owner's own message, `chats pin` and `unpin`, `chats archive` and `unarchive`,
     `chats mark-unread` and delete for the owner alone all show on the phone. `chats mark-read` did not take the
     mark-unread off: it sent no read patch, and in the own chat no receipt either. It now sends the patch first;
     a live re-check (step 7) is open.

Was item 5, "Live checks of `chats mute`":

   - **Live checks of `chats mute`**: the own chat, addressed by its LID, mutes and unmutes (2026-10-18). Open:
     whether the phone applies a mute addressed to a one-to-one chat with someone else by its LID when it keys that
     chat by phone number (whatsmeow maps neither way), and how soon after a fresh link the settings keys arrive.
     Channels are refused; whatsmeow's `NewsletterToggleMute` would mute one, without an end time.

Was item 5, "Live checks of `chats delete` and `chats clear`":

   - **Live checks of `chats delete` and `chats clear`**: not run against WhatsApp. Open, as for mute: a one-to-one
     chat addressed by its LID; and whether the phone deletes up to the named message when newer ones arrived
     that the store has not heard of yet (the patch should leave those).

Was item 5, "Live checks of `chats archive`…":

   - **Live checks of `chats archive`, `unarchive`, `pin`, `unpin` and `mark-unread`**: the own chat works
     (2026-10-18). Open, as for mute: a one-to-one chat with someone else addressed by its LID, and a group. Also:
     whether the phone shows a fourth pinned chat (its apps keep three; the server cannot read a patch to refuse one);
     whether pinning an archived chat unarchives it (whatsmeow's, Baileys' and whatsapp-rust's pin patches carry no
     unarchive); and whether an archived chat comes back when a message newer than the patch's range arrives.

Was item 5, "`chats mark-read` sends the read patch, then the receipt":

   - **`chats mark-read` sends the read patch, then the receipt.** The live check showed a read receipt does not take
     a mark-unread off (2026-10-18), so `mark-read` first sends whatsmeow's `BuildMarkChatAsRead` with read true, up to
     `--until-id` or the newest stored message, then the receipt as before. A refusal for missing settings keys comes
     before the receipt, so nothing goes out; `inbox` and `review --mark-read` stop on it too, where they marked read
     before the keys arrived. Each chat they mark costs one more write, whether or not the phone held it unread: the
     store does not know. A chat the store holds nothing of gets neither. Open: the live re-check, in the own chat
     and in a chat with someone else, and whether the phone drops the read when newer messages arrived than the range
     names (Baileys skips such a patch on its first sync).

## WA-16 · Polls and votes: live checks and the race

Was item 5, "A live vote that races its poll is dropped":

   - **A live vote that races its poll is dropped.** History votes go into the store with the push that carries
     them (cli-core 0.322.0); a live vote whose poll the store does not hold yet is passed over.

Was item 5, "Live checks of votes":

   - **Live checks of votes**: the owner's vote from the phone on a poll `wa` created in the own chat decrypts and
     counts once as `chosen` (2026-10-17). Still open: a vote from someone else in a group and in a one-to-one chat,
     and the history votes after a fresh link.

Was item 5, "Live checks of `polls vote`":

   - **Live checks** of `polls vote` from `wa` (one-to-one, group, phone-addressed group): `polls create` in the own
     chat and `--md` sends work (2026-10-17); a vote cast by `wa` has not been run against WhatsApp
     (the owner runs `bin/live-poll-vote` for it, in the own chat).

## WA-17 · Chat state from the phone: what is not stored yet

Was item 5, "Chat state from the phone":

   - **Chat state from the phone (2026-10-22; stored since cli-core 0.382.0, engine protocol 45).** `events.Mute` goes
     out with its end (`mutedUntil`, none for good), `events.Archive` as `archived`, and `events.MarkChatAsRead` as
     `markedUnread: true` (mark unread) or `unread: 0`, `markedUnread: false` and the read range's last-message time
     (read). The history push passes `archived`, the mute's end and `markedAsUnread`. The store counts new messages
     itself (`unreadCounts: "store"`), from the read's last-message time. Not passed on, for want of a cli-core field:
     `events.Pin`. `events.DeleteChat` and `events.ClearChat` wait for a store write that drops a chat's messages up to
     a time (below). Open ([cli-core #1728](https://github.com/WireCatLabs/cli-core/issues/1728)): a read's last-message
     time replaces the stored `lastMessageAt`, which moves it back when a message arrived after the phone's read; the
     history push reads any mute end past the year 9999 as for good, and whether a timed end there is in seconds is not
     checked live; a notice for a chat the store does not hold makes a chat with no title (`upsertChat` inserts). Live
     checks open: archive, mute 8h, mark unread and read on the phone while `serve` runs.

Was item 5, "The store keeps a deleted chat":

   - **The store keeps a deleted chat.** cli-core's `chats delete` and `chats clear` leave the local store as it is,
     so `messages list` and `search` still show what was deleted (queued to cli-core); the engine also ignores
     whatsmeow's `DeleteChat` and `ClearChat` events, so a deletion made on the phone does not reach the store either.

## WA-21 · Channels: post files and what following left open

Was item 5, "Files to channels":

   - **Files to channels: built, one file per post, not checked live.** A photo, video, voice note or document goes
     to a channel the owner runs, uploaded unencrypted (`UploadNewsletterReader`) and posted with its media handle.
     An album to a channel is refused: whatsmeow's newsletter send has no album handling. The fields follow whatsmeow's
     `UploadNewsletter` example (URL, direct path, the plain file's SHA-256, no media key); mautrix-whatsapp posts no
     files to channels, so nothing else confirms them. A channel file has no media key, so `messages forward` of one
     into a chat is refused (`media.channel-file-forward`): it would arrive as a file that does not open.
     **Live check needs a channel the owner owns or administers**; none is known, so there is no `bin/live-*` for
     it: whether the apps show the photo with its preview and caption, and whether the next `messages sync` returns
     it under the same id.

Was item 5, "Channels: what following and reading left open":

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

## WA-22 · A user who gains a LID later: live check

Was item 3:

3. **A user who gains a LID later: live check.** Built: the engine announces the re-key (ARCHITECTURE §5) and the
   adapter's `feed` hands it to cli-core's `HistoryBatch.rekeys` (cli-core 0.336.0), tested end to end with the fake
   engine. Left: a live case — a person in phone form who gains a LID — has not been seen yet; the store should then
   hold their chat once, under the LID.

## WA-23 · The LID lookups: live check

Was item 11:

11. **The LID lookups: live check.** The engine asks WhatsApp for the LIDs of its phone-form chats in small paced
    batches (ARCHITECTURE §5), built and tested with a fake clock only. Unverified: that a batched `GetUserInfo` on
    phone JIDs answers with their LIDs, and that WhatsApp says nothing about five at a time, 20 a run. Check it on the
    owner's number with one phone-form chat.

## WA-24 · Chat events: live checks

Was item 5, "Chat events: live checks":

   - **Chat events: live checks.** Check that a push's service messages carry the people
     as the protobuf says (the owner runs `bin/live-chat-events`), the owner's own join or add, which whatsmeow
     sends live as `events.JoinedGroup` (only a history push records it), and `member_stays`, which cli-core does
     not fill from events yet. A live removal whose notification names no sender is a `leave`, while the push's
     `GROUP_PARTICIPANT_REMOVE` stub is a `remove`, so that change gets two ids and two rows; which one the sender-less
     notification is has not been seen. Stub types not read yet (their parameters have not been seen):
     `GROUP_PARTICIPANT_ACCEPT`, `_ADD_REQUEST_JOIN`, `_JOINED_GROUP_AND_PARENT_GROUP` and `_CHANGE_NUMBER`,
     `COMMUNITY_PARTICIPANT_PROMOTE` and `_DEMOTE`, and the `*_RICH` variants.

## WA-25 · Names of groups the store lacks, in a one-shot command

Was item 5:

   - **Names of groups the store lacks, in a one-shot command.** cli-core finds a stored group by name (0.337.0);
     for one the store does not hold, the engine learns the joined groups only once connected, after cli-core asked
     for the name, so such a group is found by its `…@g.us` id only.

## WA-26 · Stickers from a file: live check and the limits

Was item 5:

   - **Stickers from a file: live check and the limits.** `messages send --sticker-file` (cli-core 0.340.0) uploads
     the `.webp` as an image and sends a `StickerMessage`, with the canvas read from the file's first chunk. A square
     512×512 still sticker of 7.6 KB shows on the phone as a sticker, at the right size and shape (own chat,
     2026-10-18, `bin/live-chat-state` step 9); a non-square one, a still one over 100 KB and an animated one are not
     checked. One cap, 500 KiB, lets an animated sticker through: Meta's Cloud API caps a
     still one at 100 KB, and whether a phone shows a larger still sticker is unknown. `isAnimated` is not set.
     The `.webp` goes as it is: mautrix-whatsapp pads a non-square one to a square and adds a PNG thumbnail before
     sending, and whether a phone shows a non-square sticker well is unknown.
     A sticker to a channel is refused until a channel post's sticker (URL, no key) is seen working.

## WA-27 · Communities: only the read of one group

Was item 5:

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

## WA-28 · Group writes and `profile` on a `@lid` person: live checks

Was item 5:

   - **Live checks** of every group write and of `profile` on a `@lid` person: whatsmeow's `GetUserInfo` has only
     been read, not run, with a LID.

## WA-29 · A reaction and a revoke in a phone-addressed group: live checks

Was item 5, "Live checks (with item 1)":

   - **Live checks** (with item 1): a reaction and a revoke in a group addressed by phone numbers (the own LID chat
     works, 2026-10-17); whether one read receipt for the newest message clears the phone's unread count, or
     each unread message needs its own.

## WA-30 · `EmitAppStateEventsOnFullSync` stays off

Was item 5:

   - **`EmitAppStateEventsOnFullSync` stays off (2026-10-22).** On, whatsmeow replays the whole collection after a
     full sync (link, lost keys, a hash mismatch) as if it were new (whatsmeow appstate.go:70-72): every old star and
     delete for the owner would print again in `watch --events`, which has one event for a live change and a replay,
     and the address book would be written one contact at a time instead of in one batch (appstate.go:181-189). Off,
     changes made while the device was out of sync are lost until the next push. whatsmeow writes mute, pin and
     archive to its own chat settings either way (appstate.go:262-291), so a full sync could be followed by one push
     of those, and replayed stars could go as a history batch (`HistoryBatch.stars`) rather than as events.

## WA-31 · The own profile photo: live check

Was item 5:

   - **The own profile photo** (`account update --photo`). **Built (2026-10-18):** whatsmeow has no own-photo call;
     `SetGroupPhoto(ctx, types.EmptyJID, jpeg)` sends no `target`, the request Baileys' `updateProfilePicture` sends
     for the own picture, after the square-JPEG check `chats update --photo` uses. Removing it waits, as for a group.
     **Live check** (not run): `account update --photo` with a 640-pixel square JPEG, through `serve`; the phone shows
     the new photo, and whether WhatsApp takes the 190 and 720 pixel ends for an own photo as it does for a group's.

## WA-32 · `account update`: live checks

Was item 5:

   - **Live checks of `account update`**: not run against WhatsApp. Open: when others see a new name, since `wa`
     sends no presence and WhatsApp learns a name from one; whether `SetStatusMessage` with no duration keeps the
     about for good (whatsmeow sends `ephemeral_duration_sec: 0`, and none of its callers sets one); whether the
     phone refuses an empty about (the engine refuses it first).

## WA-33 · `account privacy`: live checks

Was item 5:

   - **Live checks of `account privacy`**: `show` reads the phone's settings (2026-10-18); `set` has run only against
     the fake engine. Open: whether
     `calladd` `known` is the phone's "silence unknown callers" (Baileys says "mute unknown calls",
     WhiskeySockets/Baileys#872), and whether WhatsApp really refuses `groupadd` `none` (Baileys#966 says so, so
     `--chat-invites nobody` is refused up front; whatsmeow still lists it).
     Also open: that `status` is the about text's audience and `profile` the photo's, that `readreceipts` `none`
     also hides others' receipts from the owner, and that `chats mark-read` with receipts off clears the phone's
     unread count (whatsmeow then sends `read-self`, `receipt.go`). cli-core 0.336 has no "contacts except" for
     `chatInvites`, so such a groups setting is left out of `show`; asked of cli-core (upstream queue, S1).

## WA-34 · An archive or mark-unread with nothing stored

Was item 5:

   - **An archive or mark-unread with nothing stored.** Baileys accepts an empty message range, whatsapp-rust calls
     one safe, and whatsmeow fills in the current time; `wa` still refuses a chat the store holds nothing of, as
     `chats delete` does. Sending an empty range is an option once a live check shows the phone takes it.

## WA-35 · Delete for the owner alone and stars: live checks

Was item 5, "Live check of delete for the owner alone":

   - **Live check of delete for the owner alone.** `messages delete` without `--for-everyone` sends a hand-built
     `deleteMessageForMe` patch, pinned against WhatsApp Web's own module, Cobalt and whatsapp-rust. The phone drops
     the owner's own message in the own chat (2026-10-18). Open: that it drops a message from someone else in a group
     (the participant field) and one in a one-to-one chat; and that it keeps the saved files. wa sends the chat id
     the store holds as it is. WhatsApp Web, once the account's one-to-one chats moved to LIDs, writes a chat stored
     by phone number as its LID instead (`WAWebSyncdGetChat.getChatJidMutationIndexForChat`), so a chat the store
     holds by phone number may be dropped; one held by its LID matches.

Was item 5, "Live check of starring":

   - **Live check of starring.** `messages star` and `unstar` send a hand-built `star` patch, pinned against WhatsApp
     Web's `WAWebStarMessageSync`, Cobalt and whatsapp-rust. The phone shows and drops the star on the owner's own
     message in the own chat (2026-10-18). Open: someone else's message in a group (the participant field) and one in
     a one-to-one chat. A chat the store holds by phone number may be dropped, as with delete for the owner alone.

Was item 5, "Live check of stars and deletes for the owner alone made on the phone":

   - **Live check of stars and deletes for the owner alone made on the phone.** The engine passes whatsmeow's
     `events.Star` and `events.DeleteForMe` on as `star` and `delete` events, and a pushed message's starred flag as
     `starred`, but none has come from a real phone yet. Open: that a star set and taken off on the phone reaches
     `messages list <chat> starred:true` in a one-to-one chat and a group, that the history push after a fresh link
     carries the flag at all, and that the app-state chat id lands on the chat the store holds (a phone-number id is
     mapped to the LID only when whatsmeow knows it). A full app-state resync (whatsmeow drops its events) loses the
     stars changed while the device was out of sync.

## WA-36 · Message pins that arrive are skipped

Was item 5:

   - **Message pins**: a pin that arrives (live or in a push) is skipped, so the store does not know what is pinned.
     A 24-hour pin and an unpin in the own chat show on the phone (2026-10-18). Open: a group addressed by phone
     numbers, and that a 24-hour pin ends on the phone.

## WA-37 · Messages stored before files were

Was item 5:

   - **Messages stored before files were.** A photo with a caption stored by an older `wa` has the caption and no
     attachment, so `messages forward` sends the caption alone and `messages download` finds nothing. The phone does
     not push history again; a re-link would refill it.

## WA-38 · Forwarding several contact cards, a live location, a place or a card

Was item 5, "Forwarding several contact cards":

   - **Forwarding several contact cards** (`ContactsArrayMessage`) and a live location is refused; a place or a card
     stored before `wa` kept their content too.

Was item 5, "Live check of forwarding a place or a contact card":

   - **Live check of forwarding a place or a contact card**: whether WhatsApp's apps show and open a forwarded place
     and card has not been run (the owner runs `bin/live-forward-card` for it, in the own chat).

## WA-39 · `metadata refresh` for a channel

Was item 5, "Media leftovers":

   - **Media leftovers**: `metadata refresh` for a channel (`group` reads groups only).

## WA-40 · Albums: only the first file is stored

Was item 5:

   - **Albums: only the first file is stored.** An album goes as an `AlbumMessage`, then each file as a plain photo
     or video tied to it by `MessageAssociation` (`MEDIA_ALBUM`), but cli-core's `Sent` holds one message, so the
     store keeps the photo's message and not the others; WhatsApp is not seen to echo a device's own sends back to
     it. The fix is in cli-core (a send that answers several messages). cli-core also passes at most one `--photo`
     and one `--file`, so an album has two files. Receiving: an album's announcement is dropped, and each file is
     stored as its own message if the apps send it unwrapped; one wrapped in `associatedChildMessage` would be dropped.

## WA-41 · No preview on a sent video or WEBP photo

Was item 5:

   - **No preview on a sent video.** A photo carries a 72-pixel JPEG preview; a video needs a frame decoder, and the
     engine has no pure-Go one (no cgo, no ffmpeg), so a video goes without one. A WEBP photo too: the standard
     library does not decode WEBP. The preview ignores a JPEG's EXIF orientation, so a phone photo taken on its side
     may show a turned preview until the photo downloads.

## WA-42 · Newer poll fields

Was item 5:

   - **Newer poll fields** (`endTime`, `hideParticipantName`, `pollType`, `correctAnswer` on `PollCreationMessage`)
     would map to `--close-time`, `--anonymous` and `--quiz`; whatsmeow does not build them and no WhatsApp client has
     been seen to show them, so they are not used.

## WA-43 · Replace the test-matrix waivers with tests

Was item 8:

8. **Replace the test-matrix waivers with tests.** On 2026-10-18, after a third round, 199 commands and options have a
   wa test and 525 are waived in `scripts/test-matrix-untested.ts`. The group wildcards for `messages`, `chats`, `contacts`, `account`
   and `doctor` are gone: every waiver there names its command and the cli-core test that covers it, so a new
   subcommand shows up as missing. Each command that gets an engine path gets tests through `run()`, and its waiver
   goes.

## WA-44 · Modules entered only through their entry points (WC-ARCH-8)

Was item 13:

13. **Standards gaps left by the 2026-10-17 audit** (the handbook's areas, where a fix needs design):
    - **Modules entered only through their entry points** (WC-ARCH-8): `src/adapter/` and `src/engine/` have no
      `index.ts`, and `biome.json` lets the composition root import any file in them. Add the rule when tg does, so
      both name their entry points the same way.

## WA-45 · A flaky first test in `src/groups.test.ts`

Was item 17:

17. **The first test of `src/groups.test.ts` once hit vitest's 5 s timeout** (found 2026-10-19, in a local
    `pnpm test:coverage` for wa #144, which changed nothing that test runs). Not reproduced: in three later coverage
    runs it took 64 to 130 ms, and CI stayed green. Probably the cold start of a file's first test while other agents'
    suites load the machine. If it comes back, give the first test of a file a longer timeout, or warm the import in
    a setup file, rather than raising the timeout for the whole suite.

## WA-46 · Each re-key of a stored phone-form chat is its own store write

Was item 19:

19. **Each re-key of a stored phone-form chat is its own store write** (found 2026-10-19, wa #148 review; the rest
    closed by cli-core 0.356.0). For scale only: the first `serve` or `watch` start after upgrading writes once per
    stored phone-form chat whose LID is known. Batching them is cli-core's.

## WA-47 · Groups the owner left: built, not checked live

Was item 20:

20. **Groups the owner left: built, not checked live** (found 2026-10-19, wa #149 review, narrowed in the wa #151
    review). The engine pushes `membershipState: "left"` (ARCHITECTURE §4, `membership.go`) only from WhatsApp's
    group notifications: the owner among those who left or were removed, and a deleted group; and `"member"` when a
    notification or whatsmeow's `events.JoinedGroup` says the owner was added back (cli-core 0.357.0), which takes
    the mark off and keeps `archived`. It never sends `null`: under cli-core's rule (cli-core #1621) `null` clears
    any stored state, `archived` included. Since cli-core 0.356.0 `chats leave` and `chats join` set and clear the
    mark too. A re-added group is no longer left (RISK-1264 closed). Left open:
    - **Live check**: whether WhatsApp's notices of the owner's own leave, removal and re-add reach the owner's
      linked device, and in which form they name the owner.
    - **A live read of one group marks nothing.** Its 403 would be a real signal, but the engine cannot tell whether
      the store holds the group, and a mistyped id (404) or a group the owner was never in (403) would store a stray
      untitled row marked left. A read that succeeds pushes the whole group, membership left out, so an archived
      group stays archived.
    - **A group left while nothing was connected** stays unmarked until a notice: a history push has no field that
      says the owner is gone. Its `GROUP_PARTICIPANT_LEAVE` and `REMOVE` service messages could say so, but only read
      in order with a later re-add; not built.
    - **A chat marked left drops out of `chats list`** (cli-core); its messages stay searchable, and since cli-core
      0.356.0 `chats show` shows it with `membership_state: "left"`.
