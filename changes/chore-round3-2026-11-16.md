### Changed — may break callers

- **Built on cli-core 0.674.0** (was 0.665.0) and cli-base 0.103.0 (was 0.101.0). The shared store moves to version
  67, so upgrade the other WireCat CLIs that share it too. A command run without a profile it needs now carries the
  reason `profile.missing`. See the
  [cli-core changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md).
- **The engine is built with golang.org/x/sys 0.50.0 and modernc.org/sqlite 1.62.0** (were 0.49.0 and 1.61.1), and
  its third-party notices name them.
