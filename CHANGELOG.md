# Changelog

Notable changes to `@wirecat/whatsapp-cli`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the command interface may still change.

## Unreleased

### What's new

- **The foundation**: the shared cli-core commands over a WhatsApp adapter that reads from the local store, an
  engine contract, and the same linters, checks and CI as tg-cli and max-cli.
- **The WhatsApp engine**: `wa` connects through a Go program built on whatsmeow, started for each command that
  connects and stopped when it ends. One command at a time may connect a profile; a second is told which one holds it.
- **`wa <profile> session start [qr|phone]`** links the profile by QR code or pairing code and keeps the history the
  phone sends right after linking. **`session end`** unlinks the device and deletes its keys.
- **Changing messages**: `messages edit` (your own, within WhatsApp's 20 minutes), `messages delete --for-everyone`
  (your own, or another's in a group you administer), `reactions add` and `reactions remove`, and `chats mark-read`
  and `--mark-read`, which send a read receipt only when asked. Each needs the message in the local store, which
  `serve` keeps filled; WhatsApp addresses a message by its sender. Deleting for you alone and forwarding are not
  built yet.
