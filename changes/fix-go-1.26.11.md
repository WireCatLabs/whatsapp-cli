### Fixed

- **The engine is built with Go 1.26.11**, which fixes GO-2026-6859 in Go's `net/http`. The engine reaches it through
  whatsmeow's connection and media requests. Nothing changes in how `wa` behaves.
