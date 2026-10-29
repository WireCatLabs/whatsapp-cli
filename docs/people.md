# People

Use this page when you want to know more about one person: which chats you share, what they wrote to you or in your
groups, and your own names and notes about them. You will learn how to read what the local store holds about a
person, collect their messages for a summary, and keep private names and notes.

Some words on this page:

- **The local store** is the copy of your messages that `wa` keeps on this computer, filled by the phone's history
  push and by `serve`. Everything on this page comes from it, so it shows only what arrived.
- **A person** is named by their WhatsApp id or part of their name. WhatsApp names most people by a hidden id that
  ends in `@lid` (`100000000000001@lid`), not by their phone number. When part of a name matches more than one
  person, the command stops and lists them; run it again with the id.

The commands below add `--offline` where the command could otherwise ask WhatsApp: it keeps them on the store, so
they never connect and work while `serve` runs.

## What you can do

| Task | Command |
| --- | --- |
| See a person and the chats you share | `wa personal contacts show` |
| Read what they said, in every chat or in the chats you name | `wa personal contacts context` |
| Record that a WhatsApp account and a Telegram or MAX account are one person | `wa personal contacts link` |
| Keep your own name and notes for a person | `wa personal contacts aliases`, `wa personal contacts notes` |

Every option of these commands is in the [command reference](commands.md).

## Who they are: `contacts show`

```sh
wa personal contacts show 100000000000001@lid --offline
wa personal contacts show 100000000000001@lid --offline --with-notes --json
```

It answers the person as the store knows them, and the chats you share with them. `--with-notes` adds your private
notes. The person is not told that you looked.

## What they said: `contacts context`

Without `--chat`, it gives an overview from the store: the chats you share, the last message each way, their recent
messages in your one-to-one chat and in groups, and where others mentioned them. It never connects.

```sh
wa personal contacts context 100000000000001@lid
```

With `--chat`, it gives their newest messages in each chat you name, oldest first, 20 per chat:

```sh
wa personal contacts context 100000000000001@lid --chat 120363000000000001@g.us --limit 10 --offline
```

- Each message is only its time and text, so an agent can read many of them at once. `-v` adds the message id, the
  sender and what it replies to; `-vv` gives the whole message.
- `more: true` means there are older messages than the limit; `complete: false` means the store does not hold the
  chat from its start, so the answer is a minimum. `messages sync` asks the phone for the older part
  ([older history](archive.md#older-history-from-your-phone)).

## One person in two messengers: `contacts link`

WhatsApp, Telegram and MAX share one local store on this computer. When you know that a WhatsApp account and an
account in another messenger are the same person, record it:

```sh
wa personal contacts link 100000000000001@lid max:"Example User"
wa personal contacts unlink 100000000000001@lid
```

After that, `contacts context` without `--chat` gathers both accounts. `contacts context --chat` still shows only the
account you named. The link is only ever what you record: the same name in two messengers is never taken as the same
person.

## Your own names and notes: `contacts aliases`, `contacts notes`

```sh
wa personal contacts aliases set 100000000000001@lid Ana    # your own name for a person, on this computer only
wa personal contacts aliases remove 100000000000001@lid
wa personal contacts notes add 100000000000001@lid --text-file note.txt  # or the text from stdin
wa personal contacts notes list 100000000000001@lid
```

`contacts notes edit` and `contacts notes remove` take the person, then the note's id, which `notes list` shows.

Aliases and notes stay in the local store and never reach WhatsApp or the person's phone. An alias applies only in
the account you use now; a note about a person shows in every profile on this computer that sees them. A command
finds a person by your alias unless it matches someone else's name; then it needs the id. `--revision` stops an edit
of a note that changed since you read it.

## Ask WhatsApp about a person

These connect; while `serve` runs, they go through `serve`'s connection.

```sh
wa personal contacts show 100000000000001@lid        # their name, about line and whether they show a photo
wa personal contacts block 100000000000001@lid
wa personal contacts unblock 100000000000001@lid
wa personal contacts lookup < number.txt                # whether this number has WhatsApp, and its id
wa personal contacts sync                                # the phone's address book into the local store
```

For `contacts lookup`, first write the number to `number.txt`, on one line, in international format.

- `contacts show` tells the person nothing. It shows no phone number, so `--hide-phone` changes nothing here. `--offline` answers from the local store alone.
- `contacts lookup` reads the number from stdin, never from the command line, and sends nothing to it. It takes one
  number, at most one every 10 seconds for the profile: many lookups in a row are what WhatsApp bans scrapers for.
- WhatsApp keeps your address book on the phone, so `contacts add`, `remove`, `rename` and `import` are refused.

## Next step

To see what a whole group is doing, and who waits for an answer there, read [groups](groups.md). An AI agent can run
all the commands on this page for you; to connect one, see [the MCP server](mcp.md).
