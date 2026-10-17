# whatsapp-cli — working rules

**Start with [`docs/dev/ARCHITECTURE.md`](docs/dev/ARCHITECTURE.md)** — the layers and the seams you may not
cross. Open work is [`docs/dev/BACKLOG.md`](docs/dev/BACKLOG.md).

`docs_ai/` is the private working folder — research, plans, rulings, live-test results. It is not in this repository:
it is the private repository `WireCatLabs/cli-private`, shared with the other CLIs; link or clone it into `docs_ai/`.
WhatsApp's rulings are [`decisions/whatsapp.md`](https://github.com/WireCatLabs/cli-private/blob/main/decisions/whatsapp.md), the plan in flight
[`plans/2026-10-16-whatsapp-foundation.md`](https://github.com/WireCatLabs/cli-private/blob/main/plans/2026-10-16-whatsapp-foundation.md), the protocol choice
[`research/2026-10-16-whatsapp-protocol-decision.md`](https://github.com/WireCatLabs/cli-private/blob/main/research/2026-10-16-whatsapp-protocol-decision.md).
Take journal numbers from the main checkout's `docs_ai/journal/next-id.sh`: a separate clone keeps its own counter
and hands out numbers that are already taken.

`wa` is the third messenger on [`@wirecat/cli-core`](https://github.com/WireCatLabs/cli-core), beside tg-cli and
max-cli. **What cli-core already does, this repository does not do again** — commands, the store, search, MCP,
the send guard, `serve`. A gap in cli-core is fixed in cli-core.

Security audits of this repository follow the shared
[security method](https://github.com/WireCatLabs/cli-testing/tree/main/docs/security) in cli-testing;
vulnerabilities are reported as the [security policy](SECURITY.md) says.

## Standards

Every WireCat CLI follows the [WireCat CLI standards](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/README.md)
(offline, in a cli-base checkout: `git show origin/main:docs/standards/<page>.md`). Read the page for the area you
change before changing it. The handbook wins over this file and over every document in this repository; a rule here may be stricter, never
looser.

Cite the ids of the rules your change touches (`WC-<AREA>-<n>`, such as `WC-OUT-1`) in the commit message and the PR
body. A rule that seems wrong for WhatsApp is raised in the PR or in the backlog, never broken quietly. Where a local
rule below repeats a handbook rule, the id after it names the handbook's version.

## Local rules

What holds for `wa` alone, on top of the handbook:

1. **This is the owner's real WhatsApp account.** Nothing sends, marks read or sends presence unless the command
   typed asked for it (delivery receipts are normal client behaviour and stay on); live checks send only to the owner's own chat. Never message a number the owner has not
   written to, never in bulk — WhatsApp bans accounts for both.
2. **In machine mode, stdout carries data and nothing else.** Diagnostics go to stderr. (`WC-OUT-1`)
3. **One-shot means the process exits.** Whatever starts the engine stops it on every exit path. (`WC-LIFE-1`)
4. **One connection per linked device.** A second connection makes WhatsApp drop the first; only the lock holder
   starts the engine. (`WC-LIFE-11`)
5. **No whatsmeow or engine type crosses `src/adapter/`.** Above it, only cli-core's domain. A lint rule enforces the
   imports; a type that arrives by inference through `src/messenger.ts` is caught only in review. (`WC-ARCH-3`)
6. **The device keys (`private.db`), messages and phone numbers never reach a log, a fixture or a document.**
   (`WC-SECR-1`)
7. **On the wire we look like a browser, not like ourselves.** No "whatsapp-cli" in any field WhatsApp sees.

Conventional commits, a branch and a PR per change. The pre-commit hook checks staged lint and secrets. Comments
sparse, only *why*. Go code in `engine/` follows `gofmt` and `go vet`.
(`WC-STYLE-10`, `WC-CI-12`, `WC-CI-1`, `WC-STYLE-1`)

## Development check budget

Local commits check only staged lint and secrets. There is no pre-push check.
Config integrity, repository lint, Markdown, and secret detection run in PR CI.
The bounded `ci:quick` step adds typechecking, a build and the command lint.
Full tests, coverage, builds and parity also run once on each merge to `main` (Linux only, no publishing).
Platform suites run for releases, explicit manual validation, and monthly nonpublishing validation. See the
[shared policy](https://github.com/WireCatLabs/community/blob/main/standards/README.md#ci-and-hooks).
The handbook's rules for this are on its
[CI page](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/ci.md) (`WC-CI-1` to `WC-CI-7`, `WC-CI-9`).
