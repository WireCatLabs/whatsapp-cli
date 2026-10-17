# Search

You need to find something that was written: a message, an agreement, an address from months ago. This page shows
how to search everything `wa` has saved on this computer — WhatsApp messages, and the notes that
[memo](https://github.com/WireCatLabs/cli-memo) imported.

After reading it you can find messages by words, people, chats and dates, save a search and run it again, count
matches, and tell a real "not found" from a gap in the saved history. Searching never connects to WhatsApp and
marks nothing read.

Terms used on this page:

- **Local store** (also called the archive): the database on this computer where `wa` keeps every message the phone
  pushed and `serve` received ([the local store](archive.md)). Every search reads only this.
- **Query**: what you search for. It can be plain words, or words with fields such as `from:` and `date:`. Your AI
  agent writes queries for you; the full language is in the [query language reference](query-language.md).
- **Coverage**: what a search could see — how many chats and messages were saved.

## When you remember the question rather than its wording

Ask your agent to find messages answering a question and show the supporting messages. For example: "Find when the
Helix daily export runs in the project chat, and check whether the schedule changed." The agent can use archive
discovery to find partial word matches and direct replies, then inspect those messages before answering. It does not
download a model.

For command-line control:

```sh
wa personal search messages 'What time does Helix export run? chat:120363000000000001@g.us' --discover --json
```

Chat, sender and date filters still apply. In MCP, pass `discover: true` to the message-search tool. Each item's
`discovery` says how much of the query it matched: `missing_terms` names unmatched terms, and `parent` links a reply
to its matching parent. A high score is not answer confidence: a question, proposal or old decision can rank first.
Read the evidence and check [what the store holds](archive.md#how-much-is-kept) before concluding that a fact is
absent.

Without `--discover`, the usual strict search remains. Boolean syntax, quoted phrases, wildcards, `--exact` and
`--newest` keep strict behavior.

## What you can do

Every search is under one group of commands, `wa personal search`. When you don't know where something was written,
start with `search all`.

| Task | Command |
|---|---|
| Search messages and notes in one answer | `wa personal search all '<query>'` |
| Search WhatsApp messages only | `wa personal search messages '<query>'` |
| Search mail | memo's: install @wirecat/cli-memo, then `memo search mail '<query>'` |
| Search notes written in memo or imported from a folder | `wa personal search notes '<query>'` |
| Count matches by chat, sender, day or hour | `wa personal stats messages show '<query>'` |
| Save a search and run it again later | `wa personal searches create`, `wa personal search messages --saved <name>` |

```sh
wa personal search all 'lease agreement'          # messages and notes, best match first
```

```sh
wa personal search all 'lease' --only notes       # notes only
```

```sh
wa personal search messages 'lease chat:"Book club"'  # WhatsApp messages only, never mail
```

```sh
wa personal search notes 'budget source:internal'  # only notes written in memo
```

`search all` says what each hit is — a message (`msg:…`) or a note (`note:…`). `wa` never searches mail:
`memo search mail` does. When a field does not apply — `chat:`/`from:` for notes — `search all` skips that resource
and explains why. Mail and notes reach the store through memo: `memo sync --mail` and `memo import`. Without them,
`search all` searches messages only.

The rest of this page is about searching messages, `wa personal search messages`.

## Try a focused search

Start with a phrase and one chat.

**Your request:**

> Find the message saying "invoice paid" in Book club. Show the match and any gaps in the history.

**Command:**

```sh
wa personal search messages '"invoice paid" chat:"Book club"' --json
```

**Example agent answer:**

> **One matching message in saved history.**
>
> | Person | Message |
> | --- | --- |
> | Alice Synthetic | Invoice paid yesterday. |
>
> The store holds this chat only since the device was linked. I can open this message and its surrounding
> conversation.

An empty result is not proof that the message never existed. The examples on this page are fictional.

## What the store can answer

Search sees only what the store holds: the history the phone pushed when the device was linked, and what `serve`
received while it ran. WhatsApp has no way to ask for older messages, so `wa` cannot fill a gap by fetching. Keep the
store current with `wa personal server install` ([keeping it current](archive.md#keeping-it-current-serve)).

Every search says what it searched. With `--json`, `coverage` carries the number of `messages` and `chats` searched.
Put the query in single quotes, so the shell leaves its quotes and brackets alone. The names below are examples;
use your own chats and people.

## Words and phrases

```sh
wa personal search messages invoice
```

```sh
wa personal search messages '"invoice paid"'     # words together
```

```sh
wa personal search messages 'cafe OR library'
```

```sh
wa personal search messages '(cafe OR library) NOT loud'
```

```sh
wa personal search messages 'invoic*'            # every word that starts with "invoic"
```

Words next to each other must all be in the message. Search includes word forms, according to the store's language
settings: `piso` can find `pisos`. Quotes keep words together and also allow word forms. Use `exact:piso` or add
`--exact` for words without an explicit field. An explicit `text:` still matches forms. Case and accents are ignored.
Typos are not corrected automatically.

## People and chats

```sh
wa personal search messages 'from:"Alice Synthetic" invoice'
```

```sh
wa personal search messages 'from:("Alice Synthetic" OR "Bob Synthetic") library'
```

```sh
wa personal search messages 'from:me date:7d'    # what you wrote this week
```

```sh
wa personal search messages 'chat:"Book club" library'
```

```sh
wa personal search messages 'chat:120363000000000001@g.us library'  # a chat by its id
```

```sh
wa personal search messages 'passport kind:private'  # one-to-one chats only
```

On WhatsApp, `kind:private` is a one-to-one chat, `kind:group` a group, `kind:saved` the chat with yourself and
`kind:channel` a WhatsApp channel. A person's id is usually `…@lid`, a group's `…@g.us`. To search every account in
the store, add `--source all`.

## Dates

```sh
wa personal search messages 'date:today'
```

```sh
wa personal search messages 'library date:yesterday'
```

```sh
wa personal search messages 'invoice date:7d'    # from 7 days ago until now; also 30m, 2h
```

```sh
wa personal search messages 'invoice date:[2026-01-01 TO 2026-02-01}' --timezone Europe/Madrid
```

`today`, `yesterday` and calendar dates are days in your computer's time zone; `--timezone` picks another. In a range,
`[` and `]` include that day, `{` and `}` exclude it.

## Links, phones and addresses

```sh
wa personal search messages 'has:link AND "github.com"'  # a link to a site
```

```sh
wa personal search messages 'domain:docs.google.com'
```

A link counts when it is in the text. To find a phone, an e-mail address, a link's site or a confirmed person
mentioned in the text, use `phone:`, `email:`, `url:`, `domain:` and `mentions:`; see
[Mentions](query-language.md#mentions).

## Files

```sh
wa personal search messages 'has:file chat:"Book club"'
wa personal search messages 'filename:agenda.pdf'
wa personal search messages 'mime:"application/pdf"'
wa personal search messages 'content:"reading list"'
```

The store keeps each file's name, size and type, so `has:file`, `filename:` and `mime:` work on every message stored
since `wa` handled files. `content:` finds the text inside a file once that text is read
([reading the text of files](attachments.md#read-the-text-of-files)).

## Passwords, codes and cards

```sh
wa personal search messages 'preset:secret kind:saved'  # something that looks like a password or token
```

```sh
wa personal search messages 'preset:card'
```

A preset finds messages that *look like* a password, a login code, an API key, a card or IBAN number, a passport, a
phone, an email or a link. It checks the shape only: it does not prove that a password works or a card is real. The
full list is in the [query language](query-language.md#presets).

## Tags

```sh
wa personal tags add work --chat "Book club"
```

```sh
wa personal tags add work --contact 100000000000001@lid
```

```sh
wa personal tags list tag:work type:chat
```

```sh
wa personal search messages 'tag:work invoice'
```

```sh
wa personal search messages 'invoice NOT tag:work'
```

```sh
wa personal tags remove work --chat "Book club"
```

A tag is your own label on a chat, a person, one message (`--message <id> --chat <chat>`) or a task
(`--task <id-or-key>`). It is kept in the local store only and is never sent to WhatsApp. `tag:work` finds messages
tagged `work`, messages in a chat tagged `work` and messages from a person tagged `work`. A tag is 1–32 letters a–z,
digits and hyphens.

## Saved searches and history

```sh
wa personal searches create meetings 'library OR cafe' --chat "Book club"
```

```sh
wa personal search messages --saved meetings
```

```sh
wa personal search messages --saved meetings 'date:today'  # extra words are added with AND
```

```sh
wa personal stats messages show --saved meetings --by day
```

```sh
wa personal searches list
```

```sh
wa personal searches history --limit 10
```

```sh
wa personal search messages --saved 42           # a row of the history, by its number
```

`searches create` saves a query with its options and runs nothing; an existing name needs `--replace`. Options you
type with `--saved` replace the saved ones. The saved text is read again on every run, so `date:7d` always means the
last 7 days. `searches show` prints one, `searches delete` removes one.

Every search and count that succeeds is written to the history: the query and its options, never the messages it
found. The newest 1,000 runs are kept. `--no-record` keeps one run out of it. `searches clear` empties the history
and keeps the saved searches. This history is separate from the run records of `wa personal runs`.

Saved searches and the history live in the store that every WireCat CLI shares: `tg` and `max` see the same ones,
and `delete` or `clear` in one changes the others. Tags stay with their account.

## Counting: `stats messages show`

```sh
wa personal stats messages show invoice               # how many in each chat
```

```sh
wa personal stats messages show 'date:7d' --by sender
```

```sh
wa personal stats messages show 'from:me' --by day --timezone Europe/Madrid
```

```sh
wa personal stats messages show --by hour             # every stored message
```

`stats messages show` counts the messages `search messages` would find with the same query, each one once.
`--by chat` (the default) and `--by sender` put the largest first; `--by day` and `--by hour` go in order. The
numbers count what the store holds, so for a chat held only since linking they are a lower bound.

## Messages around a hit

`--newest` orders by time instead of by relevance, and `--context 2` shows two messages before and after each one
found (2 in the terminal, 0 otherwise by default).

`--thread` shows the reply chain and the replies around each hit instead of its neighbours in time. It follows the
reply links saved in the store, and in `messages context` it replaces the neighbours in time too. Defaults are 8 links
from the hit, 50 messages, 65,536 bytes and one day either side; change them with `--thread-hops`,
`--thread-messages`, `--thread-bytes` and `--thread-within`. Without saved links it falls back to neighbours in time.

## Results as JSON

At a terminal `wa` prints a readable transcript. `--json` returns one object with the messages and what was searched;
`--jsonl` streams the messages only, one per line. The fields of the answer are in the
[query language reference](query-language.md#the-answer).

## When nothing is found

An empty answer means "not in the store", not "never sent". Check what is stored with `wa personal store status`.
With `--json` the answer says which chats were searched, even when nothing matched. If `wa` asks for
`wa personal store migrate`, the word index is still being built; searches without words (`date:today`,
`kind:group`) already work.

A message from before the device was linked, which the phone did not push, is not in the store and cannot be
fetched. Look for it on the phone.

## Next

- [Query language](query-language.md): every field, operator, limit and the JSON answer.
- [The local store](archive.md): what it holds, and how to keep it current.
- [How search works](https://wirecat.dev/en/docs/search-architecture): the technical page — the word index, the
  conversation graph and how results are ranked.
