### Fixed

- **Older history comes from the phone more slowly.** `messages sync <chat>` asks for a page 5 to 10 seconds apart instead of 2 to 4, and `wa` makes no more than 20 requests a minute across its processes, as WhatsApp may ban a number that reads fast ([limits](../docs/limits.md#no-bulk-reads)).

### Changed — may break callers

- **Built on cli-core 0.641.0** (was 0.633.0). `contacts unlink` needs `--from person:<uid>` or `--from person:me`. Search takes part of a name in `from:` and `chat:`, and `*part*` of a word in message text. `messages sync` logs its progress as `sync.progress` events in the run's log. Details in [cli-core's changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md).
