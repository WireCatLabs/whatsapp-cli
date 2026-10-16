# Optional fields are spread in, never set to undefined

- Pass an optional value as `...(x === undefined ? {} : { x })`; never `{ x: undefined }`.
- Use `=== undefined` when a falsy value is valid (`signal`, `qrFile`); a truthiness check for objects (`keyring`, `fetch`).
- A small helper returning the optional object is fine (`proxyOption(through)`).
- Build the whole object at once with conditional spreads; never add a property after creating it.

**Why:** An object built once has one type the compiler checks; adding keys later fails to type-check or widens the type. The compiler does not force the spread (`exactOptionalPropertyTypes` is off in cli-base's base tsconfig).

**Open:** Why this pattern (about 200 places) — style, a downstream library that checks `in`, or a plan to turn `exactOptionalPropertyTypes` on?

See: [tg-cli `src/commands/context.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/context.ts) · [tg-cli `src/commands/session.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/commands/session.ts) · [tg-cli `src/program.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/program.ts)
