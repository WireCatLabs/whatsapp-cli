---
name: release
description: Prepare, check and publish a whatsapp-cli release — run release:check, draft the changelog in the handbook's headings, audit the docs against what changed, review the change against the handbook and CLAUDE.md, run the live scenarios with the owner's yes, write the release report for the owner to sign, raise the version and run bin/release. Use when asked to release, prepare a release, cut a version, «выпуск», «выпустить версию».
---

# Release whatsapp-cli

The rules are the handbook's
[Releases page](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/releases.md) (`WC-REL-<n>`), which
wins over this skill. The steps tg, max and wa share are in cli-core's
[RELEASING.md](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/RELEASING.md). Read both first. This skill
orders them for `wa` and adds what is `wa`'s: the six engine packages and the owner's real WhatsApp account.

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

On the release branch, before the version is raised, only "changelog" (an `## Unreleased` section left) may fail.
Anything else: report it, then fix it in the release pull request. Fix nothing on your own judgement.

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

## 6. The release report

A messenger CLI is released only with a report the owner signed for that commit (`WC-REL-10`). Write
`docs_ai/releases/whatsapp-cli/<version>.md` in the main checkout's `docs_ai/` (cli-private): the version, what
changed for a user, the results of steps 1 to 5, and `Commit: <sha>`, the full SHA of `main` after the release pull
request merged. Leave out the `Signed off:` line: the owner adds it, with the date. **Never write it yourself.** Commit
and push `docs_ai/`, then tell the owner the path. `bin/release` does not check the report yet; run it only once the
owner has signed.

## 7. Raise the version and publish

```sh
npm view @wirecat/whatsapp-cli version         # what is really published
# package.json: the next version; then
pnpm version:sync                              # src/version.ts and the six engine packages follow package.json
# CHANGELOG.md: "## Unreleased" becomes "## <version> — DD.MM.YYYY"
pnpm release:check                             # now every check passes
```

Commit `chore(release): <version>`, open the pull request, and merge it once CI is green. Then, in the main checkout
on a clean `main`:

```sh
gh run list --workflow release.yml --limit 1   # nothing in progress — two releases at once race
bin/release
```

`bin/release` takes the release lock (`WC-REL-3`), refuses within two hours of the last version on npm (`WC-REL-8`),
runs `release:check` again, takes the next free version if another session published first, and starts
`release.yml`, which publishes the six engine packages before the CLI ([CONVENTIONS.md](../../CONVENTIONS.md#releases)).
Report the version, the run and what the live step did.
