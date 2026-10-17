# Conventions

`wa` follows [max-cli's conventions](https://github.com/WireCatLabs/max-cli/blob/main/docs/dev/CONVENTIONS.md)
for code and documents. This page lists only where `wa` differs or adds.

## Code

- **Comments are sparse and say why**, never what — the owner's global rule, stricter than anything a
  surrounding file shows.
- **Biome** formats and lints (`pnpm lint`): 2 spaces, double quotes, no semicolons, 120 columns.
- **The engine stays behind `src/adapter/`**, and its objects become domain models in `src/adapter/map.ts` alone
  ([ARCHITECTURE.md](ARCHITECTURE.md#2-the-layers)).
- **Command names, options, output shapes and MCP tools** follow the
  [standard for tg, max and wa](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/STANDARD.md) in
  cli-core — one standard for every CLI; a new verb or option is added there first. Every command
  and option is in its [parity manifest](https://github.com/WireCatLabs/cli-core/blob/main/parity.json),
  and `pnpm parity:check` fails on one that is not.
- **Messenger-neutral code goes to cli-core**, not here. If a change would help tg or max too, it
  belongs there.
- **Never a message, a token, a phone number or a real chat id** in a log, a fixture, a test or a
  document. Command output is the only place a message may appear. Fixtures use synthetic JIDs
  (`whatsAppIds` in `src/testing/fake-engine.ts`).

## Documents

- **English**, in every document of this repository, user pages included.
- **User pages** — `README.md` and the pages directly under `docs/` — state current facts only: no
  correction marks, no struck-out text, no internal ids. `pnpm docs:check` enforces it.
- **Developer pages** (`docs/dev/`) state the current facts too: rewrite a wrong or
  outdated sentence with no mark; git keeps the old text. A finished plan or handoff is deleted, a
  done backlog item is deleted in the PR that ships it. `CHANGELOG.md` is the one place for history.
- **Link, do not copy.** A link to a sibling repository uses its GitHub URL, so it works for a
  reader who has only this one; `pnpm docs:check` checks every link inside this repository.
- **Every option a user page names exists**, or the parity manifest plans it for that command (docs
  come first). `pnpm parity:check` checks every `wa <command> --option` on the user pages; a change
  that drops an option fails until its pages stop naming it.

## The changelog

[`CHANGELOG.md`](../../CHANGELOG.md), newest first:

- `## Unreleased` on top while there is something unreleased; each version as
  `## <version> — DD.MM.YYYY`. When `bin/release` has to take the next free version, it renames the
  prepared version's heading — or, if npm already has that version, dates `## Unreleased` as the new
  one and leaves the published section alone.
- Subheadings, each at most once: `What's new`, `Changed — may break scripts`, `Fixed`, `Security`,
  `Removed`. Anything that changes a command's output, an exit code, an option or a config key goes
  under `Changed — may break scripts`.
- Each entry says what changed as a user sees it, why when that is not obvious, and what to watch
  for — as max-cli's changelog section describes. No internal ids, no file paths.


## Releases

`bin/release` publishes; its header says how. The engine adds three things to tg's process:

- **Seven packages, one version.** `package.json` pins the six engine packages in `optionalDependencies` to its own
  version. `pnpm version:check` (also in CI and `pnpm release:check`) fails when they differ; `pnpm version:sync` and
  `bin/release`'s version bump rewrite them.
- **Engines first.** The release workflow's `build` job builds and packs the six engine packages
  (`node scripts/engine-packages.mjs build`, Go from `engine/go.mod`); `publish` uploads them, skipping any npm already
  has, then the CLI. A CLI published ahead of its engines would install without one: npm skips an optional dependency
  it cannot find. `bin/release --local` does the same from this machine.
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
- whatsmeow is pinned by commit in `engine/go.mod`, with checksums in `go.sum`; it is never vendored or patched in
  place. A protocol fix upstream is a one-line bump.
