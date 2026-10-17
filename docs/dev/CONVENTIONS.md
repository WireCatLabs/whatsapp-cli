# Conventions

`wa` follows the [WireCat CLI standards](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/README.md),
which win over this page, and [max-cli's conventions](https://github.com/WireCatLabs/max-cli/blob/main/docs/dev/CONVENTIONS.md)
where the standards are silent. This page lists only where `wa` differs from max-cli or adds.

## Code

- **Comments are sparse and say why**, never what — the owner's global rule, stricter than anything a
  surrounding file shows (`WC-STYLE-1`).
- **Biome** formats and lints (`pnpm lint`): 2 spaces, double quotes, no semicolons, 120 columns.
- **The engine stays behind `src/adapter/`**, and its objects become domain models there alone
  ([ARCHITECTURE.md](ARCHITECTURE.md#2-the-layers), `WC-ARCH-3`).
- **Command names, options, output shapes and MCP tools** follow the
  [standard for tg, max and wa](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/STANDARD.md) in
  cli-core — one standard for every CLI; a new verb or option is added there first. Every command
  and option is in its [parity manifest](https://github.com/WireCatLabs/cli-core/blob/main/parity.json),
  and `pnpm parity:check` fails on one that is not.
- **Messenger-neutral code goes to cli-core**, not here. If a change would help tg or max too, it
  belongs there (`WC-ARCH-4`).
- **Never a message, a token, a phone number or a real chat id** in a log, a fixture, a test or a
  document. Command output is the only place a message may appear. Fixtures use synthetic JIDs
  (`whatsAppIds` in `src/testing/fake-engine.ts`; `WC-SECR-1`).

## Documents

The rules are the handbook's
[Documents page](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/docs.md): user pages apart
from developer pages (`WC-DOC-1`), current facts only (`WC-DOC-2`, `WC-DOC-3`), generated pages never edited by hand
(`WC-DOC-4`), English in every file (`WC-DOC-13`). `pnpm docs:check` runs the checks the page names. What `wa` adds:

- **The generated pages** are `docs/commands.md` (`pnpm generate`) and `docs/dev/test-matrix.md`
  (`pnpm test:matrix`). On a conflict, run the generator and commit what it writes.
- **A link to a sibling repository uses its GitHub URL**, so it works for a reader who has only this one.
- **Every option a user page names exists**, or the parity manifest plans it for that command (docs
  come first). `pnpm parity:check` checks every `wa <command> --option` on the user pages; a change
  that drops an option fails until its pages stop naming it.

## The changelog

[`CHANGELOG.md`](../../CHANGELOG.md), newest first:

- `## Unreleased` on top while there is something unreleased; each version as
  `## <version> — DD.MM.YYYY`. When `bin/release` has to take the next free version, it renames the
  prepared version's heading — or, if npm already has that version, dates `## Unreleased` as the new
  one and leaves the published section alone.
- The headings and what goes under each are the handbook's
  [WC-DOC-15](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/docs.md#wc-doc-15--changelog-entries-go-under-five-fixed-headings-each-at-most-once-per-section),
  [WC-DOC-16](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/docs.md#wc-doc-16--a-change-a-caller-may-notice-goes-under-changed--may-break-callers),
  [WC-DOC-17](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/docs.md#wc-doc-17--each-entry-says-what-changed-for-the-caller-why-and-what-to-watch-for)
  and [WC-DOC-18](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/docs.md#wc-doc-18--the-changelog-has-no-internal-ids).
  `pnpm docs:check` refuses any other heading and any internal id.


## Releases

`bin/release` publishes; its header says how. The engine adds three things to tg's process:

- **Seven packages, one version.** `package.json` pins the six engine packages in `optionalDependencies` to its own
  version. `pnpm version:check` (also in CI and `pnpm release:check`) fails when they differ; `pnpm version:sync` and
  `bin/release`'s version bump rewrite them.
- **Engines first, as validated.** Full validation's `engine` job (`ci.yml`) cross-builds the six engine packages
  (`node scripts/engine-packages.mjs build`, Go from `engine/go.mod`), runs the TypeScript client against the
  linux-x64 one and, in a release, packs all six and records their SHA-256 (WC-REL-12). The release's `build` job
  checks the tarballs against that record and builds nothing; `publish` uploads them, skipping any npm already has,
  then the CLI. A CLI published ahead of its engines would install without one: npm skips an optional dependency
  it cannot find. `bin/release --local` does the same from this machine.
- **Each engine package ships `THIRD_PARTY_NOTICES`** beside wa's `LICENSE`, copied from `engine/` by
  `node scripts/engine-packages.mjs build`.
- **Install tests use packed engines.** Before a release the engine is on no registry, so the install jobs
  (`install-windows.yml`: Linux, macOS, Windows) build the engine package for their system, install it together with
  the packed CLI, and check that `engineBinary()` finds it and that it prints the version.
  `pnpm engine:packages linux-x64` and `npm pack ./packages/engine-linux-x64` give the same pair locally.

## Documentation authoring

Before documentation work, read the [shared authoring rules](https://github.com/WireCatLabs/cli-docs/blob/main/docs/AUTHORING.md).
Every user guide starts with a brief explanation of when to use it and what result the reader
will get; mention a prerequisite only when it changes the next step. Keep titles short and
task-specific. A new sidebar page needs a relevant icon and a contextual incoming link.
Preserve released command facts and existing URLs/anchors.

## Go

- `engine/` is a Go module of its own. `gofmt` and `go vet` are the style; `pnpm engine:test` runs both and the tests.
  On a pull request that touches `engine/` or `scripts/engine-packages.mjs`, `engine-pr.yml` runs the same with Go
  set up from `engine/go.mod` and cached; the shared standards job has no Go.
- `engine/THIRD_PARTY_NOTICES` holds the licence of every Go module the engine links, on all six targets, and Go's
  own. It is generated: after a dependency or Go version change, run `node scripts/engine-packages.mjs notices` and
  commit the result. `notices --check` (in `engine-pr.yml`) and every `build` fail while the file names another set
  of linked modules or another Go than the current `go list -deps` gives.
- whatsmeow is pinned by commit in `engine/go.mod`, with checksums in `go.sum`; it is never vendored or patched in
  place. A protocol fix upstream is a one-line bump.
