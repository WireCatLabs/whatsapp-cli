# Secrets never on argv, stored only after a successful use

- A secret (proxy password, MTProxy secret, app hash, 2FA password) is read with `readSecret` from a TTY or `-`; on argv it is refused with `validation_error`.
- Write it to the keyring only after the remote side accepted it.
- Temporary credential files (QR PNG) are mode `0600` and removed in `finally`.
- `doctor` reports file modes and prints the `chmod` fix without applying it.

**Why:** argv is visible to other processes and shell history; a keyring entry cannot be read back to check it.

**Open:** Is "print the fix, never apply it" a rule for every `doctor` check?

See: [tg-cli `src/commands/proxy-config.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/proxy-config.ts) · [tg-cli `src/commands/session.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/session.ts) · [tg-cli `src/commands/context.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/context.ts)
