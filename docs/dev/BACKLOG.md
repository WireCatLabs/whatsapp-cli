# Backlog

Open work, most important first. The plan in flight is
[the foundation plan](https://github.com/WireCatLabs/cli-private/blob/main/plans/2026-10-16-whatsapp-foundation.md) (private).

1. **Live checks of the engine on the owner's number** (NEED-1387: reads, sends only to the own chat): `serve` end to
   end, send to the own LID chat, the lock against a running `serve`, a fresh `session start` keeping the history
   push, `self()` set right after pairing.
2. **Writes, `watch` and MCP while `serve` runs.** cli-core has no shared way to route them through the process that
   holds the connection; decide between adding it to cli-core and a local relay.
3. **A user who gains a LID later.** Their chat would split in two; cli-core cannot re-key a stored chat.
4. **Feature groups**: polls, groups and admin, contacts, on-demand older history from the phone. Edit,
   delete for everyone, reactions and mark-read are built; what they left open:
   - **Delete for the owner alone.** whatsmeow has the app-state index (`deleteMessageForMe`) but no builder, so
     `messages delete` without `--for-everyone` is refused rather than built from a guessed patch.
   - **Messages stored before files were.** A photo with a caption stored by an older `wa` has the caption and no
     attachment, so `messages forward` sends the caption alone and `messages download` finds nothing. The phone does
     not push history again; a re-link would refill it.
   - **Files WhatsApp no longer keeps.** A download of an expired file is `not_found`; WhatsApp's apps ask the sender's
     phone to upload it again (whatsmeow's `SendMediaRetryReceipt`), which is not built. A forward of one reaches the
     recipient as a file that will not open.
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
    decision 3) is not done, so such users stay in phone form.
12. **cli-core could resolve names from the store for `history: "store"` messengers.** Today it always asks the
    adapter, so the engine keeps its own small chat directory (ARCHITECTURE §4). Raise it in cli-core.
13. **Edits keep the edit's time as the message time.** A live edit carries no original timestamp; check what
    cli-core's store does with an edit's `timestamp` before it shows wrong times.
