# Architecture

How `wa` is put together, and which seams you may not cross. The rules are the handbook's
[Architecture](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/architecture.md) and
[Lifecycle](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/lifecycle.md) pages (`WC-ARCH-<n>`,
`WC-LIFE-<n>`), which win over this page; this page is how `wa` keeps them.

## 1. Most of `wa` is not in this repository

`wa` is the third messenger on [`@wirecat/cli-core`](https://github.com/WireCatLabs/cli-core), beside tg-cli and
max-cli. cli-core owns the commands, the message store and its search, MCP, the send guard, `serve`, `watch`,
`inbox` and the run records. This repository adds three things: an **adapter** that maps WhatsApp onto cli-core's
messenger port, an **engine** that speaks WhatsApp's protocol, and the few commands only WhatsApp needs. The
adapter contract is cli-core's
[ADAPTERS.md](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/ADAPTERS.md).

## 2. The layers

```text
src/program.ts        the shared commands, mounted whole           cli-core
src/messenger.ts      what cli-core needs to know about WhatsApp
src/adapter/          WhatsApp → cli-core's domain (Chat, Message)
src/engine/           the engine port and its contract (JSON lines)
engine/               the Go engine: whatsmeow in a child process   Go
```

Dependencies point down only. `biome.json` enforces it: nothing in `src/` above the adapter reaches the adapter or
the engine, except the composition root, `src/messenger.ts`, which starts them. Where the engine binary lives is
answered by `src/engine-binary.ts`, a leaf with only Node imports, so `doctor` (`src/diagnose.ts`) finds the binary
without reaching the engine. `src/adapter/` never reaches commands, the program, the messenger or the shared store;
`src/engine/` never imports cli-core at all.

The adapter names no command: a refusal that sends the person somewhere carries a check from
[`src/adapter/checks.ts`](../../src/adapter/checks.ts), and `src/messenger.ts` words it as `wa <profile> <command>`,
as tg's `src/commands/checks.ts` does. What a command sees of a login is `LinkCode`, declared in `src/messenger.ts`,
not the engine's contract type: the lint cannot see a type that arrives by inference.

## 3. History comes from the store

WhatsApp has no "list chats" request and keeps no history on its servers. The phone pushes history when a device
links, and the socket carries new messages after that. So `WHATSAPP.history` is `"store"`:

- **Reads never connect.** `chats list`, `messages list`, `search` and `inbox` answer from cli-core's store.
- **`serve` fills the store.** It runs the adapter's `feed` (history pushes) beside `watch` (live messages) on one
  connection, and cli-core saves each batch.
- **Writes connect.** `messages send` opens the engine, sends, and closes it.
- **Older history is asked of the phone.** The adapter's `history` (cli-core's `ServerReads.history`, what
  `messages sync` pages through) sends the engine's `older` request, counting back from a stored message: the oldest
  one of the chat on the first page, then the newest stored at or before the time the last page reached. Its
  answer is saved by cli-core like any server read. A phone that does not answer is `timeout`, never an empty page,
  since an empty page tells cli-core the chat's start is held. `fetching.maxPageSize` is 50, what WhatsApp's own
  clients ask. `historyOnDemand` lets `messages sync <chat>` reach it; `--all` stays refused.
- **A file is fetched by the keys in the store.** whatsmeow needs a file's path on WhatsApp's servers and its keys
  to fetch and decrypt it. The engine sends them with each message as the attachment's `ref`, and cli-core keeps them
  as the opaque `providerRef`, never shown in an answer. `messages download` and `messages transcribe --local` look the
  message up and hand the engine the stored attachment; `messages forward` sends the same keys again marked forwarded,
  as WhatsApp's own apps do, and refuses a message whose file the store has no keys for. A place's coordinates, name,
  address and link, and a contact card's name and vCard, ride in the same `ref`, so `messages forward` rebuilds the
  `LocationMessage` or `ContactMessage`; the vCard holds a phone number, and `providerRef` is the one field cli-core
  never prints (`withoutProviderRefs`, `watch` included).
- **A file WhatsApp no longer keeps is asked of the phone again** (`engine/cmd/wa-engine/mediaretry.go`). A download
  that fails with 403, 404 or 410 sends whatsmeow's `SendMediaRetryReceipt` to the account's own phone, waits up to
  20 s for the matching `events.MediaRetry`, decrypts the new path and downloads again, all inside the one `download`
  request, so a one-shot command and one relayed through `serve` behave the same. The CLI sends the message's key with
  the attachment, from the store. The new path is not kept: cli-core's store has no write for an attachment's ref.
- **A change to a message starts in the store.** WhatsApp addresses a message by its id, its sender and whether it is
  the account's own, and whatsmeow keeps no messages. So `messages edit`, `messages delete`,
  `messages star`, `messages pin`, `messages unpin`, `reactions`, `polls` and `chats mark-read` look the message up in cli-core's store
  first (cli-core's `StoredMessages`, which the shared commands hand `connect` as `options.stored`; without one, nothing
  is found) and send the engine the full key. A message the store lacks is refused as `not_found`: a guessed key is not
  refused by WhatsApp, it is dropped without a word. A reply is the exception: it goes either way, and only carries the
  quoted sender and text when the store has them. A live edit carries only the new text, stamped with the edit's time;
  `watch` hands it on as it came, and cli-core's store keeps the message's own time, reply and reactions.

## 4. The engine

The protocol runs in a Go program built on [whatsmeow](https://github.com/tulir/whatsmeow), started as a child
process. Why Go and why whatsmeow: [the protocol decision](https://github.com/WireCatLabs/cli-private/blob/main/research/2026-10-16-whatsapp-protocol-decision.md) (private).

- **A separate program, under its own licence.** The engine links go.mau.fi/libsignal (GPL-3.0) through whatsmeow
  (MPL-2.0, whose files carry no "Incompatible With Secondary Licenses" notice), so `engine/` and the
  `@wirecat/whatsapp-engine-*` packages are GPL-3.0-only ([`engine/LICENSE`](../../engine/LICENSE)), and the
  TypeScript CLI stays Apache-2.0 (the owner's ruling of 2026-10-17 in
  [decisions](https://github.com/WireCatLabs/cli-private/blob/main/decisions/whatsapp.md), private). That holds only
  while the two stay separate programs: the CLI starts the binary as a child process and exchanges JSON lines with it
  on stdin and stdout, never links or loads it in-process, and its npm package never carries the binary or Go code.
  [`scripts/release/checks.test.ts`](../../scripts/release/checks.test.ts) checks both, and the release check refuses
  a CLI package with engine files in it. Each engine package's README points at the commit it was built from
  (`git rev-parse HEAD` in [`scripts/engine-packages.mjs`](../../scripts/engine-packages.mjs), checked by
  [`scripts/engine-packages.test.ts`](../../scripts/engine-packages.test.ts)), not at the tag: `release.yml` pushes
  `v<version>` only after npm has the version, so a tag link would not resolve while the package is first offered.
- **The contract** is [`src/engine/contract.ts`](../../src/engine/contract.ts): every event and answer as a Valibot
  schema, in WhatsApp's own terms (JIDs, `fromMe`, sync kinds). `PROTOCOL` is checked at the engine's hello.
- **Two engines implement it**: the Go engine (`engine/cmd/wa-engine`, driven by
  [`go-engine.ts`](../../src/engine/go-engine.ts)) over JSON lines on stdin and stdout, and
  `src/testing/fake-engine.ts` in memory for tests. A third — Baileys, or whatsapp-rust — would implement the same
  interface without the adapter noticing.
- **The wire.** The engine's first line is `{"hello": …}` (protocol, the linked account) or `{"refused": …}`. Then
  requests `{"id", "op", …}` get `{"id", "ok"}` or `{"id", "error": {code, message}}`; events are the contract's
  `engineEvent`; a login shows `{"login": "qr"|"pair", "code"}`. The phone number for a pairing code travels on stdin,
  never as an argument (`ps` shows arguments). When stdin closes the engine disconnects and exits, so it never
  outlives the CLI; it ignores Ctrl+C and lets the CLI decide.
- **The requests**: `connect`, `link`, `me`, `directory`, `chat`, `send`, `logout` and `close`. In
  `engine/cmd/wa-engine/`, `engine.go` reads and dispatches them and holds `connect` and `send`; `link.go` holds
  `link` and `me`, `directory.go` `directory` and `chat`; `events.go` turns whatsmeow's events into the contract's, and
  `errors.go` sorts its errors into the contract's codes. A reply (`send` or
  `sendMedia` with `replyTo`) also carries `quote` — `fromMe`, `sender` and `text` of the quoted message as the store
  holds it — so the engine names the quoted sender in the form the chat addresses people by and adds the quoted
  text, as mautrix-whatsapp does; without `quote` (a message the store lacks) the reply carries the id alone. Four
  act on a message the account already has, each addressed by `chat`, `message` (its id), `fromMe` and `sender`:
  `edit` (with `text`; whatsmeow's `BuildEdit`), `revoke` (`BuildRevoke`; someone else's message only in a group, as
  its admin), `react` (with `emoji`, `null` to take it off; `BuildReaction`) and `read` (one read receipt;
  `MarkRead`). Four
  carry files: `sendMedia` (`file`: a path on this machine and its kind; uploaded with `UploadReader`, then sent;
  a photo gets a 72-pixel `JPEGThumbnail`, made in `thumbnail.go`), `sendAlbum` (`files`, photos and videos: all
  uploaded first, then an `AlbumMessage` and each file tied to it by `MessageAssociation` `MEDIA_ALBUM`; the first file
  carries the send id and the caption, the album and the other files ids derived from the send id, so a repeat sends
  the same ids; `album.go`),
  `download` (`attachment` as stored, the message's `chat`, `message`, `fromMe` and `sender` for a retry, and
  `path`, which the engine creates 0600 in a folder the CLI made 0700 and removes after reading; protocol 24) and
  `forward` (`attachment` and `text` as stored). No file crosses the JSON line itself. In a
  group still addressed by phone numbers, the engine turns the stored LID sender into the phone JID the group
  expects.
- **Older history** (`engine/cmd/wa-engine/older.go`): `older` (`chat`, `message`, `fromMe`, `timestamp` of the
  anchor, `count` up to 50) sends whatsmeow's `BuildHistorySyncRequest` to the phone as a peer message under an id
  the engine chose first, and waits for the `ON_DEMAND` history sync that answers it, then answers `{messages, more}`.
  A batch is credited to the waiting request when its notification's `PeerDataRequestSessionID` is that id and it
  names the request's chat or no chat; one with that id naming another chat is passed on as a `history` event, since
  it would read as the chat's start. One naming a request that stopped waiting (the last 16 are kept) is late and
  goes out as a `history` event. Without either —
  whether the phone puts the request's id there is not confirmed live — the batch is matched as before: one request is
  in flight per process, so by its chat after conversion to LID form, or by naming no chat at all (nothing older).
  Other chats and push names in the same batch go out as a `history` event (saved only where a `feed` listens, as
  under `serve`). When the phone sent fewer messages than asked, or only messages the contract skips, the engine asks
  again from the oldest one it sent, one second apart, at most three asks and 25 s in all; what arrived before a
  timeout is answered, not dropped. cli-core pages above this, 50 at a time and 2 s apart: a page is one `older`.
  The engine's log (`WA_ENGINE_LOG`) gets a line per `ON_DEMAND` batch with only counts and yes/no: how it was
  matched, how many messages, the chunk and progress, and whether the notification names the request's id.
- **Group and people requests** (`engine/cmd/wa-engine/groups.go`, `people.go`; the contract in
  [`src/engine/groups.ts`](../../src/engine/groups.ts)): `group` (with `withLink` for the invite link, which only
  admins get), `createGroup`, `join` (an invite link; a group that approves joins answers `requested`), `leave`,
  `updateGroup` (name, description, `addMode`, `approval`, `announce`, `locked`, `ephemeral` — only WhatsApp's
  timers, 0, 24h, 7d or 90d), `setGroupPhoto` (`path`: a square JPEG of 190 to 720 pixels a side, checked before
  connecting, the sides mautrix-whatsapp re-encodes to), `resetLink`, `participants` (`add`, `remove`, `promote`,
  `demote`; a phone-addressed group gets phone JIDs), `requests`, `answerRequest`, `profile` (`GetUserInfo` and the
  photo's presence), `block`, `lookup` (`IsOnWhatsApp`, one number, one every 10 s per profile, timed by
  `private.db.lookup`) and `contacts` (the address book in `private.db`). Answers stay in WhatsApp's terms (`announce`, `locked`, `ephemeral`); the adapter
  maps them onto cli-core's `onlyAdminsSend`, `onlyAdminsEditInfo` and `disappearingSeconds`, beside `onlyAdminsAdd`
  and `joinApproval`. A chat built from a group's info (`communities.go`, protocol 15) carries `parent`, the community
  it is linked to, which the adapter maps to cli-core's `parentChatId`, and `community` on a community itself, which
  becomes `providerMetadata.community`: cli-core has no chat kind for a community, and its topics are threads inside
  one chat, not separate groups.
- **Privacy requests** (`engine/cmd/wa-engine/privacy.go`; the contract in
  [`src/engine/privacy.ts`](../../src/engine/privacy.ts)): `privacy` (`TryFetchPrivacySettings` with the cache
  skipped, since another device may have changed a setting) and `setPrivacy` (`privacy`: a list of WhatsApp names and
  values, each checked against whatsmeow's, less `contact_blacklist` and `groupadd` `none`, before the first
  `SetPrivacySetting`, then read again; a failure after the first request says the earlier ones changed). Answers
  stay in WhatsApp's terms (`groupadd`, `last`, `online`, `calladd`, `profile`, `status`, `readreceipts`); the adapter
  (`src/adapter/privacy.ts`) maps them onto cli-core's `chatInvites`, `calls`, `hideOnline` (`last` and `online`
  together), `lastSeen`, `profilePhoto`, `about` and `readReceipts`, lists those in the Messenger's
  `privacySettings`, and refuses what WhatsApp has no value for.
- **Settings requests** (`engine/cmd/wa-engine/appstate.go`; the contract in
  [`src/engine/settings.ts`](../../src/engine/settings.ts)): writes to the account's synced settings ("app state"),
  which WhatsApp syncs to the account's other devices and nobody else sees. Each goes through `sendAppState`, which
  sends a whatsmeow patch with `SendAppState`, answers `settings.keys-missing` while WhatsApp has not sent this device
  the keys a patch is sealed with, counts a patch the server took as done even if reading the settings back failed, and
  answers `outcome_unknown` when the patch left and no answer came. `mute` (`jid`, `until`: `forever`, an RFC 3339 time,
  or null to unmute; `BuildMuteAbs`, forever as -1, an end in milliseconds) refuses channels, which mute by another
  request. `updateProfile` (`pushName`, `about`, `path`, each left out; `engine/cmd/wa-engine/ownprofile.go`) checks
  the photo at `path` as `setGroupPhoto` does, then sends the name
  as `BuildSettingPushName` through `sendAppState` first, fills it into whatsmeow's store for `me` when the read-back did not, then the about with
  `SetStatusMessage`, which is not app state, then the photo with `SetGroupPhoto` and no target; it answers the
  account, and sends no presence. The adapter joins cli-core's first and last name into the one name.
  `deleteChat` and `clearChat` (`engine/cmd/wa-engine/chatdeletion.go`; the chat's newest stored message as
  a key and its `timestamp`, which bound what WhatsApp deletes) send `BuildDeleteChat` and a clear-chat patch whatsmeow
  has no builder for, built the same way (`buildClearChat`: index `clearChat`, chat, deleteStarred `1`, deleteMedia
  `0`; regular_high, version 6 — as Baileys and whatsapp-rust write it). `deleteForMe` (a stored message's key and
  `timestamp`; one request per message) is another patch whatsmeow has no builder for (`buildDeleteForMe`: index
  `deleteMessageForMe`, chat, id, fromMe, and the sender of someone else's message in a group, `0` otherwise, in the
  group's own addressing as `participantFor` gives it; regular_high, version 3; deleteMedia `0` and the message's time
  in seconds — as WhatsApp Web's `WAWebDeleteMessageForMeSync`, Cobalt and whatsapp-rust write it). None deletes the
  phone's saved files. `star` (`engine/cmd/wa-engine/stars.go`; a stored message's key and `starred`, never left out)
  is built by hand next to it, not with whatsmeow's `BuildStar`, which writes a sender for the account's own message
  and for a one-to-one chat whose stored sender is addressed otherwise than the chat (`buildStar`: index `star`, chat,
  id, fromMe, the same participant as `deleteForMe`; regular_high, version 2 — as WhatsApp Web's
  `WAWebStarMessageSync`, Cobalt and whatsapp-rust write it). Channels and broadcasts are refused.
  `archiveChat`, `unarchiveChat` and `markChatUnread` (`engine/cmd/wa-engine/chatlist.go`; the same newest-message
  key and `timestamp`) send `BuildArchive`, whose archive also unpins the chat, and `BuildMarkChatAsRead` with read
  false. `pinChat` and `unpinChat` (`jid`) send `BuildPin`. All refuse channels; nothing counts pins, which the server
  cannot read.
- **Poll requests** (`engine/cmd/wa-engine/polls.go`): `createPoll` (`question`, `answers`, `multiple`;
  `BuildPollCreation`, which gives the poll a secret whatsmeow keeps in `private.db`) and `vote` (a message key and
  the chosen answers' texts, none to retract; `BuildPollVote`, encrypted with that secret, so it needs the poll to
  have reached this device). Every poll message carries `poll`: the question, `multiple`, and each answer with an id,
  the start of the SHA-256 of its text that a vote names. The adapter keeps it in the message's `providerMetadata`,
  so `polls show`, `polls vote` and `polls voters` read the poll from the store.
- **Pin requests** (`engine/cmd/wa-engine/pins.go`): `pin` and `unpin`, each addressed by a stored message's key,
  send a `PinInChatMessage` (`PIN_FOR_ALL` or `UNPIN_FOR_ALL`, the target's key, the sender's time) with
  `messageAddOnDurationInSecs`: the request's `duration` (86400, 604800 or 2592000 seconds, from `--expire-time`; the
  engine refuses any other), 0 on an unpin. Without `--expire-time` cli-core sends `WHATSAPP`'s
  `pinDefaultDuration`, 7 days; the engine still pins for 7 days when a wa on an older cli-core sends no length.
  whatsmeow sends it with the pin edit attribute. Every WhatsApp pin is for the whole chat and its members see it, so
  `WHATSAPP` sets `quietPins: false` and cli-core sends each pin with `notify` and counts it; `pinDurations` lists the
  three lengths. cli-core checks a length before it connects, on the CLI and over MCP. A pin that arrives is not
  stored: it has no text.
- **Votes** arrive once each, as a message of their own, and nothing on WhatsApp's side counts them. The engine
  decrypts a live one (`DecryptPollVote`, with the poll's secret whatsmeow keeps for every poll this device saw) and
  takes the ones a history push carries already decrypted (`WebMessageInfo.pollUpdates`). Each carries the voter
  (LID first, the account's own vote under `self()`), the full SHA-256 of each chosen answer, and `votedAt`, when the
  voter cast it by WhatsApp's clock (the update's sender time). A live vote is a `vote` event, which `watch` hands on
  as cli-core's vote event. A history vote rides in the `history` line's `votes` with its poll (protocol 9), and
  `feed` puts it in cli-core's `HistoryBatch.votes`, so the store saves it with the push, not as a `watch` event.
  Both map the hashes onto answer ids. The store keeps each voter's newest vote by `votedAt`; `polls show` counts
  them with cli-core's `countedPoll`, and `polls voters` lists them.
- **Markdown**: `formatMarkdown` is cli-core's shared `parseMarkdownSpans`; `send` and `edit` write its spans back as
  WhatsApp's own marks (`toWhatsApp` in `src/adapter/format-markdown.ts`), so the engine only ever sends text.
- **Nothing private on stderr or in a log.** The engine writes fixed wording to stderr. whatsmeow's own log names
  JIDs, and a phone JID is a phone number, so it is off; `WA_ENGINE_LOG=<file>` turns it on at warning level, into a
  file kept like `private.db`, through a writer that masks every user JID (phone, device or LID form, and an old
  group id, which starts with its creator's number) and any other run of seven or more digits
  (`engine/cmd/wa-engine/redact.go`, WC-SECR-1). Errors reach the CLI as one of the contract's codes with fixed
  wording, and a reason where the recovery differs (`src/reasons.ts`).
- **Names without the phone.** WhatsApp has no "list chats" request. cli-core answers a name the store holds, and
  `watch`'s chat titles, from the store (`history: "store"`); only a name it lacks reaches the adapter. The engine
  answers that from what it can see without asking the phone: chats pushed in this process, the address
  book in `private.db`, and the joined groups (one request per process, then kept;
  `engine/cmd/wa-engine/directory.go`).
- **One npm package per platform.** The engine ships as `@wirecat/whatsapp-engine-<platform>-<arch>`, named by
  Node's `process.platform` and `process.arch` (`linux-x64`, `darwin-arm64`, `win32-x64`, and the arm64/x64 rest), each
  holding one static binary built without cgo by
  [`scripts/engine-packages.mjs`](../../scripts/engine-packages.mjs). `@wirecat/whatsapp-cli` lists all six as
  `optionalDependencies` pinned to its own version, and npm installs only the one whose `os` and `cpu` match.
  `engineBinary()` runs `WA_ENGINE` if set, else that package's `bin/wa-engine` found with `require.resolve`, else the
  checkout's `engine/bin/wa-engine`. No install script is involved: pnpm and npm block dependencies' scripts by
  default, so a download in `postinstall` would leave many installs without an engine. The pattern is esbuild's and
  biome's, and `@napi-rs/keyring` (through cli-base) already installs that way. A checkout never installs the engine
  packages (`ignoredOptionalDependencies` in `pnpm-workspace.yaml`): a version's packages reach npm only when it is
  released, and pnpm cannot lock a package npm does not have.
- **Why the connection ended is kept, and a cut write is never "stopped".** When WhatsApp ends the connection (logged
  out, replaced by another connection, banned, outdated), the engine keeps why (`engine/cmd/wa-engine/events.go`) and
  answers every later request with it, with its reason, instead of connecting again: after "replaced" a reconnect
  would take the login back. A request already on the way that fails as "not connected" answers that reason too
  (`refusalFor` in `engine/cmd/wa-engine/errors.go`): a relayed command on `serve`'s connection never asks to
  connect, so it would otherwise read `network_error` and retry. The client rejects a write still waiting when the
  engine process ends with `outcome_unknown`, a read with `provider_unavailable`. `ENGINE_OPS` in
  [`contract.ts`](../../src/engine/contract.ts) classifies every op as a read or a write; a new op fails typecheck and
  the engine's tests until it is classified there and, for a write, in the engine's `writes`.
- **A dropped connection comes back by itself; a write it cut is `outcome_unknown`.** whatsmeow reconnects after a
  network drop and sends a frame still waiting once more; the engine reports `disconnected`, then `connected` (also
  when a keepalive recovers), and `watch` and `feed` listen on through both, so `serve` keeps saving. A write that
  was on its way when the socket broke (whatsmeow's `DisconnectedError` or `ErrNotConnected` after its retry, a timed
  out info query, or the engine stopping) answers `outcome_unknown`, even after `replaced`: it may have reached
  WhatsApp, and a retry would send it twice (`refusalFor` and `writes` in `engine/cmd/wa-engine/errors.go`, the same
  writes as `ENGINE_OPS`). The engine connects with its own context, which whatsmeow hands to its reconnect loop, so stdin
  closing ends a dial or a reconnect at once instead of holding the device lock past the CLI.
- **`serve` does not restart the engine itself; its unit restarts `serve`.** An engine that dies, or a connection
  WhatsApp ends, ends `serve` with the reason, as tg's `serve` ends when Telegram's updates stop. cli-core's unit
  restarts it 30 s later (`Restart=on-failure`), except on the exit codes in `NO_RESTART_ON`
  ([`src/program.ts`](../../src/program.ts)): 4 (logged out) and 5 (banned: a restart would connect during the ban).
  `device.replaced` and `client.outdated` exit 12 like a crashed engine, so the unit still restarts on them
  (BACKLOG). A one-shot command never restarts anything: it exits with the engine's code.
- **Holds on writes are cli-core's.** `fromEngine` ([`src/adapter/errors.ts`](../../src/adapter/errors.ts)) gives
  WhatsApp's 429 a `standing: limited` ending 15 minutes on, and a ban a `standing: banned` ending when WhatsApp's
  temporary ban does (the engine passes whatsmeow's `TemporaryBan.Expire` as `until`, protocol 11), or with no
  `until` when it gives no end; cli-core's `flooded` turns either into a hold on every write, reads go on, and
  `flood clear` or `doctor --online` (the adapter's `health`, which connects) lifts the ban's hold. Not
  `retry_after_ms` alone: cli-core's pace would then hold reads too.
- **Early events are kept.** An event nobody listens for yet is handed to the first listener of its kind
  ([`events.ts`](../../src/engine/events.ts)), so the history pushed right after connecting reaches `feed` even when
  `watch` subscribed first.

## 5. One id per one-to-one chat

cli-core can link two identities of one person but cannot merge two chats. A one-to-one chat stored once under the
person's phone JID and once under their LID would split its messages. **The engine emits every one-to-one chat in
LID form** when WhatsApp has a LID for the user, and the phone JID only as a linked identity. In the first live run,
58 of 71 one-to-one chats were already LIDs.

A user WhatsApp gives no LID for stays in phone form, and may get one later. The engine keeps every one-to-one chat
id it has emitted in phone form in its own table in `private.db` (`wa_phone_chats`, §7), and after each message and
each history push checks them against what that message or push says and against whatsmeow's LID store, which keeps
every mapping WhatsApp sends — in history, in a message's alternate address, in a lookup's answer — before the event
reaches the engine. A chat whose person now has a LID is announced as a re-key `{from, to}`: in the history push's
`rekeys`, or as a `rekey` event sent before the message under the new id. The adapter's `feed` hands both to cli-core
as `HistoryBatch.rekeys` (a `rekey` event as a batch of its own), and cli-core moves the stored chat to the new id
before the batch's messages land. A live message comes through `watch`, whose events cannot carry a re-key, and need
not: `serve` and `watch` run `feed` beside it. cli-core saves the two on separate paths, so the message may land
first, in a new chat under the LID; the re-key then merges the two. At each start the engine announces the
re-keys whatsmeow learned while it was not running, and repeats those of the last 30 days: a one-shot command does
not save history, so the first announcement may have had no listener, and cli-core takes a repeat as a no-op. Only
chat ids are recorded — a message's chat, a history chat, the chat of a send, a file, a forward, a poll or an edit —
never senders or contacts. Once re-keyed, a chat is never emitted in phone form again — not in a message, a
history push, a send's result or the chat directory: the engine takes its LID from the table wherever whatsmeow's
store does not answer, and keeps the row after the 30 days of repeats.

For a chat still in phone form the engine asks WhatsApp itself, with the request `contacts profile` makes
(`GetUserInfo`), whose answer whatsmeow stores with the LID. Many such requests in a row are what a scraper sends,
so they are bounded: only for chats already in the account (the table above), five people per request, one request
per 10 seconds (the number lookup's gap, with a pace of their own so the owner's `lookup` is never refused for
them), at most 20 people per run, each person at most once a week (`wa_lid_asks` in `private.db`, written before
the request goes out; a request that cannot be recorded is not sent), and a request that fails ends the run. The
10 seconds hold within one process; after a restart the minute's wait below keeps them apart. A run starts a minute
after the last history push, so the pushes after connecting have settled and a one-shot command, which ends sooner,
never makes one; the on-demand pushes that answer `messages sync` start none, and the run that links the device makes
none. Each LID found goes out as a re-key.

WhatsApp's 429, on a lookup or on any other request, stops the lookups for a week, across restarts (a row of
`wa_lid_asks`). A 429 a lookup met has no command to refuse, so the engine refuses the next write with
`account.rate-limited`, and the CLI holds the profile's writes from there as after any 429 (WC-PERM-18). `serve` goes
on: ending it would make its unit start it again, and a new run with it.

## 6. One connection per linked device

WhatsApp drops the older of two connections for the same device. `serve`, `watch`, the MCP server and a one-shot
write can each open one. So the engine takes an exclusive lock on `private.db.lock` **before it can connect**, and
writes the holder into it (`serve (pid 4242)`); a second engine is refused with that name. The lock is `flock` on
Unix and `LockFileEx` on Windows, and the operating system releases it when the process dies. While `serve` runs,
other commands go through it instead ([6b](#6b-commands-through-a-running-serve)).

## 6a. Linking

`wa <profile> session start [qr|phone]` starts the engine with `--link`, the only run allowed on a profile with no
device. The phone pushes its history once, seconds after linking, and never again. So the command keeps the same
engine open and hands it to cli-core's own connection (`withMessenger`, which saves through `feed`), and keeps
receiving until the phone has been quiet for 45 seconds, or Ctrl+C. Nothing here saves to the store itself.

`session start` and `setup` share this as `startSession` (`src/commands/session.ts`), as tg's two commands do. A
linked device asks nothing, so only a profile that would have to show a code is refused without a terminal or
`--qr-file`; a `private.db` left without a device by an unfinished link counts as unlinked. `setup` then reads the
account through one more connection and five chats from cli-core's store, since WhatsApp has no chat list to ask for.

`wa doctor` reads the engine binary, the device keys' modes and the lock's holder text from disk
(`src/diagnose.ts`). The engine never clears the holder text, so a holder counts as running only while its pid does.

## 6b. Commands through a running `serve`

cli-core does this; `wa` only opts in. `WHATSAPP` in [`src/messenger.ts`](../../src/messenger.ts) sets
`connection: "exclusive"` (cli-core 0.313.0 and later). `serve` then listens on a socket beside cli-core's serve
lock (`<state>/serve/<profile>.sock`, mode `0600`; not the engine's `private.db.lock`) and writes its address into
that lock. A command that would connect
finds the address there and runs inside `serve`, on `serve`'s connection, instead of starting an engine of its own.
The send guard and the permissions run in `serve` with the client's environment. Linking, `mcp --http` and
`--offline` or `--dry-run` runs stay in their own process. cli-core's `relay-route` picks what goes through `serve`;
its `serve-relay` is `serve`'s side. On Windows the relay is off for now, so there the lock refuses as in §6. Nothing
in `src/adapter/` or `engine/` knows about the relay. `session start`, `session end` and `setup` are marked
`logsInOrOut`: cli-core never relays them (a relayed logout would end `serve`'s own connection and delete the keys
under it) and refuses them under `WA_READ_ONLY` before they act. Run here, `session end` meets the device lock
`serve` holds (`device.in-use`) and says to stop `serve` first. A login or logout that a client of an older `wa` still
relays to `serve` is refused by cli-core's `run()` with `permission_error`.

## 7. What is on disk

| Path | What | Mode |
|---|---|---|
| `~/.local/share/whatsapp-cli/profiles/<profile>/private.db` | the engine's device store: the linked device's keys | 0600, dir 0700 |
| `…/profiles/<profile>/private.db.lock` | who holds the device's one connection | 0600 |
| `…/profiles/<profile>/private.db.lookup` | empty; its time is the last number lookup, for the 10-second gap | 0600 |
| cli-core's store (`~/.local/share/WireCat/wirecat.db`) | chats, people, messages for every messenger | cli-core's |
| `~/.config/whatsapp-cli/` | settings; never a secret | |

One device per `private.db`: the engine opens the one device in the file, refuses a file with several, and treats
an empty one as not linked. The engine runs with umask 077, so SQLite's `-wal` and `-shm` beside it are 0600 too.
Only the engine writes `private.db`; it holds keys and device state, never messages. Beside whatsmeow's tables the
engine keeps one of its own, `wa_phone_chats`: the one-to-one chats it emitted in phone form and, once re-keyed, their
LID (§5); and `wa_lid_asks`, when the engine last asked WhatsApp for each one's LID. whatsmeow's LID map already holds
those numbers in the same file. `session end` deletes the file; a logout from WhatsApp's side leaves it, so the engine
empties both tables when it opens a device not yet linked.

## 8. On the wire

The probe (`engine/cmd/wa-probe`) pairs as `Chrome (Linux)` with the desktop platform, so the phone sends full
history, and names the device after the host system. The Go engine does the same: nothing WhatsApp sees names
this tool. It sends delivery receipts, as every WhatsApp client does, and never presence. A read receipt goes only
when the command typed asked for one: `chats mark-read`, or `--mark-read` on a read.
