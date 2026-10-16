# Error messages carry the next command

- Every `CliError` names the exact command that fixes the problem, in backticks, built with `` `wa ${asFirstWord(profile)}…` `` so it works for any profile.
- Where agents may hit it, add "agents: read `wa skill show`".
- Lower case, `—` before the fix, no final period; interactive needs say "run it in a local terminal".

**Why:** A person or an agent can copy the fix and run it as is.

**Open:** Is this wa-only, or should it move to the cli-core standard for both CLIs?

See: [tg-cli `src/commands/context.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/context.ts) · [tg-cli `src/commands/proxy-config.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/proxy-config.ts) · [tg-cli `src/commands/setup.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/setup.ts)
