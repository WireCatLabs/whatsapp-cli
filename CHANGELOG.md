# Changelog

Notable changes to `@wirecat/whatsapp-cli`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the command interface may still change.

## Unreleased

### What's new

- **The foundation**: the shared cli-core commands over a WhatsApp adapter that reads from the local store, an
  engine contract, and the same linters, checks and CI as tg-cli and max-cli.
- **The WhatsApp engine**: `wa` connects through a Go program built on whatsmeow, started for each command that
  connects and stopped when it ends. One command at a time may connect a profile; a second is told which one holds it.
- **Installs with its engine**: `npm install --global @wirecat/whatsapp-cli` also installs the engine for your system,
  a small package of its own, for Linux, macOS and Windows on x64 and arm64. `WA_ENGINE` still runs another one. A
  global install also installs the agent skill and, on Windows, puts `wa` on the user's PATH, as tg does.
- **`wa <profile> session start [qr|phone]`** links the profile by QR code or pairing code and keeps the history the
  phone sends right after linking. **`session end`** unlinks the device and deletes its keys.
- **Changing messages**: `messages edit` (your own, within WhatsApp's 20 minutes), `messages delete --for-everyone`
  (your own, or another's in a group you administer), `reactions add` and `reactions remove`, and `chats mark-read`
  and `--mark-read`, which send a read receipt only when asked. Each needs the message in the local store, which
  `serve` keeps filled; WhatsApp addresses a message by its sender. Deleting for you alone and forwarding are not
  built yet.
- **`wa <profile> setup`** is the guided first run, as in tg: it checks this computer, links the device or reuses it,
  reads the account and five chats from the local store, and installs the agent skill (`--agent`). Agents use
  `--qr-file`.
- **`wa upgrade`** installs the newest version with the package manager that installed `wa` and restarts running
  servers; a daily line on stderr says when a newer version exists.
- **`wa doctor`** reports whether the engine program is found, whether the device keys exist with private file
  modes, and who last held the device's lock and whether that process still runs.
