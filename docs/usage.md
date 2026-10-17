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

## Set up a profile

```sh
wa personal setup                  # link, check five chats, offer the agent skill; about 5 minutes
wa personal setup --agent codex    # the same, and install the skill for Codex
wa personal setup --method phone   # a pairing code instead of the QR code
```

`setup` runs five steps: this computer's folders, the link (an existing device is reused and nothing is asked),
the account, five chats from the local store, and the agent skill. A device linked before is checked without linking
again. An agent without a terminal passes `--qr-file <png>` and hands the image on to be scanned; the image is
removed when linking ends.

## Link a profile

`setup` uses the same linking as `session start`, which does only the link:

```sh
wa personal session start          # a QR code to scan in WhatsApp > Settings > Linked devices
wa personal session start phone    # type your number, then a pairing code on the phone
```

Right after linking, the phone sends your history once. `session start` keeps it in the local store and stops when
the phone goes quiet. Then `wa personal server install` keeps receiving in the background. `wa personal session end`
unlinks the device and deletes its keys here.

Only one `wa` command may connect a profile at a time; WhatsApp would drop the first connection. While `serve` runs,
a send for the same profile is refused and names `serve`.

## Change a message

```sh
wa personal messages edit "Book club" 3EB0… "the new text"
wa personal messages delete "Book club" 3EB0… --for-everyone
wa personal reactions add "Book club" 3EB0… 👍
wa personal chats mark-read "Book club"
```

WhatsApp names a message by who sent it as well as by its id, so these work on messages the local store holds; keep
`serve` running. An edit works on your own message within 20 minutes of sending. A deletion here is for everyone;
delete a message for yourself alone on the phone. Nothing is marked read unless you ask: `chats mark-read`, or
`--mark-read` on `messages list`, `inbox` and `review`.

## Keep wa up to date

`wa upgrade` installs the newest version with the package manager that installed `wa`, and restarts each running
server. `wa upgrade --check` only says what it would run. Once a day `wa` says on stderr when a newer version exists;
`WA_NO_UPDATE_CHECK=1` or `update_check: false` in the settings turns that off. `upgrade` does not yet update the
WhatsApp engine program.

Every command and option is on the [commands page](commands.md).
