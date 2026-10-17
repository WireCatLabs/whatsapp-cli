# Documentation

`wa` is a command line interface for a personal WhatsApp account, built for agents and scripts first. Each page
below answers one question. Open the one you need; they are not meant to be read in order.

## Using it

| Page | Answers |
|---|---|
| [index.md](index.md) | The docs site's start page: what `wa` is, the first minute, where to go next |
| [installation.md](installation.md) | How do I install it, and what does it need? |
| [usage.md](usage.md) | How do I link, read, send and change a message — in that order? |
| [sessions.md](sessions.md) | How does linking work: QR or pairing code, one connection per device, profiles, unlinking? |
| [archive.md](archive.md) | What does the local store keep, how is it filled, and how do I export and back it up? |
| [search.md](search.md) | How do I find a message by its words, sender, chat, date or label, save a search and count? |
| [attachments.md](attachments.md) | Sending, saving and forwarding files; their text, and voice notes as text |
| [query-language.md](query-language.md) | Every search field, operator, preset, limit and the JSON answer |
| [groups.md](groups.md) | How do I keep up with a group — open questions, activity, a weekly report? |
| [people.md](people.md) | One person: what the store holds about them, your own names and notes |
| [mcp.md](mcp.md) | How do I connect Claude Desktop, Cursor or another client without a terminal? |
| [remote.md](remote.md) | ChatGPT or Claude in the browser, through a login and a tunnel |
| [recipes.md](recipes.md) | What can an agent do for me every day, and how do I run it on a schedule? |
| [configuration.md](configuration.md) | How do I configure common behaviour? |
| [permissions.md](permissions.md) | What a profile may read, what asks first, and what may go ahead |
| [profiles.md](profiles.md) | Several accounts on one computer, and how a command picks one |
| [configuration-reference.md](configuration-reference.md) | Every key, default, scope and variable |
| [cli-contract.md](cli-contract.md) | Invocation, output, errors, headless runs, bounds and previews |
| [limits.md](limits.md) | Limits, waits and the one connection per device |
| [diagnostics.md](diagnostics.md) | What did a command do, and what is never recorded? |
| [troubleshooting.md](troubleshooting.md) | Something does not work: what the screen says, and what to do |
| [security.md](security.md) | What does `wa` keep on my computer, and what can go wrong? |
| [commands.md](commands.md) | Every command, option and exit code — **generated** from the program |
| [roadmap.md](roadmap.md) | What is coming next? |

What changed between versions: [CHANGELOG.md](../CHANGELOG.md).

[meta.json](meta.json) is the sidebar of the docs portal: every page above, in order. It follows
[the shared page structure](https://github.com/WireCatLabs/cli-docs/blob/main/docs/STRUCTURE.md); a new page goes
into it too. This index is for contributors and stays out of the portal.

## The reference is generated

[commands.md](commands.md) is written by `pnpm generate` from the command tree, and CI fails when the committed page
differs from what the program says. The same list, as JSON, is `wa commands --json`. It lists every command
cli-core mounts; the ones WhatsApp cannot do yet answer exit code `2`.

## Building it

- [dev/ARCHITECTURE.md](dev/ARCHITECTURE.md) — how `wa` is built, and which seams you may not cross
- [dev/CONVENTIONS.md](dev/CONVENTIONS.md) — how code and documents are written here
- [dev/TESTING.md](dev/TESTING.md) — how to check a change, and what each check is for
- [dev/agents.md](dev/agents.md) — how agent sessions run here, and what stops them
- [dev/live-scenarios.md](dev/live-scenarios.md) — what a person checks on the real WhatsApp before a change ships
- [dev/BACKLOG.md](dev/BACKLOG.md) — open work; the shared package [cli-core](https://github.com/WireCatLabs/cli-core)
  holds everything that is not specific to WhatsApp
