### Fixed

- **Older history comes from the phone more slowly.** `messages sync <chat>` asks for a page 5 to 10 seconds apart instead of 2 to 4, and `wa` makes no more than 20 requests a minute across its processes, as WhatsApp may ban a number that reads fast ([limits](../docs/limits.md#no-bulk-reads)).
