### Changed — may break callers

- **wa builds on cli-core 2.0.0.** The store moves to version 78 on its first open, and tools on cli-core 1.x refuse
  the migrated store. Upgrade every installed WireCat CLI to its cli-core 2.0 release before you run this version.
  The migration writes a rollback copy first.
- **An AI agent is named `agent:<id>`, and a sender bot `bot:<id>`.** In the store's JSON output an agent's type is
  `agent`, not `bot` (`author`, `created_by`, `confirmed_by`, `decided_by`). The old `sender-bot:<id>` still reads as
  `bot:<id>`. WhatsApp bots and the `bot` commands are unchanged.
