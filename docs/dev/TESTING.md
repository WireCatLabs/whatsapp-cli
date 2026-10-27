# Testing

The rules are the handbook's
[Testing page](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/testing.md) (`WC-TEST-<n>`),
which wins over this page; this page is how `wa` runs them.

```sh
pnpm lint && pnpm typecheck && pnpm test:coverage   # what CI runs on every PR, with the coverage floor
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

`@wirecat/cli-base/testing/setup` runs first in vitest's `setupFiles`: each test file gets a fresh temporary folder
and home, a keyring that throws, and no network beyond this machine (WC-TEST-1, WC-TEST-2, WC-TEST-3). A test whose
subject is the network calls `onTestFinished(allowNetwork())`; none does today. The engine tests spawn a local child,
not the network.

`src/testing/sandbox.ts` runs next with `wa`'s own part: config, state and cache paths and the shared message
store inside that folder, and `WA_ENGINE`, `WA_PROFILE_LOCK` and the model variables cleared. **A new `WA_` variable
that can point at something real goes there.**

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
let a change through (`WC-TEST-11`). Full validation (`ci.yml`) checks it on every pull request, through `pr.yml`,
and again on each merge to `main`: stricter than the handbook's `WC-CI-5`, which keeps full tests for `main`
(`WC-CI-7`), because a floor broken by a merge turned `main` red twice.

## A version pull request skips the full validation

A pull request that changes only `CHANGELOG.md` and the version in `package.json` (with the engine packages that
carry it) and `src/version.ts`, against a
`main` whose pull request passed every required check on the same tree (bin/release's version pull requests), runs
`pnpm version:check` and `pnpm docs:check` instead, and reports the other required `validation / …` checks as
passed, saying why ([`scripts/ci-unchanged.sh`](../../scripts/ci-unchanged.sh),
[`scripts/ci-fingerprint.sh`](../../scripts/ci-fingerprint.sh)). The push to `main` that follows runs the full
validation.

## The bundle a user installs

`pnpm build` compiles `src/` with `tsc`, then cli-base's `cli-dev bundle`
([WC-LAY-10](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/layout.md))
bundles `dist/bin/wa.js` into `dist/bundle/` and makes the bin a loader. The vitest suite runs
against `src/`, so `scripts/smoke.ts` is the proof the bundle works: `pnpm smoke:node` runs it
under Node and `pnpm smoke:bun` under Bun, both in CI.
