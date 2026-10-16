# wa-only behaviour wraps shared commands, never forks them

- Wrap a shared command with `withX(command)` that adds `preAction` / `postAction` hooks.
- Stage side effects in a `pending` closure during `preAction`; run them in `postAction`, only after the shared action succeeded.
- Change wording in `program.ts`'s `configure` by finding the command or option and rewriting its description or help.

**Why:** The shared command stays one implementation for tg, max and wa.

**Open:** When is patching shared wording here right, rather than changing it upstream in cli-core?

See: [tg-cli `src/commands/proxy-config.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/proxy-config.ts) · [tg-cli `src/program.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/program.ts) · [tg-cli `src/commands/update.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/update.ts)
