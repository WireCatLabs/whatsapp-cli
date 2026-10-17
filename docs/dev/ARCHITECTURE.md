# Architecture

How `wa` is put together, and which seams you may not cross.

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

Dependencies point down only. `biome.json` enforces it: `src/commands/` reaches neither the adapter nor the
engine; `src/adapter/` never reaches commands, the program, the messenger or the shared store; `src/engine/` never
imports cli-core at all.

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
  clients ask. cli-core still refuses `messages sync` for a `history: "store"` messenger, so nothing reaches it yet
  ([BACKLOG.md](BACKLOG.md)).
- **A file is fetched by the keys in the store.** whatsmeow needs a file's path on WhatsApp's servers and its keys
  to fetch and decrypt it. The engine sends them with each message as the attachment's `ref`, and cli-core keeps them
  as the opaque `providerRef`, never shown in an answer. `messages download` and `messages transcribe --local` look the
  message up and hand the engine the stored attachment; `messages forward` sends the same keys again marked forwarded,
  as WhatsApp's own apps do, and refuses a message whose file the store has no keys for. A contact card is stored by its
  name only: the card holds a phone number.
- **A change to a message starts in the store.** WhatsApp addresses a message by its id, its sender and whether it
  is the account's own, and whatsmeow keeps no messages. So `messages edit`, `messages delete --for-everyone`,
  `reactions` and `chats mark-read` look the message up in cli-core's store first (`StoredMessages`, opened by
  `messenger.ts`, since the adapter may not reach the store) and send the engine the full key. A message the store
  lacks is refused as `not_found`: a guessed key is not refused by WhatsApp, it is dropped without a word.

## 4. The engine

The protocol runs in a Go program built on [whatsmeow](https://github.com/tulir/whatsmeow), started as a child
process. Why Go and why whatsmeow: [the protocol decision](https://github.com/WireCatLabs/cli-private/blob/main/research/2026-10-16-whatsapp-protocol-decision.md) (private).

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
- **The requests**: `connect`, `link`, `me`, `directory`, `chat`, `send`, `logout` and `close`, and four on a message
  the account already has, each addressed by `chat`, `message` (its id), `fromMe` and `sender`: `edit` (with
  `text`; whatsmeow's `BuildEdit`), `revoke` (`BuildRevoke`; someone else's message only in a group, as its admin),
  `react` (with `emoji`, `null` to take it off; `BuildReaction`) and `read` (one read receipt; `MarkRead`). Three
  carry files: `sendMedia` (`file`: a path on this machine and its kind; uploaded with `UploadReader`, then sent),
  `download` (`attachment` as stored, and `path`, which the engine creates 0600 in a folder the CLI made 0700 and
  removes after reading) and `forward` (`attachment` and `text` as stored). No file crosses the JSON line itself. In a
  group still addressed by phone numbers, the engine turns the stored LID sender into the phone JID the group
  expects.
- **Older history** (`engine/cmd/wa-engine/older.go`): `older` (`chat`, `message`, `fromMe`, `timestamp` of the
  anchor, `count` up to 50) sends whatsmeow's `BuildHistorySyncRequest` to the phone with `SendPeerMessage` and waits
  up to 30 s for the `ON_DEMAND` history sync that answers it, then answers `{messages, more}`. One request is in
  flight per process, so the batch is matched by its chat after conversion to LID form, or by naming no chat at all
  (nothing older); other chats and push names in the same batch go out as a `history` event. `more` is whether the
  phone sent any of the chat's messages, even ones the contract skips.
- **Group and people requests** (`engine/cmd/wa-engine/groups.go`, `people.go`; the contract in
  [`src/engine/groups.ts`](../../src/engine/groups.ts)): `group` (with `withLink` for the invite link, which only
  admins get), `createGroup`, `join` (an invite link; a group that approves joins answers `requested`), `leave`,
  `updateGroup` (name, description, `addMode`, `approval`), `resetLink`, `participants` (`add`, `remove`, `promote`,
  `demote`; a phone-addressed group gets phone JIDs), `requests`, `answerRequest`, `profile` (`GetUserInfo` and the
  photo's presence), `block`, `lookup` (`IsOnWhatsApp`, one number, one every 10 s per profile, timed by
  `private.db.lookup`) and `contacts` (the address book in `private.db`). Answers stay in WhatsApp's terms (`announce`, `locked`, `ephemeral`); the adapter
  maps the two switches cli-core has (`onlyAdminsAdd`, `joinApproval`) and puts the rest in `providerMetadata`.
- **Nothing private on stderr or in a log.** The engine writes fixed wording to stderr. whatsmeow's own log names
  JIDs, and a phone JID is a phone number, so it is off; `WA_ENGINE_LOG=<file>` turns it on at warning level, into a
  file kept like `private.db`. Errors reach the CLI as one of the contract's codes with fixed wording.
- **Names without the phone.** WhatsApp has no "list chats" request, but cli-core resolves a chat name through the
  adapter. The engine answers from what it can see without asking the phone: chats pushed in this process, the address
  book in `private.db`, and the joined groups (one request per process, then kept).
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
- **Early events are kept.** An event nobody listens for yet is handed to the first listener of its kind
  ([`events.ts`](../../src/engine/events.ts)), so the history pushed right after connecting reaches `feed` even when
  `watch` subscribed first.

## 5. One id per one-to-one chat

cli-core can link two identities of one person but cannot merge two chats. A one-to-one chat stored once under the
person's phone JID and once under their LID would split its messages. **The engine emits every one-to-one chat in
LID form** when WhatsApp has a LID for the user, and the phone JID only as a linked identity. In the first live run,
58 of 71 one-to-one chats were already LIDs.

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
in `src/adapter/` or `engine/` knows about the relay.

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
Only the engine writes `private.db`; it holds keys and device state, never messages.

## 8. On the wire

The probe (`engine/cmd/wa-probe`) pairs as `Chrome (Linux)` with the desktop platform, so the phone sends full
history, and names the device after the host system. The Go engine does the same: nothing WhatsApp sees names
this tool. It sends delivery receipts, as every WhatsApp client does, and never presence. A read receipt goes only
when the command typed asked for one: `chats mark-read`, or `--mark-read` on a read.
