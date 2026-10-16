# Error text never repeats what was typed

- An adapter or engine error says what went wrong in fixed wording; it never quotes a chat name, a JID, a phone
  number or message text.
- An `EngineError` message is fixed wording too; the adapter passes it on as it is.
- Point at the command that shows the details instead (`chats list`).

**Why:** Errors reach logs and run records on disk, and a JID can be a phone number. From tg-cli's
`telegram/error-text-privacy` standard.

See: `src/adapter/adapter.ts` (`resolve`) · `src/engine/contract.ts` (`EngineError`)
