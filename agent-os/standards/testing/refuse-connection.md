# A command that must not connect gets a throwing adapter

- Give `--offline` and local-only commands an `adapter` that throws with the rule as its message ("--offline must never open WhatsApp").
- When shared across a file, make it a `vi.fn` and check `expect(refuse).not.toHaveBeenCalled()` in `afterAll`, so a swallowed error still fails.
- Give it no `engine` in the environment, so a connection attempt fails loudly.

**Why:** Open — likely a command once swallowed the adapter error and still passed.

**Open:** Should every offline or local test be required to use the `afterAll` check?

See: [tg-cli `src/offline.test.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/offline.test.ts) · [tg-cli `src/search-adoption.test.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/search-adoption.test.ts) · [tg-cli `src/rankings-adoption.test.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/rankings-adoption.test.ts)
