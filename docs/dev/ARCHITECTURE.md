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

WhatsApp has no "list chats" or "give me older messages" request. The phone pushes history when a device links, and
the socket carries new messages after that. So `WHATSAPP.history` is `"store"`:

- **Reads never connect.** `chats list`, `messages list`, `search` and `inbox` answer from cli-core's store.
- **`serve` fills the store.** It runs the adapter's `feed` (history pushes) beside `watch` (live messages) on one
  connection, and cli-core saves each batch.
- **Writes connect.** `messages send` opens the engine, sends, and closes it.

## 4. The engine

The protocol runs in a Go program built on [whatsmeow](https://github.com/tulir/whatsmeow), started as a child
process. Why Go and why whatsmeow: [docs_ai/protocol-decision.md](../../docs_ai/protocol-decision.md).

- **The contract** is [`src/engine/contract.ts`](../../src/engine/contract.ts): every event and answer as a Valibot
  schema, in WhatsApp's own terms (JIDs, `fromMe`, sync kinds). `PROTOCOL` is checked at the engine's hello.
- **Two engines implement it**: the Go engine over JSON lines on stdin and stdout (logs on stderr), and
  `src/testing/fake-engine.ts` in memory for tests. A third — Baileys, or whatsapp-rust — would implement the same
  interface without the adapter noticing.
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
write can each open one. The engine takes an exclusive lock beside `session.db`; the loser is refused with a
message naming the holder. Routing writes through a running `serve` is open work
([BACKLOG.md](BACKLOG.md)).

## 7. What is on disk

| Path | What | Mode |
|---|---|---|
| `~/.local/share/whatsapp-cli/profiles/<profile>/session.db` | the engine's device store: the linked device's keys | 0600, dir 0700 |
| cli-core's store (`~/.local/share/WireCat/wirecat.db`) | chats, people, messages for every messenger | cli-core's |
| `~/.config/whatsapp-cli/` | settings; never a secret | |

One device per `session.db`: the engine opens the device by the JID stored for the profile and refuses a file with
zero or several devices.

## 8. On the wire

The engine pairs as `Chrome (Linux)` with the desktop platform, so the phone asks for full history. Nothing
WhatsApp sees names this tool.
