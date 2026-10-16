# WhatsApp multi-device libraries for a TypeScript CLI (checked 2026-10-16)

Marks: **[V]** verified (GitHub/npm API, source at a pinned commit, or run on this machine) · **[D]** docs or a
maintainer says so · **[I]** inference.

Pinned source:

- Baileys `0af2386` — `B` = <https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1>
- whatsmeow `df33a48` — `W` = <https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b>

Short answer: Baileys v7 is the only realistic TypeScript-native choice. It runs on Bun, and `bun build --compile`
gives one working binary (tested). Three catches: stalled maintenance, a GPL-3.0 dependency, and no server-side
history — we keep our own store. Fallback: a whatsmeow (Go) sidecar.

## Summary [V]

| Library | Lang | License | ★ | Last commit | Last release | Approach | Native / binary deps |
|---|---|---|---|---|---|---|---|
| [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) | TS | MIT; dep `libsignal` **GPL-3.0** | 11,345 | 2026-08-04 | npm `baileys` / `@whiskeysockets/baileys`: latest 7.0.0-rc14 (2026-07-29), legacy 6.7.24 | WebSocket | peer `sharp` (not optional); ffmpeg optional |
| [tulir/whatsmeow](https://github.com/tulir/whatsmeow) | Go | MPL-2.0 | 7,582 | 2026-10-15 | none (Go pseudo-versions) | WebSocket | none |
| [oxidezap/whatsapp-rust](https://github.com/oxidezap/whatsapp-rust) | Rust | MIT | 907 | 2026-10-15 | v0.7.0 (2026-08-07) | WebSocket | none |
| [oxidezap/baileyrs](https://github.com/oxidezap/baileyrs) | TS + Rust/WASM | MIT | 39 | 2026-10-15 | `@oxidezap/baileyrs` 0.3.11 (2026-10-15) | WebSocket, core in WASM | `fs-native-extensions` (prebuilt addon) |
| [wwebjs/whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js) | JS | Apache-2.0 | 22,738 | 2026-09-28 | 1.34.7 (2026-04-24) | Headless Chromium | Chromium, ffmpeg |
| [wppconnect](https://github.com/wppconnect-team/wppconnect) / [wa-js](https://github.com/wppconnect-team/wa-js) | TS | LGPL-3.0+ / Apache-2.0 | 3,473 / 817 | 2026-10-15 | 2.3.5 / 4.6.1 | Headless Chromium | Chromium, sharp |
| [open-wa](https://github.com/open-wa/wa-automate-nodejs) | TS | [Hippocratic H-DNH](https://github.com/open-wa/wa-automate-nodejs/blob/master/LICENSE.md), paid features | 3,665 | 2026-10-15 | 5.6.2 | Headless Chromium | Chromium |
| [venom](https://github.com/vynect/venom) | TS | Apache-2.0 / MIT (npm) | 6,589 | 2026-06-10 | 5.3.0 (2024-11), stale | Headless Chromium | Chromium, sharp |
| [neonize](https://github.com/krypton-byte/neonize) | Python over whatsmeow | Apache-2.0 | 758 | 2026-10-15 | 0.6.0 | Go shared lib | Go shared lib |
| [Rhymen/go-whatsapp](https://github.com/Rhymen/go-whatsapp) | Go | MIT | 2,249 | — | v0.1.1 (2020) | pre-multi-device, dead | — |
| [tgalal/yowsup](https://github.com/tgalal/yowsup) | Python | GPL-3.0 | 7,168 | 2021-12-14 | v3.3.0 | mobile protocol, dead | — |

Weekly npm downloads (2026-10-06..12): `baileys` 406k, `@whiskeysockets/baileys` 507k, `whatsapp-web.js` 84k,
`@oxidezap/baileyrs` 1.6k. **[V]** Newer projects found are gateways on these libraries, not new libraries:
[OpenWA](https://github.com/rmyndharis/OpenWA), [GOWA](https://github.com/aldinokemal/go-whatsapp-web-multidevice),
[wuzapi](https://github.com/asternic/wuzapi). **[V]**

## Baileys v7: production-ready?

- **13 months a release candidate.** [rc.1 notes](https://github.com/WhiskeySockets/Baileys/releases/tag/v7.0.0-rc.1)
  (2025-09-08): "full release in around 2 days". Latest is rc14. npm `latest` points at 7.x anyway. **[V]**
- **Gap in npm releases** rc.9 (2025-11-21) → rc10 (2026-05-06). During it, WhatsApp rejected old clients with 405
  ([#2370](https://github.com/WhiskeySockets/Baileys/issues/2370)); fixed on main 2026-02-24
  ([PR #2360](https://github.com/WhiskeySockets/Baileys/pull/2360)); npm users hard-coded `version` themselves. **[V]**
- **Stalled.** Last main commit 2026-08-04; no human push since 2026-08-06 per the
  [activity log](https://api.github.com/repos/WhiskeySockets/Baileys/activity); 50 open PRs, none merged since
  2026-08-05. The last fix, [#2741](https://github.com/WhiskeySockets/Baileys/pull/2741) (Desktop profile needed for
  full history), came after rc14 and is **not on npm**. **[V]**
- **v8 announced** ([migration/v8](https://baileys.wiki/migration/v8)): classes, code taken from whatsmeow, new
  auth format with a migration script. **[D]** Branch `refactor/v8.0.0` last touched 2025-09-25. **[V]**
- **LID bugs open.** `lid-mapping.update` "not always emitted yet" ([migration/v7](https://baileys.wiki/migration/v7))
  **[D]**; [#2263](https://github.com/WhiskeySockets/Baileys/issues/2263),
  [#1768](https://github.com/WhiskeySockets/Baileys/issues/1768),
  [#2794](https://github.com/WhiskeySockets/Baileys/issues/2794); "Bad Mac" decrypt errors
  [#1769](https://github.com/WhiskeySockets/Baileys/issues/1769) (45 comments, open).

**Native code** (npm metadata of 7.0.0-rc14) **[V]**:

- `libsignal` ^6.0.0 = [WhiskeySockets/libsignal-node](https://github.com/WhiskeySockets/libsignal-node), pure JS,
  **GPL-3.0** ([LICENSE](https://github.com/WhiskeySockets/libsignal-node/blob/master/LICENSE)).
- `whatsapp-rust-bridge` 0.5.4 (MIT): pure WASM, embedded as base64 in `dist/index.js`, no separate file.
- `sharp: "*"` is a peer dependency **not** marked optional (only `jimp`, `audio-decode`, `link-preview-js` are), so
  npm 7+ and Bun install it with its native `.node` files. Baileys imports sharp/jimp dynamically and ignores a
  failure ([messages-media.ts:36](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Utils/messages-media.ts#L36)); video thumbnails call ffmpeg through the
  shell ([:125](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Utils/messages-media.ts#L125)). Core has no native addon.

## Bun and a single binary

Run on this machine, Bun 1.3.14 and Node 24.19, empty auth state, stopped at the QR code; no account linked. **[V]**

- `bun t.ts` reached the QR code (warnings: ws `upgrade` / `unexpected-response` events not implemented in Bun).
- Node reached the QR code.
- `bun build --compile` → one **102 MB** binary; copied to an empty folder without `node_modules`, it reached the QR
  code. Embedded WASM, `ws` and protobufjs survive.
- Not tested: media (sharp will likely not embed **[I]**), real login, long sessions, Node SEA (Baileys v7 is
  ESM-only; SEA wants one CommonJS bundle **[I]**).
- Bun blocked two install scripts (Baileys' Node-version check, protobufjs postinstall); neither was needed.
- Old Bun issue [#1076](https://github.com/WhiskeySockets/Baileys/issues/1076) closed; open
  [PR #2831](https://github.com/WhiskeySockets/Baileys/pull/2831) — proxy agents for uploads on Bun.

## whatsapp-rust and Baileyrs

- whatsapp-rust: v0.7.0, last commit 2026-10-15 (LID fix
  [#1731](https://github.com/oxidezap/whatsapp-rust/pull/1731)), 6 open issues, 139,847 crates.io downloads. README
  lists QR + pairing code, groups, communities, newsletters, status, calls, a SQLite storage crate, and warns of
  "account suspension". **[V]**
- No napi binding. JS route is WASM: [whatsapp-rust-bridge](https://github.com/oxidezap/whatsapp-rust-bridge)
  (v0.26.0) and [baileyrs](https://github.com/oxidezap/baileyrs), "a thin JavaScript wrapper over whatsapp-rust
  compiled to WebAssembly" with the Baileys API (targets `baileys@7.0.0-rc14`), replacing GPL libsignal with Rust,
  Node ≥22.3. **[V]**
- **Baileyrs 0.3.11 failed today** on Bun and Node: connection closed with 405, no QR. Its README: 405 = "the server
  rejected this build". Baileys rc14 got a QR code in the same session. **[V]** Verdict: watch, don't build on it yet.

## History

- Baileys: `syncFullHistory: true` by default, but the default `shouldSyncHistoryMessage` drops FULL batches
  ([Defaults/index.ts:76-80](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Defaults/index.ts#L76)); `requireFullSync` is sent at pairing
  ([validate-connection.ts:113](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Utils/validate-connection.ts#L113)) and only works with a `[OS, 'Desktop']`
  browser ([:43-50](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Utils/validate-connection.ts#L43)). **[V]** Docs: use `Browsers.macOS('Desktop')` +
  `syncFullHistory` ([history-sync](https://baileys.wiki/advanced/history-sync)). **[D]**
- whatsmeow: `RequireFullSync: false`, 10 GB quota ([store/clientpayload.go:120-157](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/store/clientpayload.go#L120));
  history arrives as `events.HistorySync` ([client.go:109](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/client.go#L109)). **[V]**
- On demand: Baileys `fetchMessageHistory` → `HISTORY_SYNC_ON_DEMAND`
  ([messages-recv.ts:164](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Socket/messages-recv.ts#L164)); whatsmeow `BuildHistorySyncRequest`, 50 per request
  recommended ([send.go:586](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/send.go#L586), [:489](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/send.go#L489)); neonize added it 2026-10-02
  ([PR #215](https://github.com/krypton-byte/neonize/pull/215)). **[V]**
- **No server-side list of chats or messages.** Requests go to the phone, which must be online; answers arrive as
  events. Baileys "is a stateless WebSocket client… does not store anything between socket restarts"
  ([data-store](https://baileys.wiki/concepts/data-store)). **[D]**

## Session lifetime and login

- Up to 4 linked devices; logged out if the phone is unused for 14 days — secondary sources only
  ([Gulf News](https://gulfnews.com/lifestyle/your-whatsapp-could-still-be-linked-to-a-device-you-dont-use-or-dont-own-heres-how-to-check-1.500694345),
  [Green-API FAQ](https://green-api.com/en/docs/faq/how-to-set-up-device-pairing/)). **[I]**
- QR + pairing code: Baileys `connection.update` / `requestPairingCode`
  ([socket.ts:764](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Socket/socket.ts#L764)); whatsmeow `GetQRChannel` ([qrchan.go:221](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/qrchan.go#L221)),
  `PairPhone` ([pair-code.go:92](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/pair-code.go#L92)), passkey pairing. **[V]**

## LIDs (hidden per-user ids)

- Baileys v7 ([migration/v7](https://baileys.wiki/migration/v7)) **[D]**: LID sessions by default; auth store needs
  `lid-mapping`, `device-list`, `tctoken`; lookup phone → LID only, `getPNForLID` only from seen traffic; keys gain
  `remoteJidAlt` / `participantAlt`. Breakages: [#2263](https://github.com/WhiskeySockets/Baileys/issues/2263),
  [#1950](https://github.com/WhiskeySockets/Baileys/issues/1950),
  [#2074](https://github.com/WhiskeySockets/Baileys/issues/2074),
  [#2794](https://github.com/WhiskeySockets/Baileys/issues/2794),
  [#2809](https://github.com/WhiskeySockets/Baileys/issues/2809).
- whatsmeow: `LIDStore` ([store/store.go:187](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/store/store.go#L187)), table `whatsmeow_lid_map`
  ([sqlstore/lidmap.go](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/store/sqlstore/lidmap.go)). **[V]** Issues:
  [#1009](https://github.com/tulir/whatsmeow/issues/1009) (closed),
  [#1197](https://github.com/tulir/whatsmeow/issues/1197) (sending to new contacts since 2026-07-02, open).
- whatsapp-web.js: [#3834](https://github.com/wwebjs/whatsapp-web.js/issues/3834) "No LID for user", open.

## Two processes on one login

Server sends `conflict type="replaced"`. whatsmeow emits `events.StreamReplaced` and does not reconnect
([events.go:143-147](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/types/events/events.go#L143), [connectionevents.go:48](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/connectionevents.go#L48)). Baileys
maps it to `DisconnectReason.connectionReplaced` (440) ([generics.ts:357](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Utils/generics.ts#L357)) **[V]**;
its sample reconnects on everything but `loggedOut`
([session-management](https://baileys.wiki/authentication/session-management)), so two processes would fight. **[I]**
Rule: one connection owner (daemon + lock).

## Features

| | Baileys | whatsmeow | whatsapp-rust |
|---|---|---|---|
| Media | yes | [upload.go](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/upload.go), [download.go](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/download.go) | yes |
| Reactions / edits | yes | [send.go:549](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/send.go#L549) / [:614](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/send.go#L614) | yes |
| Polls | yes (votes need our store) | [msgsecret.go:402](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/msgsecret.go#L402) | yes |
| Receipts / presence | yes | [receipt.go:197](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/receipt.go#L197) / [presence.go:97](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/presence.go#L97) | yes |
| Groups / communities | [groups.ts](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Socket/groups.ts), [communities.ts](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Socket/communities.ts) | [group.go](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/group.go) | yes |
| Channels | [newsletter.ts](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Socket/newsletter.ts) | [newsletter.go:314](https://github.com/tulir/whatsmeow/blob/df33a485cc4629bbcacc0f0ad5e44c3ca5b3454b/newsletter.go#L314) | yes |
| Calls | events only | no | optional `voip` |

## What we build ourselves

- Baileys: `makeInMemoryStore` removed in v7 ([data-store](https://baileys.wiki/concepts/data-store)) **[D]**;
  `useMultiFileAuthState` — "I wouldn't endorse this for any production level use"
  ([use-multi-file-auth-state.ts:26-31](https://github.com/WhiskeySockets/Baileys/blob/0af2386292907f7d9742d8d41f830d8c48208fa1/src/Utils/use-multi-file-auth-state.ts#L26)) **[V]**. We build an auth
  store (creds, keys, `lid-mapping`, `device-list`, `tctoken`, with transactions) and the message/chat/contact store
  with the `getMessage` callback retries and poll decryption need.
- whatsmeow: `sqlstore` covers auth, keys, app state and LIDs **[V]**; messages are ours.

## License

- Baileys' `libsignal` is GPL-3.0. A `bun --compile` binary embeds it; the distributed binary probably falls under
  GPL. **[I]**, not legal advice. Exits: Baileyrs (MIT), or Baileys' `feat-libsignal-wasm` branch (pushed by jlucaso1
  2026-08-06 **[V]**; its aim is my guess **[I]**).
- whatsmeow MPL-2.0: per-file copyleft; a separate sidecar next to MIT code is fine; offer source of shipped MPL
  files ([MPL 2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)). **[D/I]**

## Ban evidence

- Baileys README: "We discourage any stalkerware, bulk or automated messaging usage"
  ([README](https://github.com/WhiskeySockets/Baileys#disclaimer)); v7 stopped delivery ACKs because "WhatsApp has
  been banning accounts that send these" ([migration/v7](https://baileys.wiki/migration/v7)). **[D]**
- Issues: Baileys [#2075](https://github.com/WhiskeySockets/Baileys/issues/2075),
  [#2309](https://github.com/WhiskeySockets/Baileys/issues/2309),
  [#2805](https://github.com/WhiskeySockets/Baileys/issues/2805),
  [#2850](https://github.com/WhiskeySockets/Baileys/issues/2850),
  [#2707](https://github.com/WhiskeySockets/Baileys/issues/2707) (463 on new contacts, open); whatsmeow
  [#810](https://github.com/tulir/whatsmeow/issues/810), [#1074](https://github.com/tulir/whatsmeow/issues/1074).
  All involve bulk sends, cold contacts or status posts. **[V]**

## Fix speed after protocol breaks

| Date | Incident | Fix |
|---|---|---|
| 2026-06-09 | whatsmeow 405 on all connections ([#1164](https://github.com/tulir/whatsmeow/issues/1164)) | closed same day, no commit — probably server-side **[I]** |
| 2025-09-23, 2025-12-09 | whatsmeow 405 ([#941](https://github.com/tulir/whatsmeow/issues/941), [#1031](https://github.com/tulir/whatsmeow/issues/1031)) | same day **[V]** |
| 2025-10-13 | Baileys 405 ([#1913](https://github.com/WhiskeySockets/Baileys/issues/1913)) | main in 2 days **[V]** |
| 2026-02-24 | Baileys 405 ([#2370](https://github.com/WhiskeySockets/Baileys/issues/2370)) | main same day; **npm 10 weeks later** **[V]** |
| 2026-07-01 | Baileys Desktop profile → 428 ([#2677](https://github.com/WhiskeySockets/Baileys/issues/2677)) | main 2026-08-04; **not on npm** **[V]** |
| 2026-01-28 | whatsapp-web.js stuck at 99% ([#5758](https://github.com/wwebjs/whatsapp-web.js/issues/5758)) | 1.34.6 on 2026-01-30 **[V]** |

Conclusion **[I]**: whatsmeow for months-long reliability (same-day fixes, SQL store); Baileys for one TypeScript
stack — then pin a commit, be ready to patch the WhatsApp Web version, and keep the protocol behind the adapter.
