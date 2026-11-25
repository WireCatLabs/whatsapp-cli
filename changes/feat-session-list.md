### Changed — may break callers

- **`wa session list` lists the profiles on this computer, and `wa account list` is gone** (WC-ACCT-12, WC-CMD-8).
  It answers the same rows, takes the same query (`profile:`, `current:`) and needs no profile. There is no alias:
  a script that runs `wa account list` must say `wa session list`. `account show`, `account update`,
  `account sessions` and the rest of `account` stay.
- **The store moves to version 72** on its first open (cli-core 0.722.0). Like every store migration it only goes
  forward.

### Added

- **`wa <profile> session status` says whether the profile is logged in, and as whom**, from this computer alone.
  `--check` asks the messenger whether the session still works, and leaves the phone number out (`account show`
  has it). From cli-core 0.751.0 (was 0.715.0).
