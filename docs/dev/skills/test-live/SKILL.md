---
name: test-live
description: Test a whatsapp-cli change against the real WhatsApp before it ships — pick the live scenarios the change touches, get the owner's yes, have them run on the owner's installed wa in the owner's own chat (or the explicitly confirmed two-owned-account one-shot regression), put back what they change, record the shape of every answer and never its content. Use when asked to test live, check a branch on the real account, run the live scenarios, «проверить вживую», «прогнать живые сценарии».
---

# Test a change live

The rules are shared with tg-cli and max-cli: cli-core's
[RELEASING.md, "Live checks"](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/RELEASING.md#live-checks).
Read them first. **This is the owner's real WhatsApp account**: a mistake writes to a person, and WhatsApp bans
accounts for messages to strangers and for bulk sends ([CLAUDE.md](../../../../CLAUDE.md), rule 1).

The [WireCat CLI standards](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/README.md) win over this
skill: no workflow starts a live test (`WC-CI-13`), and no message, name or phone number reaches a log or a document
(`WC-SECR-1`). Cite the rule ids a live run checks in the report.

The scenarios are public, by role: [docs/dev/live-scenarios.md](../../live-scenarios.md). The owner's profile name,
the own chat's id and the results are private: `docs_ai/live-cast.md` of the main checkout. Without it, say so and do
not guess a profile or a chat.

Nothing here sends, marks read, deletes or stops `serve` without the owner's yes in this session.

## 1. Pick the scenarios

```sh
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- docs/commands.md        # generated: the commands and options that changed
```

Map each changed command to the scenario ids that exercise it. Drop what the page's "Not run" table rules out, and
name what you dropped.

## 2. Show the list and wait for yes

One line per scenario: its id, the commands, what it changes and how that is put back, and whether it needs the
owner's `serve` stopped. Wait for the owner's yes. A scenario not on the approved list is not run.

## 3. Run on the owner's install, not on `bin/wa`

A worktree's `bin/wa` keeps its own `.wa/` folder and store, which have no linked device; **never link one** — that is a new
device on the owner's account. Live scenarios run the owner's installed `wa` (a release, or the main checkout's build
the owner installed) against the owner's profile:

- the owner runs them from a terminal, or
- with the owner's yes for this run, the agent runs each call alone, as a plain command, and reads the shape from
  its output.

A scenario that connects needs the device free: the owner stops `serve` first and starts it again after. An agent
never stops the owner's `serve`, and never kills a process it did not start.

Sends go only to the own chat, except `bin/live-oneshot-drop <receiver-profile> --sender-profile <sender-profile>`:
with the owner’s explicit confirmation that both different accounts are theirs, that owner-run script sends
exactly two probes from sender to receiver. It checks only the receiver’s account and the sender’s chat; it
changes no permissions or recipient lists. Keep other reads small (`--limit 3`).

Nine checks are scripts the owner runs, never the agent: `bin/live-oneshot-drop`, `bin/live-poll-vote`,
`bin/live-older-history`, `bin/live-fresh-link`, `bin/live-chat-state`, `bin/live-album`, `bin/live-expired-file`,
`bin/live-forward-card` and `bin/live-chat-events`
([live-scenarios.md, "Scripts the owner runs"](../../live-scenarios.md#scripts-the-owner-runs)).
When a change touches what one covers, name the script and its profile argument to the owner, and record the lines
it prints.

## 4. Record and report

Append a dated row per scenario to the Results table in `docs_ai/live-cast.md`: the branch or version, the id,
PASS/FAIL, the exit codes and shapes. No message text, no names, no phone numbers, no ids of real people.

Report to the owner what ran, what failed (the command and exit code), what was dropped and why, and anything that
could not be put back exactly.
