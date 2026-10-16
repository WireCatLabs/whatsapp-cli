# Backlog

Open work, most important first. The plan in flight is
[docs_ai/plans/2026-10-16-foundation.md](../../docs_ai/plans/2026-10-16-foundation.md).

1. **The Go engine.** JSON-lines protocol per `src/engine/contract.ts`: hello, history pushes with LID-first chat ids,
   live messages, send with the caller's id, the device lock, open by stored JID. `GoEngine` on the Node side.
2. **`session start [qr|phone]` and `setup`.** Login by QR or pairing code; cli-core's messages already point users at
   `wa <profile> setup`, which does not exist yet.
3. **Writes, `watch` and MCP while `serve` runs.** cli-core has no shared way to route them through the process that
   holds the connection; decide between adding it to cli-core and a local relay.
4. **A user who gains a LID later.** Their chat would split in two; cli-core cannot re-key a stored chat.
5. **Feature groups**: media, edit and delete, reactions, read state, polls, groups and admin, contacts, on-demand
   older history from the phone.
6. **Distribution**: the engine as per-platform npm packages, the release workflow, install tests on three systems.
7. **Join cli-core's parity manifest** (`pnpm parity:seed --cli wa` in cli-core), then turn on `parity:check` in CI.
8. **Agent settings like tg's** (`.claude/settings.json`: sandbox on, writes kept inside the project, `bin/wa` excluded so the engine reaches WhatsApp). Left out of the foundation because it changes how agents run here.
9. **Replace the test-matrix waivers with tests.** `scripts/test-matrix-untested.ts` waives every shared command as
   tested in cli-core (736 options on 2026-10-16; 23 have wa tests). Each group that gets an engine path gets tests
   through `run()`, and its waiver goes.
10. **A one-shot connection may take messages and drop them.** If WhatsApp hands each queued message to a linked
    device once, a one-shot `messages send` with no `serve` running receives and acknowledges them, and only `serve`
    and `watch` save to the store. Unverified: check live — a message arrives during a one-shot send, then `serve`
    starts — before one-shot connections ship.
