### Changed — may break callers

- **Deleting messages no longer asks, and enabled reply rules send** (cli-core 0.659.0, was 0.656.0). `messages delete`
  go ahead without a question or `--allow-dangerous`; a profile that wants the question
  sets `messages.delete: ask`. `replies.send` is now `allow`, so `serve` sends the replies of the rules you turned on;
  a new rule still starts off, and `replies.send: deny` stops every automatic reply. See the
  [cli-core changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md).

### Fixed

- **A shared config with a small slip is mended when it is read.** `~/.config/WireCat/config.json` with a
  byte-order mark, a comment, a trailing comma or a missing comma between two lines is fixed in place, the old file
  kept beside it as `config.json.bak-<time>`. Other damage names its line, column and the likely fix.
