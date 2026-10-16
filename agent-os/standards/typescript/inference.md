# Let TypeScript infer

- Annotate exports and function signatures; let locals infer (`const count = items.length`).
- In `.filter()`, let the callback body narrow (`xs.filter((x) => x !== null)`); write an explicit `x is T` only for a reused, named guard or a check the compiler cannot follow.
- Inline a type used once; name it when it is exported or used in three or more places.
- Keep a type next to the code that owns it; a shared types file only for contracts across several modules.

**Why:** A redundant annotation is noise, and a hand-written `x is T` is not checked against its body — it can claim the wrong type and compile.

**Open:** `src/` has 4 explicit predicates — keep them as named guards, or let them infer?

See: `grep -rnE "\): [a-z]+ is " src --include='*.ts'`
