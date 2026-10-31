---
name: release
description: Prepare and check a whatsapp-cli release for the owner to publish — run release:check, draft the changelog in the handbook's headings, audit the docs against what changed, review the change against the handbook and CLAUDE.md, run the live scenarios with the owner's yes, raise the version in a pull request, write the release report, then ask the owner; bin/release runs only after the owner's yes for that version. Use when asked to release, prepare a release, cut a version, «выпуск», «выпустить версию».
---

# Release whatsapp-cli

**`wa` is released only after the owner says yes in the conversation** (`WC-REL-10`). It runs on the owner's real
WhatsApp account. An agent does steps 0 to 6: it opens the `chore(release)` pull request, writes the report and asks
the owner whether to release that version. Without that yes it never merges that pull request, runs `bin/release` or
starts `release.yml`. One yes covers one version.

The rules are the handbook's
[Releases page](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/releases.md) (`WC-REL-<n>`), which
wins over this skill. The steps tg, max and wa share are in cli-core's
[RELEASING.md](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/RELEASING.md). Read both first. This skill
orders them for `wa` and adds what is `wa`'s: the six engine packages, the report and the owner's real
WhatsApp account.

## 0. What changed

The commands in RELEASING.md, "What changed". Work in a worktree off `origin/main`, never in the main checkout:

```sh
git fetch origin && git worktree add --no-track -b chore/release-next .worktrees/release origin/main
```

A cli-core release can add or change commands without any code here. The `docs/commands.md` diff shows it.

## 1. The automatic checks

```sh
pnpm release:check
```

On the release branch, before the version is raised, only "version not on npm" and "changelog" (an `## Unreleased`
section left) may fail. Anything else: report it, then fix it in the release pull request. Fix nothing on your own
judgement.

## 2. The changelog

Draft `## Unreleased` from the merged pull requests (RELEASING.md, "The changelog") under the handbook's headings,
each at most once: `Added`, `Changed — may break callers`, `Fixed`, `Security`, `Removed` (`WC-DOC-14` to
`WC-DOC-18`). A cli-core version gets the entries a `wa` user notices, said in `wa`'s words. No internal ids, no file
paths. `pnpm docs:check` checks the headings and the ids.

## 3. The docs against the diff

RELEASING.md, "The docs against the diff": `README.md`, `docs/*.md` and `skills/whatsapp-cli/SKILL.md`, which
`wa skill show` prints. Each states what the code does now (`WC-DOC-3`). `docs/commands.md` and
`docs/dev/test-matrix.md` are generated: `pnpm generate`, `pnpm test:matrix` (`WC-DOC-4`).

## 4. The rules

RELEASING.md, "Reviewing against the rules", against the handbook pages the change touches and the local rules in
[CLAUDE.md](../../../../CLAUDE.md). Rule 1 (nothing sends, marks read or sends presence unless asked), rule 3 (whatever
starts the engine stops it on every exit path), rule 6 (no device key, message or phone number in a log, a fixture or
a document) and rule 7 (nothing on the wire says "whatsapp-cli") are read in the changed code. Each one gets
**holds** or **broken**, with `path:line`, and each handbook rule the change touches is named by its id.

## 5. Live

- **The change touches a write or the engine** (an adapter write in `src/adapter/`, a write command, the Go engine, a
  cli-core release that changes a write): the [test-live](../test-live/SKILL.md) skill, with the owner's yes. **The
  release waits for that answer.** The owner runs the scenarios on the installed `wa`, in the owner's own chat only;
  never link a worktree.
- **A command only a live run checks** (the ⛔ rows of `docs/dev/test-matrix.md`) changed: the same skill.
- **Neither**: say so in the release pull request. No live run.

## 6. Raise the version, then write the report

```sh
npm view @wirecat/whatsapp-cli version         # what is really published
# package.json: the next version; then
pnpm version:sync                              # src/version.ts and the six engine packages follow package.json
# CHANGELOG.md: "## Unreleased" becomes "## <version> — DD.MM.YYYY"
pnpm release:check                             # now every check passes
```

Commit `chore(release): <version>`, rebase onto `origin/main`, push and open the pull request.

Then write the report: `docs_ai/releases/whatsapp-cli/<version>.md` in the main checkout's `docs_ai/` (cli-private),
in the shape of the template in `docs_ai/releases/README.md`. It is headed `# <version>` and holds what changed for a
user and the results of steps 1 to 5. Commit and push `docs_ai/`, then ask the owner whether to release this version,
with the pull request and the report's path. Anything merged into `main` before the release: rebase, run
`pnpm release:check` again and update the report.

## 7. Publish, after the owner's yes

Once the owner says yes for this version, merge the pull request once CI is green, then, in the main checkout on a
clean `main`:

```sh
bin/release           # starts release.yml, which publishes from GitHub Actions
```

`bin/release` takes the release lock (`WC-REL-3`), folds a late `## Unreleased` into the dated version
(`WC-REL-15`), takes the next free version if another session published first (`WC-REL-5`) and runs
`release:check` again.

npm's trusted publishing is set on all seven packages (the owner, 2026-10-20), so plain `bin/release` publishes: it
starts `release.yml`, which publishes the validated packages with provenance (`WC-REL-11`, `WC-REL-12`), engines
before the CLI ([CONVENTIONS.md](../../CONVENTIONS.md#releases)). Before it, check that no run is in progress, since
two releases at once race:

```sh
gh run list --workflow release.yml --limit 1
```

`bin/release --local` is the fallback, only for when `release.yml` cannot publish. It takes the npm token from
`NPM_TOKEN` or the keyring without printing it (`WC-REL-14`), builds the six engine packages on this machine,
publishes them before the CLI, waits for npm (up to fifteen minutes), pushes the tag and creates the GitHub release
from the changelog, as `release.yml` does (`WC-REL-13`). It publishes without the recorded SHA-256 and without
provenance.

Report the pull request, the report's path and what the live step did.
