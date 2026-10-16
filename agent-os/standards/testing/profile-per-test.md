# One profile name per test

- The sandbox gives each test file one temporary folder; config, the send journal and the store carry over between tests.
- So each test passes its own profile first (`g-comment`, `g-open`) or a file-level constant.
- A test that needs its own store makes a fresh temp folder and passes `MESSAGING_STORE`.

**Why:** Open.

**Open:** Unique profiles over a fresh sandbox per test — for speed, or to keep shared state visible? Is the `g-` prefix a rule?

See: [tg-cli `src/send-guard.test.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/send-guard.test.ts) · [tg-cli `src/sdk148-adoption.test.ts`](https://github.com/WireCatLabs/tg-cli/blob/main/src/sdk148-adoption.test.ts)
