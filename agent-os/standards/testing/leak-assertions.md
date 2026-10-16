# Synthetic markers, and a check that they don't leak

- Test data is visibly fake (`synthetic text ${id}`); content that must stay hidden carries a unique marker (`consumerocrneedle`).
- Assert the marker or secret is absent from output and errors: `.not.toContain(needle | token)`.
- Use the marker positively to prove content was found by the expected route.

**Why:** Proves the no-real-data rule actively, not by convention.

**Open:** Should every feature that handles message text, tokens or file contents ship a does-not-leak assertion?

See: [tg-cli `src/testing/scripted.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/testing/scripted.ts) · [tg-cli `src/attachment-ocr-adoption.test.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/attachment-ocr-adoption.test.ts) · [tg-cli `src/bot-api.test.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/bot-api.test.ts)
