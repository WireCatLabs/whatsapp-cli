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

The message id `3EB0A1B2C3D4E5F6A7B8` on this page is made up; take a real one from `messages list -v`.

```sh
wa personal messages edit "Book club" 3EB0A1B2C3D4E5F6A7B8 "the new text"
wa personal messages delete "Book club" 3EB0A1B2C3D4E5F6A7B8 --for-everyone
wa personal reactions add "Book club" 3EB0A1B2C3D4E5F6A7B8 👍
wa personal messages pin "Book club" 3EB0A1B2C3D4E5F6A7B8 --expire-time 24h
wa personal messages unpin "Book club" 3EB0A1B2C3D4E5F6A7B8
wa personal chats mark-read "Book club"
```

WhatsApp names a message by who sent it as well as by its id, so these work on messages the local store holds; keep
`serve` running. An edit works on your own message within 20 minutes of sending. A deletion here is for everyone;
delete a message for yourself alone on the phone. Every pin tells the chat's members: WhatsApp has no quiet pin, so no
flag is needed. A pin lasts 24 hours, 7 days or 30 days (`--expire-time 24h`, `7d`, `30d`); without
`--expire-time`, `wa` pins for 7 days. Nothing is marked read unless you ask: `chats mark-read`, or `--mark-read` on
`messages list`, `inbox` and `review`.

## Mute a chat

```sh
wa personal chats mute "Book club"              # for good
wa personal chats mute "Book club" --until 8h   # or until a time: --until 2026-10-09T09:00
wa personal chats unmute "Book club"
```

Muting is your own setting, which WhatsApp syncs to your other devices; nobody in the chat is told. Whether the phone
applies it to a one-to-one chat has not been checked yet. A device linked a few minutes ago may not have WhatsApp's
settings keys yet; keep `serve` running a while and try again. Mute a channel on the phone.

A reply (`messages send --reply-to 3EB0A1B2C3D4E5F6A7B8`) to a message the local store holds shows the quoted text
and its sender on the phone. A reply to one the store lacks is still sent, with the message's id alone; WhatsApp's
apps may then show the quote as unavailable.

## Delete or clear a chat

```sh
wa personal chats clear "Book club" --allow-dangerous    # every message, starred ones too; the chat stays
wa personal chats delete "Book club" --allow-dangerous   # the chat itself
```

Both are for your devices alone: the others in the chat keep it and its messages. Without `--allow-dangerous` they ask
first in a terminal and refuse in a script. WhatsApp deletes up to a message `wa` names: the chat's newest one in the
local store, so keep `serve` running for it to be current, and a chat the store holds nothing of is refused. `wa`
asks WhatsApp to leave the photos and files the phone saved from the chat. `wa`'s local store still holds the
messages afterwards. None of this has been checked on a phone yet.

## Format a message

```sh
wa personal messages send "Book club" "**Friday** at _8_, see [the notes](https://example.com/n)" --md
printf '**Agenda**\n- the _new_ book\n> a quote\n' | wa personal messages send "Book club" --md
wa personal messages edit "Book club" 3EB0A1B2C3D4E5F6A7B8 "**moved** to Friday" --md
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
wa personal polls show "Book club" 3EB0A1B2C3D4E5F6A7B8        # the question, its answer ids and the counts
wa personal polls vote "Book club" 3EB0A1B2C3D4E5F6A7B8 a1b2c3d4
wa personal polls vote "Book club" 3EB0A1B2C3D4E5F6A7B8 --retract
wa personal polls voters "Book club" 3EB0A1B2C3D4E5F6A7B8      # who voted for what, newest first
```

Everyone in the chat sees who voted for what, and a vote can always be changed, so there is no `--anonymous` and
no `--revote`. A WhatsApp poll has 2 to 12 answers, each with its own text; it is never a quiz and never
closes, so there is no `polls close`. Vote by the ids `polls show` prints; `a1b2c3d4` above is made up.
`polls show`, `polls vote` and `polls voters` work on a poll the local store holds, a poll made with `wa polls create`
among them. WhatsApp gives a device a poll's key only when the poll reaches it, so a poll from before the link may
refuse a vote.

WhatsApp has no request for the votes: each one arrives once, as its own message. `wa serve` and `wa watch` keep each
person's newest vote in the local store (`watch --events` prints each new one), and the votes the phone sends with
its history right after linking too, so the counts are what the store heard. A vote cast while nothing listened is
missed until that person votes again.

## Privacy

```sh
wa personal account privacy show                         # who sees last seen, the photo, about; receipts, groups, calls
wa personal account privacy set --last-seen contacts     # only contacts see when you were last online; the rest stays
wa personal account privacy set --hide-online on         # last seen to nobody, online only to those who see it
wa personal account privacy set --read-receipts off      # no read receipts sent, and none shown to you
```

`show` asks WhatsApp each time, not a copy kept on this computer. `set` changes only what you name and
answers every setting as it now is; it changes your account on every device, and goes through the profile's
permissions like a send (`permissions.account.privacy.set`). It sends one request per setting: if WhatsApp fails
one, the settings sent before it stay changed and the error says so; run `show` to see where things are.

- **`--last-seen`, `--profile-photo` and `--about-text`** take everyone, contacts or nobody. A setting kept on the
  phone as "my contacts except…" shows as `contacts_except`; `set` cannot choose it, since the list of exceptions
  stays on the phone, and setting another value replaces it.
- **`--hide-online on`** sets last seen to nobody and online to "same as last seen", so nobody sees either.
  `--hide-online off` shows last seen to your contacts, since `wa` does not know the setting from before it was
  hidden; `--last-seen everyone` instead chooses who. Give one of the two, not both.
- **`--read-receipts off`** works both ways, as on the phone: others no longer see when you read their messages,
  and you no longer see when they read yours. `chats mark-read` then marks a chat read on your own devices only
  (whatsmeow sends a read receipt only to your devices while receipts are off; read in its code, not checked on a
  real account).
- **`--chat-invites`** takes everyone or contacts: WhatsApp is reported to refuse nobody, so `wa` refuses it. A
  setting kept with exceptions on the phone is left out of `show`.
- **`--calls contacts`** is meant as the phone's "silence unknown callers" (calls from people you do not know arrive
  without ringing); this is not yet checked on a real account. WhatsApp has no `--calls nobody`, so `wa` refuses it.

WhatsApp has no setting for who finds you by your number or who sees it, so `wa` does not offer `--find-by-phone` or
`--phone-number`.

## Send, save and forward files

```sh
wa personal messages send "Book club" "the agenda" --file agenda.pdf
wa personal messages send "Book club" "us, last week" --photo photo.jpg
wa personal messages send "Book club" --voice note.ogg
wa personal messages download "Book club" 3EB0A1B2C3D4E5F6A7B8 --output-dir ~/Downloads
wa personal messages transcribe "Book club" 3EB0A1B2C3D4E5F6A7B8 --local
wa personal messages forward "Book club" 3EB0A1B2C3D4E5F6A7B8 --to "Ann Lee"
```

A message carries one file; the text becomes its caption, except on a voice note, which goes alone. A `.mp4`, `.m4v`
or `.mov` goes as a video unless `--as-file`. A `--photo` and a video `--file` together go as one album, the text as
the photo's caption. Photos, videos, voice notes, files and stickers that reach the local store
can be saved and forwarded later, since the store keeps what WhatsApp needs to fetch them again; WhatsApp keeps a file
for a limited time, so an old one may be gone. A place or a contact card is shown, not saved. WhatsApp has no speech
recognition of its own, so `transcribe` uses a model on this machine (`wa models audio list`). What is kept, what
can be fetched again and how to search the text inside files: [file attachments](attachments.md).

## Older messages

WhatsApp keeps no history on its servers, so older messages can only come from your phone, 50 at a time, while
WhatsApp is open on it: `wa personal messages sync "Book club"` asks for them, one chat at a time
([how](archive.md#older-history-from-your-phone)).

## Not in wa yet

`wa` shares its command tree with tg and max, so some commands are there that WhatsApp cannot run. Each one stops
with exit code `2` and says why. Nothing reaches WhatsApp.

Not built yet:

- several files in one message: a message carries one file;
- deleting a message for yourself alone: delete it on the phone;
- who joined and left a group, as WhatsApp records it: `chats events` reads the local store, which does not keep
  them yet, so its empty list does not mean nobody joined (`chats members history` shows the changes between member
  fetches);
- removing a group's photo (`chats update --photo` sets one), and communities;
- where an invite link leads, without joining (`chats inspect`);
- your own name, about line or photo (`account update`);
- the list of linked devices, and ending the others (`account sessions`);
- making a channel (`chats create --channel`).

WhatsApp has no such thing, or keeps it on the phone:

- forum topics, chat folders (`chats folders`) and comments under channel posts (`messages comments`);
- more than one invite link per group: `chats link reset` replaces the one there is;
- admins with only some rights: every admin has all of them;
- polls that close, quizzes and anonymous polls;
- silent, scheduled or send-as messages;
- your address book: `contacts add`, `remove`, `rename` and `import` are refused;
- how old an account is: a `newAccount` rule in `chats rules set` is refused.

`wa` never answers by itself: there are no automatic replies, as WhatsApp bans accounts that answer like a bot.
What is planned is on the [roadmap](roadmap.md).

## Keep wa up to date

`wa upgrade` installs the newest version and restarts each running server ([upgrade](installation.md#upgrade)).

## Where to go next

- [Linking, devices and profiles](sessions.md) — QR or pairing code, and why one command at a time may connect.
- [Search](search.md) and [the local store](archive.md) — find what was said, export it, back it up.
- [The MCP server](mcp.md) — the same commands for an app with no terminal.
- [Recipes](recipes.md) — what an agent can do for you every day.

Every command and option is on the [commands page](commands.md).
