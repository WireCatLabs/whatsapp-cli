# Running agents on whatsapp-cli

Claude Code sessions work on `wa` in worktrees of their own. Each is an ordinary session the owner starts in the
worktree's folder; the guards in `.claude/` keep it inside. This file is how, and what stops an agent.

## Start a session

1. `bin/check-agents` once, from a terminal — every item as its label says (6c must fail).
2. A worktree per thread of work, under `.worktrees/` or `.claude/worktrees/` of the main checkout; `.gitignore`
   excludes both, so `git add -A` never stages one as an embedded repository.
3. `bin/trust-folder <worktree>` from a terminal, or accept Claude's trust dialog once. Without it the worktree's
   `.claude/settings.json` is partly ignored.
4. `cd <worktree> && claude`, told what to read first.

- **Never link a worktree.** A `session start` per worktree would add a device to the owner's account, and WhatsApp
  drops the older of two connections for one device. `bin/wa` keeps each worktree's config, state and store in its
  own `.wa/`, which holds no device, so a branch build never opens the owner's real device or the shared store.
  Only the main checkout's `bin/wa` writes the shared WireCat store (`~/.local/share/WireCat/wirecat.db`), the one
  tg and max write; it tells the two apart by `.git`, a folder in the main checkout and a file in a worktree.
- **The skills are linked, never tracked.** `release` and `test-live` live in [`skills/`](skills/); a checkout needs
  `ln -s ../docs/dev/skills .claude/skills` once, from a terminal. A tracked `.claude/skills` breaks every checkout
  that lacks it: inside the sandbox it cannot be created, and the switch is refused.
- **The live device belongs to the main install.** A running `wa <profile> serve` holds it; leave it alone. Live checks
  follow [live-scenarios.md](live-scenarios.md).

## What an agent may do, and what stops it

| | How |
|---|---|
| **File edits only in `~/Projects/AI`** | [`.claude/hooks/writes-stay-inside.sh`](../../.claude/hooks/writes-stay-inside.sh) on Edit, Write and NotebookEdit, in every mode. It also refuses the guards themselves — `.claude/settings*.json` and `.claude/hooks/` in any checkout — so an agent cannot lift them; the owner changes those |
| **Shell commands in the same folders** | the Bash sandbox ([`.claude/settings.json`](../../.claude/settings.json) `sandbox`): writes only to `~/Projects/AI`, the pnpm and npm caches and `/tmp`. Local sockets are open (`allowAllUnixSockets`), so the keyring over D-Bus works — `gh` needs it. On Ubuntu 24.04 and later it needs [`bin/enable-sandbox`](../../bin/enable-sandbox) once, run by the owner |
| **No way out of the sandbox** | [`.claude/hooks/sandbox-stays-on.sh`](../../.claude/hooks/sandbox-stays-on.sh) refuses any Bash call that asks for `dangerouslyDisableSandbox` |
| **The one command outside it** | a **plain** `bin/wa …` (`excludedCommands`): the Go engine it starts connects to WhatsApp's servers, which the sandbox has no route for. Matched as typed: `bin/wa … \| jq`, `bin/wa … > file` or `cd x && bin/wa …` run *inside* and cannot connect. Run it alone and read the tool's output |
| **Git** | over SSH: `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.npmrc` and `~/.pypirc` are in `denyRead`; only `~/.ssh/id_ed25519.pub` and `known_hosts` are re-opened — never the private key — and the SSH agent's socket signs commits and carries pushes. The sandbox masks `.git/config` in the working folder, so nothing may write it: **push without `-u`** (`git push origin <branch>`), **branch with `--no-track`** (`git switch -c feat/x --no-track origin/main`) — otherwise git fails halfway and leaves the checkout half switched |
| **Refused, in every mode** | `sudo` (`permissions.deny`) |
| **A change to the guards** | inside the sandbox git cannot replace `.claude/settings.json` or `.claude/hooks` (they are locked), so a checkout whose guards differ from the target stops halfway with "unable to unlink". The owner takes the new guards into each worktree from a terminal (`git checkout origin/main -- .claude/settings.json .claude/hooks`) and restarts its session |
| **Not yet measured here** | the settings are tg-cli's, measured there on 2026-09-29 by its `bin/check-agents`. Here [`bin/check-agents`](../../bin/check-agents), run from a terminal, settles the rest. Its item 4 runs `bin/wa doctor`, which connects to nothing: whether a plain `bin/wa` reaches WhatsApp from outside the sandbox is not checked, since no probe may open the owner's account |
| **The owner's real account** | project rule 1: nothing sends, marks read or sends presence unless the command asked for it; live sends go only to the owner's own chat |

[`bin/finish-agent-setup`](../../bin/finish-agent-setup) writes the `denyRead` and `allowRead` lists above into the
settings and runs `bin/check-agents`; the owner runs it once, from a terminal.

## Rules for a session

- **The handbook first.** The
  [WireCat CLI standards](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/README.md) win over
  this page and over [`CLAUDE.md`](../../CLAUDE.md). Read the area's page before changing that area, and cite the
  rule ids the change touches (`WC-<AREA>-<n>`) in the commit message and the PR body.
- **A branch and a PR per change**, off `origin/main`: `git switch -c feat/<item> --no-track origin/main`.
- **What cli-core already does, do not do again here.** A gap in cli-core is fixed in cli-core, in its own PR.
- **Do not touch another session's worktree or branch**, even to help.
- **`docs/dev/test-matrix.md` and `docs/commands.md` are generated**: on a conflict run `pnpm test:matrix` or
  `pnpm generate` and commit what it writes, never merge them by hand.
