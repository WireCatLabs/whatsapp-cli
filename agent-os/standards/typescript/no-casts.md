# Narrow types, don't cast them

- No `as` except `as const`: narrow with a type guard, `instanceof`, or by checking the shape.
- In `catch`, narrow with `instanceof` and wrap anything else: `e instanceof CliError ? e : new CliError("provider_error", String(e), { cause: e })`.
- A test fixture uses an honest input type (`Omit<T, "x"> & { x: string | null }`), not `as unknown as T`.
- A cast that cannot be avoided (a library typed too loosely) gets a why-comment on that line.

**Why:** A cast tells the compiler to stop checking; a renamed field or a changed library type then fails at runtime instead of at build.

**Handbook:** WC-STYLE-5 and WC-STYLE-6; the handbook wins. New code only for now: the 6 casts already in wa's `src/` (2026-10-17) stay until a lint rule lands.

See: `grep -rnE " as [A-Z]| as unknown" src --include='*.ts'`
