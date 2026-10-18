# Changelog

Notable changes to `@wirecat/whatsapp-cli`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the command interface may still change.

## Unreleased

### Changed — may break callers

- **The MCP server's `wa_read` and `wa_write` take each command's own arguments, in snake_case.** `search messages`
  takes `query` (not `text`) and no `ast`; `polls create` takes `question`; `wa_tools_search` shows each command's
  fields. The agent is offered every command the profile's permissions allow, including some it was not offered
  before; marking read, `--as-owner` and `--allow-any-file` stay off MCP. An agent's runs are named `mcp <command>`
  in run history and the send journal. `conversations rebuild` replaces the agent-only `conversations_refresh`.
- **`session start phone` and `setup --method phone` refuse a number without `+` and the country code** (exit 2,
  `input.invalid`). WhatsApp reads the first digits of the number as the country code, so a number typed the way it
  is dialled at home asked for a pairing code on someone else's account. Nothing reaches WhatsApp until the number
  starts with `+`.
- **`messages delete` without `--for-everyone` deletes the message for you only, where it used to be refused** (exit
  2). `wa` asks WhatsApp to take the messages from this account's devices, to leave them with the
  others in the chat, and to keep the photos and files the phone saved from them. Each message must be in the local
  store, since WhatsApp names it by its sender and the time it was sent; one the store lacks is exit 6 and nothing is
  deleted. A device without WhatsApp's settings keys yet answers `settings.keys-missing`, as `chats mute` does. An
  agent's `messages delete` over MCP, which was refused too, now does the same, for the owner only; deleting for
  everyone stays the owner's `--for-everyone`. A deletion asks first by default, and over MCP that level lets the
  agent's call through, so at the default an agent can now delete the owner's copy. To keep agents from it, set
  `permissions.messages.delete` to `readonly` or `deny`: the MCP server then does not offer the command, and an
  agent's call answers `validation_error` (`input.invalid`, no such command), as before; the owner's own `messages
  delete` at those levels is refused with exit 5. A delete
  of several messages that fails partway, with or without `--for-everyone`, now names the ones already deleted and
  is not marked safe to retry: delete only the rest. A message you delete for yourself on the phone leaves the
  local store the same way while `serve` or `watch` runs. Not yet checked live on the phone.
- **`messages download` asks your phone for a file WhatsApp no longer keeps**, as WhatsApp's apps do, instead of
  answering `not_found` (exit 6) at once. It waits up to 20 seconds for the phone to upload it again and fetches the
  new copy. A phone that does not answer ends the download with `timeout` (exit 9); exit 6 now means the phone no
  longer has the file either. A script that read exit 6 as "expired" must also expect exit 9, and give a slow phone a
  longer `--timeout`. A new copy that then fails to download is `provider_error` (exit 11, `media.retry-failed`),
  whatever the first failure's code was. The new copy's address is not kept, so each later download asks again, and a
  forward of such a file may still reach the recipient as one that will not open. Not yet run against WhatsApp.
- **`messages forward` sends a stored place or contact card, where it used to refuse it.** The store now keeps a
  place's coordinates, name and address, and a contact card itself, next to a file's keys, where no answer shows
  them. A place or card stored before this, a live location and several cards in one message are still refused.
- **A person's chat moves to their LID when WhatsApp gives them one.** WhatsApp names a one-to-one chat by the
  person's phone number until it gives them a LID, its private id for a person. `serve` and `watch` now move the
  stored chat and its messages to the LID, so `messages list` and `search` show one chat, and no chat is left under
  the phone-number id (`…@s.whatsapp.net`). A script that saved that id must take the new one from `chats list`. The
  move is repeated at each start for 30 days, so one that came while only a one-shot command ran still lands. A
  send typed to the old id stores a chat under it again, which a later repeat of the move merges.
- **`serve` asks WhatsApp for the LID of a chat still in phone form**, so that chat moves too. It asks a minute after
  history stops coming, for chats the account already has only: five people per request, one request every 10
  seconds, at most 20 people per run, and each person at most once a week. The owner's own `lookup` keeps its own
  pace. If WhatsApp asks to slow down, the lookups stop for a week and the next write is refused with
  `account.rate-limited`, which holds the profile's writes for 15 minutes. Not yet run against WhatsApp.
- **A command cut off by a dropped or ended connection no longer answers `network_error`** (exit 10), which invited
  a retry and a double send. A send, edit, reaction, group change or other write whose request left before the
  network dropped, and could not be sent again, now answers `outcome_unknown`: exit 14, `retry.safe: false`, also
  when WhatsApp handed the login to another connection meanwhile, since the write may have gone through. Check the
  chat before you send again. Otherwise, a command relayed through `serve` while another process took the login over
  now answers `device.replaced`, and after a ban or a logout `account.banned` or `device.logged-out`. A script that
  retried on `network_error` must not retry these.
- **`chats rules set` refuses a `newAccount` rule** with `validation_error` (exit 2) and saves nothing: WhatsApp does
  not say when an account was made, so the rule was saved and could never match. A script that sets one must drop it.
- **A send that waits on another `wa` process exits 9, not 1** (cli-core 0.338.0): when another process on the
  profile is sending or clearing the pace for longer than the 5 s wait, a send or `flood clear` answers `timeout`,
  since nothing was sent and a retry is safe. A change to the recipient list held elsewhere for 5 s is
  refused with exit 9 and the list stays as it was; two changes at once no longer undo each other.
- **`wa upgrade --offline` exits 2** instead of asking npm anyway.
- **`WA_READ_ONLY` refuses more, always with exit 5 and "this process is read-only (WA_READ_ONLY)"** (cli-core
  0.328.0 to 0.337.0). An agent that did any of these under the lock must do it in a process without
  it. Newly refused:
  - `session start`, `session end` and `setup`, before they act ("it cannot log in or out"); `session start` and
    `setup` on a profile linked before used to go ahead;
  - the message store: `store reset`, `restore`, `clear`, `migrate`, `repair`, `decrypt` and `copies delete`
    (`--dry-run` still previews);
  - what the owner saved: `searches create|delete|clear`, `contacts alias set|rm`, `contacts notes
    add|edit|remove` and `tags remove`;
  - other local writes: `tags add`, `tags auto`, `mentions confirm|reject`, `contacts link|unlink`, `attachments text
    set`, `chats tracking add|remove`, `conversations links add|clear`, `conversations consents revoke` and `tasks
    reject`; `tasks close` only suggests the close;
  - and their MCP tools.

  `messages delete` under the lock exits 5, not 7 ("asks before it acts"). `wa upgrade --check` now runs under the
  lock; `wa upgrade` without it is still refused.
- **`conversations embed` and `conversations build` count as writes to an outside service, and `search
  conversations` as a read from one** (cli-core 0.334.0, 0.336.0): a failed run is not marked safe to
  retry, and under `WA_READ_ONLY` each refuses before it sends chat text or the query to a remote provider; a local
  model still works. They always run in the calling process, never through `serve`. Their help now says "Changes
  something in WhatsApp", which here means the outside provider.
- **A ban or rate limit holds every write, for as long as it lasts** (cli-core 0.334.0): while WhatsApp has the
  account banned or rate-limited, a reaction, `chats mark-read` and a group title change are refused with exit `5`
  too, not only sends and edits. Reads still work; `inbox` and `review` with `--mark-read` still show what they read
  and warn that nothing was marked read. A temporary ban WhatsApp dates holds writes until its end, the error says
  when, and `standing.until` is that time. A ban with no end has `standing.state` `banned`, not `frozen`, and
  `until: null` in `doctor --json`, `flood clear --json` and `server status --json`, where it held for a year
  before; `wa <profile> flood clear` or a `doctor --online` that connects lifts it.
- **`serve` banned by WhatsApp is not restarted by its unit** (exit 5 joins exit 4 in the unit's no-restart list):
  a restart 30 s later connected again during the ban. `wa <profile> server status` says it stopped and will not
  restart; start it again with `wa <profile> server start` once the ban ends.
- **An older client's `session end` relayed into `serve` is refused** with `permission_error`, exit
  `5`, `sent: false`, naming `server stop`; it was `provider_unavailable`, exit `12`, `device.in-use`. `serve`'s
  connection and the keys stay as they were.
- **Ctrl+C or `--timeout` during the history wait after linking ends the wait, not the command**: `session start`
  keeps what arrived, counts it and exits 0. It exited 130 or 9, though the device was linked. `setup` goes on to
  its account, chat and agent steps, which get a deadline of their own (cli-core 0.334.0); a
  Ctrl+C after the wait ends setup (130). With `--timeout`, the link and the wait share that one deadline, and the
  steps after it get that long again.
- **`chats list` and `chats show` answer from the local store and never connect** (cli-core 0.328.0), so they run
  here while `serve` runs. `recipients add` runs through `serve` instead of being refused with exit 12.
- **A link without a terminal waits 5 minutes by default, not 30 seconds** (cli-core 0.328.0), so an agent's
  `session start --qr-file` is not cut off before the code is scanned. `--timeout` still decides when given.
- **A command path given as one argument fails** (cli-core 0.328.0): `wa 'chats list'` printed the root help and
  exited 0; it now fails with `validation_error`.
- **`wa mcp` offers only what `wa` has** (cli-core 0.328.0, 0.335.0): `chats link create`, which failed, is gone,
  and a command that refuses `--offline` no longer has an `offline` input; an agent that passes one gets
  `validation_error`. `metadata get` and `metadata refresh`, which failed too, now work (see Added).
- **`chats events` answers from the local store** (cli-core 0.336.0): it no longer refuses with exit `2`, never
  connects, and works with `--offline`. `wa` does not record joins and leaves yet, so the list is empty and `watch
  --events` has no chat events to show, and `stats chats show` leaves `members` out, sets `complete` to `false` and
  says in `missing` (and on stderr in text mode) that joins and leaves are not recorded for this chat yet (cli-core
  0.337.0).
- **A chat or person named by name is found in the local store first** (cli-core 0.337.0): part of the name is
  enough, and a name several stored chats match is refused with "… matches N chats", as `chats show` refuses it; a
  caller that matched the old "N chats share that name" must match the new text. Only a name the store does not hold
  is asked of WhatsApp's chat list, so a one-shot command now finds a stored group by its name. `watch` titles a
  chat from the store and follows its renames; a chat the store has never held has no title in `watch`.
- **A live edit or deletion of a channel post is no longer passed on**: `watch` and `serve` used to hand it on under
  an id the store does not file the post by. A channel's posts are now read with `messages sync <channel>`.

### Fixed

- **A download your phone could not give back says why, in its `reason`**, not only in its words. A file
  WhatsApp no longer keeps fails, per file in `batch.failures`, with `media.not-on-phone` (the phone has it no more),
  `media.phone-cannot-decrypt` (the phone could not read the request), `media.phone-failed` or
  `media.phone-answer-unreadable` (the phone answered an error), `media.phone-timeout` (no answer in 20 s),
  `media.retry-failed` (the new copy did not download) or `engine.stopped`; branch on those, never on the message.
  A download the phone's new upload served writes one line, `media.reuploaded`, to the engine's log when
  `WA_ENGINE_LOG` is set: the download's answer has no field for it.
- **Node 22 no longer prints `ExperimentalWarning: SQLite is an experimental feature`** on every command that opens
  the store. Other warnings still print.
- **`wa mcp --help` and the root help suggest `claude mcp add wa -- wa <profile> mcp`**, where they suggested a
  command without a profile that always failed.
- **The commands page labels `conversations embed`, `conversations build`, `search conversations` and the model
  downloads as sending text to, or reading from, an outside service**, not as changes in WhatsApp.
- **A chat muted for good on the phone is stored as muted**, so `inbox` leaves it out. The history the phone sends
  marks such a mute with an end no clock can read (WhatsApp writes -1 into an unsigned field), and `wa` took that for
  a mute that had already ended. Any end past the year 9999 now reads as muted with no end, as whatsmeow reads it in
  app state. How the phone writes it in history is not yet checked live.
- **A lock another process holds no longer stalls `serve`** (cli-core 0.340.0): the send journal, the request pace
  and `recipients add` used to wait for it by blocking, so every relayed command and the connection's keep-alives
  stopped for up to 5 seconds. They now wait without blocking; the `timeout` (exit 9) is unchanged.
- **`setup` without a terminal no longer waits 5 minutes on a dead connection after the history push** (cli-core
  0.340.0): the steps after it get the usual 30 seconds. At a terminal they stay unbounded.
- **The MCP `messages list` tool no longer offers `topic:`** (cli-core 0.340.0): WhatsApp has no forum topics, and a
  `topic:` term is refused as an unknown field, as on the command line.
- **`chats admins add` has a summary that fits in 80 characters** (cli-core 0.340.0): "make a member an admin, with
  every right"; `--help` still names the seven rights.
- **A late answer from the phone no longer ends the next `messages sync` page early**: each request for older messages
  goes under its own id, and an answer that names an earlier request is saved like any history the phone sends instead
  of being taken for the current page. An empty late answer used to read as the chat's start. This holds if the phone
  names the request by that id, which is not yet checked live; otherwise answers are matched by their chat, as before.
- **A page the phone sends in pieces is filled**: when the phone sends fewer messages than asked, `wa` asks again from
  the oldest one it sent, one second apart, at most three asks and 25 seconds per page; what arrived before a
  timeout is kept.
- **A rate limit or a ban that ends `watch` or `serve`'s feed holds the next command's writes** as a one-shot
  command meeting it would.
- **`images embed` runs inside `serve` when `serve` holds the connection** (cli-core 0.337.0): it
  downloads pictures through WhatsApp, so it is a read from WhatsApp, and its MCP tool has no `offline` input.
- **Model downloads no longer go through a running `serve`** (cli-core 0.336.0): `models text download`, `models
  audio download` and `images models download` fetch from a model host, so they run in the calling process.
- **`wa chats list --json | head` ends quietly** (cli-core 0.328.0): through a running `serve` the client kept
  writing into the closed pipe and printed a stack trace; it now exits 0.
- **The phone-number and agent prompts of `session start` and `setup` go to the run's own stderr**, so a test or an
  embedding program that captures the run sees them.
- **`polls vote` and `polls voters` no longer mention anonymous polls** in their help and their agent tools
  (cli-core 0.328.0): WhatsApp has none.
- **`--json=item.<field>` keeps that field** (cli-base 0.44.0): `--json=item.profile` printed `item: {}`.
- **A query with a `/` that opens a regular expression and never closes it says to quote the value** (cli-base
  0.44.0): `text/plain` now hints `"text/plain"`. The error code and reason are unchanged.

### Added

- **`wa <profile> conversations rebuild`** builds, then embeds on this machine, the chats that changed and the group
  chats never built, or only `--chat`, bounded by `--max-chats` and `--max-chunks`. It sends nothing anywhere.
- **`wa <profile> chats mute` and `chats unmute`**: stop a chat's notifications for good or `--until` a time (`2h`,
  `7d`, `2026-09-25T09:00`), and hear it again; agents run both through `wa_write`. It is the account's own
  setting, which WhatsApp syncs to the other devices; nobody in the chat is told (not yet checked live on the phone).
  It is a write and goes through the profile's permissions, under `chats.mute` and `chats.unmute`; a setting for
  `chats.mute` alone still covers both. A device linked minutes ago may not have WhatsApp's settings keys yet: the
  command then answers exit 12 with reason `settings.keys-missing` and says to keep `serve` running a few minutes. A
  channel is muted on the phone.
- **`wa <profile> chats archive` and `unarchive`, `chats pin` and `unpin`, and `chats mark-unread`**: move a chat
  into WhatsApp's archive and back, keep it at the top of the chat list, or mark it unread, on the account's
  devices; nobody in the chat is told. Agents run them too, through `wa_write` (`command: "chats archive"` and the
  rest). `chats pin` pins the chat, not a message (`messages pin` does that). Archiving a chat also
  unpins it. Archive, unarchive and mark-unread name the chat's newest stored message, as `chats delete` does, and
  refuse a chat the store holds nothing of (exit 6); pin needs no message. WhatsApp's apps keep three pinned chats;
  `wa` does not count them. A mark-unread sends no receipt; `chats mark-read` sends only a receipt, so it may not
  clear the mark. Channels are refused. Each answers `settings.keys-missing` as `chats mute` does, and has its own
  permission key (`chats.archive`, `chats.unarchive`, `chats.pin`, `chats.unpin`, `chats.mark-unread`), allowed by
  default. Not yet checked live on the phone.
- **`wa <profile> chats delete` and `chats clear`**: delete a chat, or every message in it, from this account's
  devices; the others in it keep theirs. WhatsApp deletes up to a message it is told of, so `wa` names the chat's
  newest message in the local store, the owner's own or not, and refuses a chat the store holds nothing of (exit 6)
  rather than guess. A message that arrived after the store last heard should stay. `chats clear` deletes starred
  messages too; neither asks WhatsApp to delete the photos and files the phone saved from the chat. Both ask first
  at the default permission level (`chats.delete`, `chats.clear`; `--allow-dangerous` skips the question), are not
  offered over MCP, and answer `settings.keys-missing` as `chats mute` does. The local store keeps the chat's
  messages. Not yet checked live on the phone.
- **`wa <profile> messages star` and `messages unstar`**: star one message so it is easy to find again, or take the
  star off. It is the account's own mark, which WhatsApp syncs to the other devices; nobody in the chat is told. The
  message must be in the local store, since WhatsApp names it by its sender; one the store lacks is exit 6 and
  nothing is sent. A channel's post is starred on the phone. It goes through the profile's permissions
  (`messages.star`, `messages.unstar`), an agent can do it over MCP, and it answers `settings.keys-missing` as `chats
  mute` does. The local store keeps a star set with `wa`, so `messages list <chat> starred:true` and `search
  messages is:starred` find it. While `serve` or `watch` runs, a star set or taken off on the phone reaches the
  store too, and `watch --events --jsonl` prints it as `{ "event": "star", "chatId", "chatTitle", "messageId",
  "starred" }`; the messages the phone pushes after linking keep their stars. The store moves to version 24
  for this the first time this version opens it; `wa` 0.1.0 still opens it. Not yet checked live on the phone.
- **`wa <profile> messages pin` and `messages unpin`**: a message in the local store is pinned for the whole chat; a
  message the store lacks is `not_found`. WhatsApp tells the chat's members about every pin, so each one notifies and
  counts toward the hourly limit; `messages pin` takes no `--notify`, and an agent's `wa_write` call no `notify`.
  `--expire-time 24h`, `7d` or `30d` (MCP `expire_time`) says how long it lasts; without it the pin lasts 7 days, as
  the help says; any other length is `validation_error`, over MCP before it connects.
- **`wa <profile> account privacy show` and `account privacy set`**: who sees last seen (`--last-seen`), the
  profile photo (`--profile-photo`) and the about text (`--about-text`), whether online and last seen are hidden
  (`--hide-online`), whether read receipts go (`--read-receipts`; off also hides others' receipts from the owner, as
  on the phone), who may add the account to groups (`--chat-invites`) and whose calls ring (`--calls`). `show` asks
  WhatsApp each time, and reports a setting kept on the phone as "my contacts except…" as `contacts_except`, which
  `set` refuses; for groups that value is left out. `set` changes only the settings named and answers them all; it
  is a write under `permissions.account.privacy.set`. WhatsApp has no setting for who finds the account by its
  number or who sees the number, so `--find-by-phone` and `--phone-number` are not offered. Refused before anything
  is sent: `--chat-invites nobody` (WhatsApp is reported to refuse it), `--calls nobody`, and `--hide-online` with
  `--last-seen`, which both set last seen. `--calls contacts` sends the value meant as the phone's "silence unknown
  callers" (not yet checked on a real account). `--hide-online off` shows last seen to contacts. `set` sends one
  request per setting: if WhatsApp fails one, those sent before it stay changed, and the error says so; a change cut
  by a dropped connection answers `outcome_unknown` (exit 14), since it may have gone through.
- **`wa <profile> account update` sets the owner's WhatsApp name, about line and profile photo**: `--first-name` sets
  the name people see, with `--last-name` joined to it after a space (WhatsApp keeps one name, so a last name alone is
  refused), and `--description` the "about" line. The name is a setting WhatsApp syncs to the other devices; others
  probably see it only once the phone next comes online, since a device tells WhatsApp its name when it says it is
  online and `wa` never does (not checked live). `--photo` sets the profile photo (not checked live): `wa` takes
  a square JPEG of 190 to 720 pixels a side, as for a group's photo, checked before anything changes. The answer is
  the account with the new name. A device without WhatsApp's settings keys yet answers `settings.keys-missing`, as
  `chats mute` does; the name goes first, then the about, then the photo, and a step WhatsApp refuses after another
  changed says which did. The permission key is `account.update`.
- **`wa <profile> chats update <group> --photo <file>` sets the group's photo.** WhatsApp takes only a square JPEG
  of 190 to 720 pixels a side, and `wa` does not convert one: anything else is refused with `validation_error`
  before WhatsApp is asked, a PNG or WebP by its bytes whatever its name. The photo is set before the title,
  description or settings given with it, so a refused photo leaves the group unchanged, and a `--title` over 25
  characters is refused before the photo is set. If the rest of the change then fails, the error begins "the photo
  was set", keeping its code. It runs under the same permission and hourly limit as the rest of `chats update`.
  Removing a group's photo is not built.
- **A group says which WhatsApp community it is in.** A group linked to a community answers with `parent_chat_id`,
  the community's id; the community itself is a group with `provider_metadata.community: true`. They come with the
  group as WhatsApp gives it: the answers of `chats update`, `chats create` and `chats join`. The local store does
  not hold them yet, so `chats list` and `chats show` do not show them. Listing a community's groups, and linking or
  unlinking one, are not built.
- **A photo and a video in one send go as an album** (`messages send --photo … --file clip.mp4`): one message that
  announces the album, then each file tied to it. The text is the photo's caption and the answer is the photo's
  message, under the send id. A repeat with the same `--operation-id` after an unknown outcome sends the same message
  ids, which WhatsApp takes as the same messages, as it does for a single send. A document beside a photo is still
  refused. Not yet checked against WhatsApp's apps.
- **A sent photo carries its preview**: the chat shows a small blurred picture before the download. Not yet for a
  video or a WEBP photo.
- **`wa <profile> metadata get` and `metadata refresh`** read a group's title and description into the store for
  `tags auto`; the group is not changed, and agents get both. A channel in the list answers with an error of its
  own.
- **`tasks agenda` lists what others owe you** (cli-core 0.328.0): `assigned` in JSON and an "assigned — others owe
  you" section hold the open tasks someone else does, oldest first, each with its `assignees`.
- **`wa commands --json` has two new keys** (cli-base 0.44.0): `runnable: true` on a group that runs on its own, and
  `offline: false` on a command that cannot answer offline. A reader that rejects unknown keys must accept them.
- **`wa` follows and reads WhatsApp channels**, the one-way chats whose ids end in `@newsletter`: `chats join
  https://whatsapp.com/channel/<code>` follows one and `chats leave <channel>` unfollows it, both through the
  profile's permissions, and the channel's admins see that you followed. The channels you follow reach `chats list`
  as `kind: "channel"` when `serve` or `watch` connects. `messages sync <channel>` reads its posts into the local
  store from WhatsApp's servers, not from your phone: newest first, 50 at a time. Each post keeps its message id, and
  WhatsApp's number for it is in `provider_metadata.serverId`. Every post's sender is the channel, so a post you
  made shows `outgoing: false`. See [channels](docs/usage.md#channels).
- **`wa` posts to a WhatsApp channel you run**: `messages send <channel> <text>` asks WhatsApp for your role in the
  channel first and refuses anyone but its owner and admins with `permission_error` (exit 5) before anything is sent.
  The channel's followers see the post at once. Text only, and not a reply; a file, a poll, a forward, an edit or a
  deletion in a channel is refused before anything is sent. A refused post still passes the profile's send
  permissions first, so under `ask` it asks before it is refused. Not yet checked live.

## 0.1.0 — 17.10.2026

### Changed — may break callers

- **The engine dying during a write answers `outcome_unknown`** (WC-LIFE-9): exit 14, `retry.safe: false`, the
  `operation_id` kept, reason `engine.stopped-mid-write`. It answered `provider_unavailable` (exit 12), which
  invited a retry and a double send. A read cut the same way still answers `provider_unavailable`.
- **Device and account states carry a `reason`** (WC-OUT-15), so an agent branches on it instead of the message:
  `device.in-use` (another `wa` process holds the login: stop it, or run the command through `serve`),
  `engine.stopped`, `client.outdated` (update `wa`) and `device.replaced`, all `provider_unavailable`;
  `device.logged-out` (`authentication_error`); `account.banned` (`permission_error`); `account.rate-limited`
  (`rate_limited`). After WhatsApp ends the connection for one of these, later requests in the same process answer
  with it instead of connecting again. Engine protocol 10.
- **WhatsApp's rate limit and a ban hold the profile's sends** (WC-PERM-18). After WhatsApp asks the account to slow
  down, sends, edits and the other writes counted toward the send limit are refused for 15 minutes and reads go on;
  after a ban, until `wa <profile> doctor --online` connects again. Reactions and read receipts are not held.
  `doctor --online` reports a ban as `standing.state: "frozen"` (it said `banned`, which held nothing).
  `wa <profile> flood clear` lifts either hold. Both lengths are a default the owner may change.
- **`commands --json` marks more commands `mcp: false`** (cli-core 0.326.0, WC-MCP-2): `store`, `server`, `config`,
  `mcp`, `models`, `images models`, `skill`, `runs`, `doctor report`, `upgrade`, `complete`, `commands schema`,
  `account sessions end`, and the commands that change a later run's authority (`recipients`, `chats rules`). The
  MCP tool list `wa mcp` serves is unchanged.
- **In a group tagged `watch-tasks`, any member's direct reply closes a question** (cli-core 0.325.0), with the
  resolution "answered in the group". Before, only your answer closed it; a later message that does not reply to the
  question still closes nothing.
- **A device linked before answers without counts** (WC-OUT-13). `session start --json` leaves out `received`, and
  `setup --json` leaves out `history`, when the profile was already linked: nothing was pushed, so nothing was
  counted. They used to say 0, which read as "the phone pushed nothing".
- **Refusals that need a terminal say so in `reason`** (WC-OUT-15). `session start` and `setup` without a terminal,
  and `session start phone` without one, answer `reason: "input.required"`; `--qr-file` with the phone method names
  `param: "--qr-file"`.
- **No automatic replies** (cli-core 0.324.0). `wa` no longer has `replies`, and `serve` never answers by reply
  rules, even with `permissions.replies.send` at `allow`: WhatsApp bans accounts that answer like a bot, and `wa`
  sends nothing the owner did not ask for. A rules file left in the config folder is ignored.
- **Options WhatsApp has no counterpart for are no longer offered** (cli-core 0.324.0): `--silent` and `--send-as` on
  `messages send`, `messages forward` and `polls create`, `--at-time` on `messages send`, `--anonymous` on
  `polls create`, and the commands `chats send-as` and `messages scheduled`. They were refused before; now they are
  unknown, still with exit 2, and the MCP tools no longer take `silent`, `send_as`, `at_time` or `anonymous`.
- **Commands WhatsApp lacks refuse before connecting** (cli-core 0.324.0): `account update`, `account sessions list`
  and `end`, `chats events`, `chats inspect`, `chats folders *`, `contacts add`, `remove`, `rename` and `import`,
  `messages pin` and `unpin` refuse with exit 2 before connecting to WhatsApp.
- **`watch --events` no longer prints the votes of the phone's history push** (cli-core 0.322.0). They were
  printed as new votes; they are old ones, and the store now saves them with the push, together with their poll and
  dated when each person voted, so an older one never replaces a newer live vote. A script that read history votes
  from `watch` reads `polls voters` instead. Engine protocol 9.
- **An agent never deletes for everyone** (cli-core 0.321.0). Every WhatsApp delete `wa` makes is for everyone, so
  `messages delete` through MCP is refused with `permission_error`, before `wa` connects, whatever the profile's
  level; the owner still has `wa <profile> messages delete --for-everyone`.
- **`mcp --permission <key=level>` only narrows** (cli-core 0.321.0). An override that would give the server more
  than the profile — `readonly` to `allow`, a `deny` to anything — stops it at startup with `validation_error` naming
  the key. To let an agent do more, set the level in the profile. The browser setup no longer starts the server with
  `--permission messages.send=allow`.
- **Tasks open only where something is asked of you** (cli-core 0.318.0). In a one-to-one chat every question you did
  not answer opens one, as before; in a group only a question in reply to your message and a mention of you; in a
  channel or the chat with yourself nothing.
- **`tasks apply` is now `tasks scan`** (cli-core 0.320.0); MCP `tasks_scan`, permission key `tasks.scan`.
- **No setting picks a profile any more** (cli-core 0.319.0). A command names its profile with the first word or
  `WA_PROFILE`. A config file that still has `default_profile` stops a command that names no profile, with the profile
  to type and `wa config unset default_profile`; `wa config set default_profile` is refused. A profile called `default`
  is an ordinary name: `wa default mcp config` names its server `wa-default`, not `wa`.
- **`polls close` and `polls create --revote` are gone** (cli-core 0.317.0): a WhatsApp poll never closes and every
  vote can change. A script that closed a poll or asked for revoting drops that call.
- **`chats admins add` takes no `--can`**: a WhatsApp admin has every right, so it gives them all. A script that
  passed `--can` drops it.

### Security

- **`WA_ENGINE_LOG` no longer writes phone numbers** (WC-SECR-1): every user id (phone, device and hidden-id forms)
  and any other long run of digits is masked before a line reaches the file.
- **A release from GitHub Actions publishes the engine packages validation built and tested** (WC-REL-12): it checks
  each against the SHA-256 that validation recorded, and builds nothing again. This first release was published from
  the maintainer's machine, which builds them itself.
- **`WA_READ_ONLY` also stops linking and unlinking the device**: `session start` and `setup` refuse to link a new
  device, and `session end` refuses to log out, with `permission_error`.
- **An interrupted or timed-out login closes the engine and removes its QR image**, instead of leaving both behind.
- **The account name shown after linking is printed as plain text**, never as terminal control codes.
- **Media keys stay inside the client**: internal attachment references stay out of live-event, JSON and MCP output
  (cli-core 0.315.0).
- **Invite links must name WhatsApp's exact invite host**; unrelated URL prefixes are refused before connecting.
- **WhatsApp state is safe from the other messengers' uploads** (cli-core 0.314.0), and a running server's read-only
  lock holds when a command is relayed to it.
- **The Go engine builds with Go 1.26.9 and `golang.org/x/net` 0.60.0**, clearing the affected runtime and
  networking advisory paths while retaining the current Go release branch.

### Fixed

- **`session end` no longer runs through a running `serve`**: it logged out `serve`'s own connection and then
  deleted the device keys under it. It now refuses with `provider_unavailable`, reason `device.in-use` (exit 12),
  and says to stop `serve` first (`wa <profile> server stop`, or Ctrl+C).
- **The command reference no longer says `defaultProfile` in the config file picks a profile** (WC-ACCT-1): no
  setting does; the first word or `WA_PROFILE` names it.
- **Refusals name the whole command to run next**: `wa <profile> chats list`, `wa <profile> serve` and
  `wa <profile> session start`, where they said only `chats list`, `serve` or `session start`.
- **No `messages sync` advice `wa` cannot follow** (cli-core 0.322.0): where a command points at the store's gaps it
  names `messages sync <chat>` for one chat, never `--all`.
- **`wa upgrade`'s "held back" hint names the package and keeps pnpm's release-age exemption** (cli-core 0.320.0).
- **An agent's `chats members list` and `chats send-as` follow their own permission keys**, `chats.members.list` and
  `chats.send-as`, so a deny on those keys reaches the MCP agent too (cli-core 0.321.0).
- **A reply names the quoted message's sender and carries its text** when the local store holds that message, so
  phones show the quote instead of "unavailable"; a reply to one the store lacks still goes, with the message's id
  alone.
- **An edit keeps the message's own time**: one that `serve` or `watch` hears keeps the message's time, reply and
  reactions in the local store; before, it took the edit's time as the message's.
- **Tests on Windows check file access rules** instead of Unix mode bits. Group administration tests verify
  stranger refusals and unsupported changes before writes.
- **The search and query language pages said the file fields find nothing**; `has:file`, `filename:`, `mime:` and
  `content:` work on every message stored since `wa` handled files. The README and the docs start page no longer list
  files and group administration as coming next.
- **Release and monthly source checks include the Go engine**, using its module toolchain. Local tests resolve the
  shared TypeScript config directly so they run in isolated worktrees.

### Added

- **`wa <profile> flood clear`** (cli-core's, as in tg and max): forgets the waits WhatsApp asked for and lifts the
  hold on writes. The refusal during a hold already named it; `wa` did not have it.
- **`session`, `session start`, `session end` and `setup` carry `mcp: false`** in `commands --json` (WC-CMD-21):
  linking waits for a person and unlinking removes the owner's device, so neither will be offered to an agent once
  MCP tools are built from commands. `setup` and `upgrade` list examples there too (WC-CMD-24).
- **The engine packages are GPL-3.0-only**: `@wirecat/whatsapp-engine-*` and the `engine/` folder they are built
  from, because the engine links `go.mau.fi/libsignal` (GNU General Public License 3.0). Each package carries the
  GPL text as `LICENSE` and a README that points at the commit it was built from. `@wirecat/whatsapp-cli`
  stays Apache-2.0: it runs the engine as a separate program over stdin and stdout, and its package never carries
  the engine.
- **Each engine package carries `THIRD_PARTY_NOTICES`**: the licence of every Go module the engine links and of Go
  itself, with where each module's source is. whatsmeow and `go.mau.fi/util` are under the Mozilla Public License
  2.0 and `go.mau.fi/libsignal` under the GNU General Public License 3.0, all unmodified.
- **Tasks have assignees** (cli-core 0.320.0): `tasks add` and `tasks plan` take `--assignee sender` (whoever sent
  the message) or `--assignee person:<id>`; `none` clears it. `tasks list "assignee:any state:open"` is what others
  owe you.
- **`wa <profile> tags add --chat <group> watch-tasks`** records every question in that group as a task, whoever it
  is for.
- **Poll votes are counted**: `serve` and `watch` keep each person's newest vote, from the phone's history push and
  as votes arrive (`watch --events` prints them), so `polls show` counts the answers and says which you chose, and
  the new `polls voters` lists who voted for what. A poll made with `polls create` is kept in the local store, so it
  can be shown and voted on. Engine protocol 8; cli-core 0.317.0.
- **Commands while `serve` runs**: a send, an edit, a reaction, `watch`, `wa <profile> mcp` and every other command
  that connects run inside a running `serve`, on its one connection, instead of being refused. Permissions and the
  send guard still apply; a write at `ask` needs `--yes`. On Windows they do not go through `serve`.
- **The foundation**: the shared cli-core commands over a WhatsApp adapter that reads from the local store, an
  engine contract, and the same linters, checks and CI as tg-cli and max-cli.
- **Older history from the phone**: `wa <profile> messages sync <chat>` asks the phone for the 50 messages of a chat
  before the oldest one the local store holds, page after page, and waits up to 30 seconds for each answer (engine
  protocol 5; cli-core 0.316.0). `--all` is refused: WhatsApp has no chat list to walk.
- **More group settings**: `chats update --only-admins-send`, `--only-admins-edit-info` and `--disappear-time`
  (24h, 7d or 90d, the times WhatsApp offers; `off` keeps messages). A group's answer shows them in `settings`
  instead of `provider_metadata`. Engine protocol 7.
- **The WhatsApp engine**: `wa` connects through a Go program built on whatsmeow, started for each command that
  connects and stopped when it ends. One command at a time may connect a profile; a second is told which one holds it.
- **Installs with its engine**: `npm install --global @wirecat/whatsapp-cli` also installs the engine for your system,
  a small package of its own, for Linux, macOS and Windows on x64 and arm64. `WA_ENGINE` still runs another one. A
  global install also installs the agent skill and, on Windows, puts `wa` on the user's PATH, as tg does.
- **`wa <profile> session start [qr|phone]`** links the profile by QR code or pairing code and keeps the history the
  phone sends right after linking. **`session end`** unlinks the device and deletes its keys.
- **Changing messages**: `messages edit` (your own, within WhatsApp's 20 minutes), `messages delete --for-everyone`
  (your own, or another's in a group you administer), `reactions add` and `reactions remove`, and `chats mark-read`
  and `--mark-read`, which send a read receipt only when asked. Each needs the message in the local store, which
  `serve` keeps filled; WhatsApp addresses a message by its sender. Deleting for you alone is not built yet.
- **Files**: photos, videos, voice notes, audio, documents and stickers arrive as attachments, with places and contact
  cards named; `messages send --file`, `--photo` and `--voice` send one file with its caption; `messages download`
  saves a stored message's file; `messages transcribe --local` reads a voice note with a model on this machine
  (`wa models`); `messages forward` sends a stored message again, marked forwarded, file included; `wa images` searches
  pictures by what they show. The engine protocol is now 3.
- **Groups and people**: `chats create`, `join`, `leave`, `update` (name, description, admin-only adds, join
  approval), `chats link show|reset`, `chats members add|remove`, `chats admins add|remove`, `chats requests
  list|accept|decline`, `contacts profile`, `contacts block|unblock`, `contacts lookup` and `contacts sync` (the
  phone's address book), and `doctor --online` now connects to check the account. Group changes go through the send
  guard like a send; adding people is refused for anyone not in the address book or written to before, since
  WhatsApp bans accounts that add strangers. A number lookup is one per call, one every 10 seconds per profile.
  Engine protocol 4.
- **Formatting and polls**: `messages send --md` and `messages edit --md` write Markdown as WhatsApp's own marks
  (bold, italic, strike, code, quotes; a link becomes its label and address; underline and spoilers become plain
  text). `polls create` (one answer or `--multiple`), `polls show` and `polls vote` (`--retract` too) work on polls
  in the local store. Engine protocol 6.
- **`wa <profile> setup`** is the guided first run, as in tg: it checks this computer, links the device or reuses it,
  reads the account and five chats from the local store, and installs the agent skill (`--agent`). Agents use
  `--qr-file`.
- **`wa upgrade`** installs the newest version with the package manager that installed `wa` and restarts running
  servers; a daily line on stderr says when a newer version exists.
- **`wa doctor`** reports whether the engine program is found, whether the device keys exist with private file
  modes, and who last held the device's lock and whether that process still runs.
- **Documentation like tg's**: pages on linking and profiles, the local store, search and its query language,
  groups, people, MCP and the browser, permissions, limits, the CLI contract, diagnostics and recipes, each limited
  to what WhatsApp can do today. The agent skill (`wa skill show`) is rebuilt on tg's: setup without a terminal,
  the traps, the exit codes, and what one connection per device means for an agent.
- **A page on file attachments** ([docs/attachments.md](docs/attachments.md)): sending one file per message, what the
  local store keeps, downloading, forwarding, voice notes as text with a model on this machine, and reading the text
  of files for `content:` search. The README gains tg's sections on linking and profiles, groups you run, limits
  and the list of pages.
