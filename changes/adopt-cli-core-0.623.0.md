### Changed — may break callers

- **Built on cli-core 0.623.0** (was 0.618.0). The store moves to version 61 on first open (people ties, additive).
  What changed in between is in [cli-core's changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md).
- **`search messages --timeout 30s` may search for up to about 29 seconds.** It stopped at 2 seconds whatever time the
  run was given, so a valid query over a large store failed in WireCat Desktop. Without `--timeout` it stays 2 seconds,
  for agents and MCP too.
