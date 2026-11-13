### Changed — may break callers

- **Built on cli-core 0.648.0 and cli-base 0.98.0** (was 0.641.0 and 0.93.0). The store stays at version 66. Details in
  [cli-core's changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md).
- **Local only keeps every model call on this computer.** With the switch on (`memo models local-only set on`), wa's
  model calls, remote embeddings and OpenAI transcription refuse any address that is not this computer before anything
  is sent (`local-only.refused`).
- **Plain http goes only to this computer, for every model call.** Enrichment, search harder, linking, reply drafts,
  attachment OCR and remote embeddings refuse an `http://` address on another machine (`model.address-refused`); use
  https, or run the model on this computer.
- **Voice messages are heard by the downloaded model first.** `auto` uses the local speech model when it is downloaded
  and asks the messenger only when it is not, and never under local only.
- **A mistyped profile is `not_found` (reason `profile.unknown`) with the profiles on this computer**, not a request to
  link a device; a profile with a linked device counts as one here. The link hint stays in the message for a profile
  that is new on purpose.
- **`stats tasks show` has no `--chat`: name the chat in the query**, `stats tasks show -- chat:"Project room"`.
- **`store reset` is no longer offered over MCP**: it needs `--yes`, which an MCP call cannot pass.
- **The Cloud API bot reaches only `graph.facebook.com`.** Its requests go through the host check every other request
  passes.
