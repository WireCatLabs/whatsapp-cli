# Backlog

Open work, most important first. The plan in flight is
[the foundation plan](https://github.com/WireCatLabs/cli-private/blob/main/plans/2026-10-16-whatsapp-foundation.md) (private).

1. **Live checks of the engine on the owner's number** (NEED-1387: reads, sends only to the own chat): `serve` end to
   end, send to the own LID chat, the lock against a running `serve`, a fresh `session start` keeping the history
   push, `self()` set right after pairing.
2. **Writes, `watch` and MCP while `serve` runs.** cli-core has no shared way to route them through the process that
   holds the connection; decide between adding it to cli-core and a local relay.
3. **A user who gains a LID later.** Their chat would split in two; cli-core cannot re-key a stored chat.
4. **Feature groups**: media, edit and delete, reactions, read state, polls, groups and admin, contacts, on-demand
   older history from the phone.
5. **Distribution**: the engine as per-platform npm packages, the release workflow, install tests on three systems.
   Until then `wa upgrade` updates the npm package only, not the engine binary.
6. **Join cli-core's parity manifest** (`pnpm parity:seed --cli wa` in cli-core), then turn on `parity:check` in CI.
7. **Agent settings like tg's** (`.claude/settings.json`: sandbox on, writes kept inside the project, `bin/wa` excluded so the engine reaches WhatsApp). Left out of the foundation because it changes how agents run here.
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
    decision 3) is not done, so such users stay in phone form.
12. **cli-core could resolve names from the store for `history: "store"` messengers.** Today it always asks the
    adapter, so the engine keeps its own small chat directory (ARCHITECTURE §4). Raise it in cli-core.
13. **Edits keep the edit's time as the message time.** A live edit carries no original timestamp; check what
    cli-core's store does with an edit's `timestamp` before it shows wrong times.
