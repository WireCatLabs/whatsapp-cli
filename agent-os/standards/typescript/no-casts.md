# Narrow types, don't cast them

- No `as` except `as const`: narrow with a type guard, `instanceof`, or by checking the shape.
- In `catch`, narrow with `instanceof` and wrap anything else: `e instanceof CliError ? e : new CliError("provider_error", String(e), { cause: e })`.
- A test fixture uses an honest input type (`Omit<T, "x"> & { x: string | null }`), not `as unknown as T`.
- A cast that cannot be avoided (a library typed too loosely) gets a why-comment on that line.

**Why:** A cast tells the compiler to stop checking; a renamed field or a changed library type then fails at runtime instead of at build.

**Scope (owner, 2026-10-08):** new code only for now. Later: remove the 97 existing casts in `src/`, then turn on a lint rule so the standard holds without anyone remembering it.

See: `grep -rnE " as [A-Z]| as unknown" src --include='*.ts'`
