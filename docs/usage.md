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
a send for the same profile goes through `serve` and uses its connection. It cannot ask there, so at permission
level `ask` it needs `--yes` ([one connection per device](sessions.md#one-connection-per-device)).

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

A reply (`messages send --reply-to 3EB0…`) to a message the local store holds shows the quoted text and its sender
on the phone. A reply to one the store lacks is still sent, with the message's id alone; WhatsApp's apps may then
show the quote as unavailable.

## Format a message

```sh
wa personal messages send "Book club" "**Friday** at _8_, see [the notes](https://example.com/n)" --md
printf '**Agenda**\n- the _new_ book\n> a quote\n' | wa personal messages send "Book club" --md
wa personal messages edit "Book club" 3EB0… "**moved** to Friday" --md
```

`--md` reads Markdown and sends it in WhatsApp's own marks: `**bold**` or `*bold*` becomes `*bold*`, `_italic_`
stays `_italic_`, `~~strike~~` becomes `~strike~`, `` `code` `` and ```` ``` ```` blocks stay, quotes (`>`) and
lists (`-`, `1.`) stay as they are, and a `#` heading becomes bold. A link becomes its label and then its address, which
WhatsApp makes clickable. Underline, spoilers and highlights have no mark in WhatsApp and stay plain text. WhatsApp
has no way to keep a `*` literal, so `\*word\*` still reads as bold there. Without `--md` the text goes as typed, so
WhatsApp's own marks work anyway.

## Polls

```sh
wa personal polls create "Book club" "Which day?" Monday Tuesday            # one answer each
wa personal polls create "Book club" "Which books?" Dune Emma Ulysses --multiple
wa personal polls show "Book club" 3EB0…        # the question and its answer ids
wa personal polls vote "Book club" 3EB0… <answer id>
wa personal polls vote "Book club" 3EB0… --retract
```

Everyone in the chat sees who voted for what, and a vote can always be changed, so `--anonymous` is refused and
`--revote` changes nothing. A WhatsApp poll has 2 to 12 answers, each with its own text; it is never a quiz and never
closes, so `polls close` is refused. Vote by the ids `polls show` prints. `polls show` and `polls vote` work on a poll
the local store holds, and WhatsApp gives a device a poll's key only when the poll reaches it, so a poll from before
the link may refuse a vote. A poll made with `wa polls create` is not kept in the local store yet, so it cannot be
shown or voted on from `wa`; vote on it on the phone. WhatsApp has no request for the votes, so `wa` does not count them yet: `voters` is
`null`.

## Send, save and forward files

```sh
wa personal messages send "Book club" "the agenda" --file agenda.pdf
wa personal messages send "Book club" "us, last week" --photo photo.jpg
wa personal messages send "Book club" --voice note.ogg
wa personal messages download "Book club" 3EB0… --output-dir ~/Downloads
wa personal messages transcribe "Book club" 3EB0… --local
wa personal messages forward "Book club" 3EB0… --to "Ann Lee"
```

A message carries one file; the text becomes its caption, except on a voice note, which goes alone. A `.mp4`, `.m4v`
or `.mov` goes as a video unless `--as-file`. Photos, videos, voice notes, files and stickers that reach the local store
can be saved and forwarded later, since the store keeps what WhatsApp needs to fetch them again; WhatsApp keeps a file
for a limited time, so an old one may be gone. A place or a contact card is shown, not saved. WhatsApp has no speech
recognition of its own, so `transcribe` uses a model on this machine (`wa models audio list`).

## Older messages

WhatsApp keeps no history on its servers, so older messages can only come from your phone, 50 at a time, while it is
online: `wa <profile> messages sync <chat>` asks for them, one chat at a time
([how](archive.md#older-history-from-your-phone)).

## Keep wa up to date

`wa upgrade` installs the newest version with the package manager that installed `wa`, and restarts each running
server. `wa upgrade --check` only says what it would run. Once a day `wa` says on stderr when a newer version exists;
`WA_NO_UPDATE_CHECK=1` or `update_check: false` in the settings turns that off. The engine comes as a package of
`wa`, so it updates with it.

## Where to go next

- [Linking, devices and profiles](sessions.md) — QR or pairing code, and why one command at a time may connect.
- [Search](search.md) and [the local store](archive.md) — find what was said, export it, back it up.
- [The MCP server](mcp.md) — the same commands for an app with no terminal.
- [Recipes](recipes.md) — what an agent can do for you every day.

Every command and option is on the [commands page](commands.md).
