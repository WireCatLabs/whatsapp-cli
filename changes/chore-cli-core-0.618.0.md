### Fixed

- **`wa serve` exits when the build it runs is out of date, so its service starts the new one.** Every minute it
  checks whether the shared store moved to a format this build can no longer write, or whether a newer wa is
  installed. If so it logs `serve.outdated` and exits with code 3, and the systemd unit (`Restart=on-failure`)
  starts the installed version. Before, a serve ran on 0.30.0 for a day after 0.33.0 was installed and stored nothing.
- **After `wa store recover run`, the store marks what it held from a day before the last deep check that passed as
  not fetched.** WhatsApp cannot be asked for its chats, so only what the phone pushes while `wa serve` runs comes
  back. From cli-core 0.618.0 (was 0.616.0).
