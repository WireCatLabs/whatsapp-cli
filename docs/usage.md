# Usage

Use this page to learn how a `wa` command line is built and where its answers come from.

```sh
wa <profile> <resource> <verb> [arguments] [options]
wa personal chats list
wa personal messages list "Book club" --limit 20
wa personal search messages "dinner"
```

- **The first word is the profile.** Any name works; `wa` never picks one for you.
- **Reads answer from the local store**, which `wa <profile> serve` keeps filled from your phone. A read never
  connects to WhatsApp.
- **`--json`** prints one JSON value on stdout for scripts and agents; diagnostics go to stderr.

## Link a profile

```sh
wa personal session start          # a QR code to scan in WhatsApp > Settings > Linked devices
wa personal session start phone    # type your number, then a pairing code on the phone
```

Right after linking, the phone sends your history once. `session start` keeps it in the local store and stops when
the phone goes quiet. Then `wa personal server install` keeps receiving in the background. `wa personal session end`
unlinks the device and deletes its keys here.

Only one `wa` command may connect a profile at a time; WhatsApp would drop the first connection. While `serve` runs,
a send for the same profile is refused and names `serve`.

Every command and option is on the [commands page](commands.md).
