See [`CLAUDE.md`](CLAUDE.md) — the working rules apply to every agent. Start from [`docs/dev/ARCHITECTURE.md`](docs/dev/ARCHITECTURE.md).

The [WireCat CLI standards](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/README.md) (also in
`node_modules/@wirecat/cli-base/docs/standards/`) win over this file and over `CLAUDE.md`. Read the page for the area
you change before changing it, and cite the rule ids your change touches (`WC-<AREA>-<n>`) in the commit message and
the PR body.


## Documentation authoring

Before documentation work, read the [shared authoring rules](https://github.com/WireCatLabs/cli-docs/blob/main/docs/AUTHORING.md).
Every user guide starts with a brief explanation of when to use it and what result the reader
will get; mention a prerequisite only when it changes the next step. Keep titles short and
task-specific. A new sidebar page needs a relevant icon and a contextual incoming link.
Preserve released command facts and existing URLs/anchors.
The handbook's rules for documents are on its
[Documents page](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/docs.md)
(`WC-DOC-1` to `WC-DOC-20`).
