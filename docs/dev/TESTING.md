# Testing

The rules are the handbook's
[Testing page](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/testing.md) (`WC-TEST-<n>`),
which wins over this page; this page is how `wa` runs them.

```sh
pnpm lint && pnpm typecheck && pnpm test:coverage   # what CI runs, with the coverage floor
pnpm engine:test                                    # gofmt, go vet and go test over engine/
pnpm test:matrix                                    # every command and option has a test or a reason
pnpm docs:check                                     # links, anchors, user pages, the changelog's shape
pnpm build && pnpm smoke:bun                        # the built command, executed under Bun
pnpm contracts:check                                # the built binary against contracts/plan.json
pnpm release:check                                  # all of the above and the release's own checks
```

The rules are tg-cli's and max-cli's; the reasons behind each are in
[max-cli's TESTING.md](https://github.com/WireCatLabs/max-cli/blob/main/docs/dev/TESTING.md), where they were
learnt. This page lists what is specific to `wa`.

## No test touches the owner's account or files

`src/testing/sandbox.ts`, a vitest `setupFiles` entry, points config, state, cache and the shared message store at a
temporary directory, and clears `WA_ENGINE`, `WA_PROFILE_LOCK` and the model variables for every test file. **A new
variable that can point at something real goes there.**

WhatsApp is never contacted. Tests hand the adapter `fakeEngine(seed)` (`src/testing/fake-engine.ts`): the engine in
memory, filled from cli-core's contract seed, with WhatsApp-shaped ids (`whatsAppIds`). Command tests hand `run()` an
`engine` in the environment ([`src/messenger.ts`](../../src/messenger.ts)).

## The adapter keeps cli-core's contract

`src/adapter/contract.test.ts` runs cli-core's `contractCases` with `history: "store"` and `orderBy: "time"` over the
real adapter and the fake engine. The `ServerReads` cases are skipped by design: reads come from the store.

## The engine

- **Go unit tests** cover the mapping from whatsmeow's events to the contract's JSON.
- **The Node side of the pipe** is tested against a small stand-in program that speaks the protocol, never the real
  engine.
- **Live checks** run the real engine on the owner's number, by hand, with the owner's yes each time, and send only to
  the owner's own chat. `bin/wa-probe` was the first one (results in
  [the protocol decision](https://github.com/WireCatLabs/cli-private/blob/main/research/2026-10-16-whatsapp-protocol-decision.md#first-live-link-2026-10-16), private).

## Coverage has a floor

`vitest.config.ts` holds it, below max-cli's while the code is young. Raise it when coverage rises; never lower it to
let a change through.
