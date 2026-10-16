# Adapter tests: the fake engine, never a mocked library

- Build the adapter over `fakeEngine(seed)` from `src/testing/fake-engine.ts`; never `vi.mock` the engine module.
- Script anything the seed lacks through `engine.push(event)`, which checks the event against the contract first.
- Ids come from `whatsAppIds`, so a test sees the shapes WhatsApp uses (`…@lid`, `…@g.us`, `3EB0…`).

**Why:** The adapter sees only the `WhatsAppEngine` port; a fake of the port tests the adapter, a mock of a module tests the mock.

See: `src/adapter/contract.test.ts` · `src/testing/fake-engine.ts`
