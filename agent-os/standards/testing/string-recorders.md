# Record calls as short strings, assert with one toEqual

- Overrides passed to `scripted({...})` push a short string per call (`"vote MA"`, `"42 notify"`) into a local array.
- One `toEqual([...])` checks arguments and order in a readable line.
- A factory returns the adapter with its recorders: `const { adapter, sent } = whatsapp()`.
- Keep `vi.fn` for "never called" checks.

**Why:** Open.

**Open:** Chosen for readable failure diffs, or to avoid mocks leaking between tests? Should new tests follow it?

See: [tg-cli `src/send-guard.test.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/send-guard.test.ts)
