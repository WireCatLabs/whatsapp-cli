# Search query language

If you use an AI agent with `wa`, you do not need to learn this language: describe what you want in plain words and
the agent writes the query. This page is for people who type searches themselves, and for anyone who wants every
filter: exact operators, every field, presets, date rules and limits.

It is the reference for the queries of `wa personal search messages`, `wa personal search all`,
`wa personal stats messages show` and saved searches. For everyday examples start with [search](search.md).

Terms used on this page:

- **Query**: the text you search for, for example `invoice from:me date:7d`.
- **Field**: a name and a colon that limit one part of the query to one property of a message, such as `from:` (the
  sender) or `date:` (when it was sent). Words without a field search the message text.
- **Operator**: a word or sign that joins conditions, such as `AND`, `OR` and `NOT`.
- **Word forms**: the same word with different endings. `piso` and `pisos` are forms of one word.

The language is shared by every WireCat CLI. It is a strict profile of Apache Lucene's query syntax: words, phrases,
AND/OR/NOT, groups, fields, ranges, bounded wildcards and regular expressions. "Strict" means that anything it does
not support is an error, never silently ignored. The
[full reference](https://github.com/WireCatLabs/cli-core/blob/main/docs/search/query-language.md) (in Russian) has
the generated tables of fields, operators, presets and limits, and executable examples.

## What it can do

| You want | Write |
|---|---|
| messages with all of these words, in any form | `invoice paid` |
| these words together, in this order | `"invoice paid"` |
| one word or another, without a third | `(cafe OR library) NOT loud` |
| only this exact form of a word | `exact:piso`, or `--exact` for every word without a field |
| words that start with something | `invo*` |
| a sender, a chat, a kind of chat | `from:me`, `chat:"Book club"`, `kind:private` |
| a period | `date:7d`, `date:[2026-01-01 TO 2026-02-01}` |
| text that looks like a password, card or phone | `preset:secret`, `preset:card` |
| your own labels | `tag:work` |
| a pattern | `text:/pass(port)?/` |

Words and phrases without a field match word forms. `--exact` selects exact forms for words without a field; an
explicit `text:` still matches forms. The store's language settings decide which forms match
([word forms](archive.md#repair-and-index-maintenance)).

## Operators

| Operator | Example | Meaning |
|---|---|---|
| words | `invoice paid` | both words |
| phrase | `"invoice paid"` | the words in this order |
| `AND`, `&&` | `alpha AND beta` | both |
| `OR`, `\|\|` | `alpha OR beta` | either |
| `NOT`, `!`, `-` | `alpha NOT beta` | the first without the second |
| `+` | `+alpha OR beta` | alpha required, beta optional |
| group | `(alpha OR beta) gamma` | brackets set the order |
| field group | `from:(alice OR bob)` | the field applies to each value |
| range | `date:[2026-01-01 TO 2026-02-01}` | `[ ]` include, `{ }` exclude, `*` open |
| comparison | `date>=7d`, `date:>=7d` | an open range; the colon form is the same |
| wildcard | `invo*`, `te?t` | `*` any characters, `?` one |
| regex | `text:/pass(port)?/` | a bounded Lucene regular expression |

`alpha OR beta gamma` means `(alpha OR beta) AND gamma`; `alpha OR beta AND gamma` means `alpha OR (beta AND gamma)`.
Use brackets for clarity. Lowercase `and`, `or`, `not` are plain words. A query with only `NOT` finds nothing: give a
positive condition, for example `kind:group NOT preset:secret`. Fuzzy `~`, proximity, boosts and intervals are
refused with an error, not ignored. Typos are not corrected: to catch several endings, use a wildcard such as `invo*`.

## Fields

| Field | Finds | Example |
|---|---|---|
| `text` | words of the message (the default field) | `text:invoice` |
| `exact` | the exact word or phrase form | `exact:piso`, `exact:"invoice paid"` |
| `body` | the whole original text, case-sensitive | `body:/.*invoice.*/` |
| `from` | the sender, by name or id; `me` is you | `from:"Alice Synthetic"`, `from:"100000000000001@lid"` |
| `chat` | the chat, by name or id | `chat:"Book club"`, `chat:"120363000000000001@g.us"` |
| `date` | when it was sent | `date:today`, `date:7d`, `date:[2026-01-01 TO 2026-02-01}` |
| `kind` | the kind of chat: `private`, `group`, `channel`, `saved` and the shared rest | `kind:private` |
| `has` | `link`, and the file kinds of the shared language | `has:link` |
| `in` | which accounts: a provider | `in:whatsapp` |
| `preset` | text shaped like a secret or a contact detail | `preset:secret` |
| `tag` | your own local tag on the message, its chat or its sender | `tag:work` |
| `phone` | a phone number found in the text, however it is written | `phone:"<phone>"` |
| `email` | an e-mail address found in the text | `email:"ana@example.com"` |
| `url` | a link found in the text, without tracking parameters | `url:"https://example.com/a"` |
| `domain` | the site of a link or an address found in the text | `domain:example.com` |
| `mentions` | a person, organization or document that a found mention is linked to | `mentions:"person:12"` |

Field names are case-sensitive. An unknown field, value or combination is an error, never an empty answer and never
plain text. A name that the store does not know is not looked up on WhatsApp.

On WhatsApp, `kind:private` is a one-to-one chat, `kind:group` a group, `kind:saved` the chat with yourself and
`kind:channel` a WhatsApp channel. Quote an id: `@` is an operator. The file fields — `content`, `filename`, `mime`,
`size`, and `has:` with `file`, `photo`, `voice` and the other attachment kinds — match the files of messages stored
since `wa` handled files; `content:` needs the file's text read first ([file attachments](attachments.md)).
`topic:` has nothing to match: WhatsApp has no forum topics.

## Mentions

`wa` finds phones, e-mail addresses, links, documents and people's names in stored messages. Use these fields to find
the messages that hold them. The finds themselves are listed by `wa personal mentions list`. To find a phone, first
write the number to `number.txt`, on one line.

```sh
wa personal search messages "phone:\"$(cat number.txt)\""
wa personal search messages 'email:"ana@example.com" OR domain:example.com'
wa personal search messages 'mentions:"person:12"'
```

In the table, `<phone>` stands for the number: these pages show no real one. Quote a value that has `+` or `@`,
since both are operators. A phone is found however it is written: with or without spaces, dashes and the country
code, it is one phone, and a number without `+` is read with the countries of the `phone_countries` setting.
`domain:` treats `docs.example.com` as `example.com`. `mentions:` takes the reference of a person, an organization or
a document, and finds the messages whose mentions you linked to it with
`wa personal mentions confirm`.

## Presets

A preset finds text by its shape. Use it to find a password, a code or a card number that someone sent.

| Preset | A candidate is |
|---|---|
| `password` | a password label followed by a value |
| `code` | a verification-code label and 4–8 digits |
| `api-key` | an API-key label and a value |
| `secret` | a password, secret, token or API-key label and a value |
| `card` | 13–19 digits with optional spaces or hyphens |
| `bank` | an IBAN-shaped value |
| `passport` | a labelled passport value or a Russian 4+6 digit shape |
| `phone` | a plus-prefixed international phone shape |
| `email` | an email-address shape |
| `url` | an HTTP(S) link |
| `contact` | a contact attachment, or an email or phone |
| `location` | a location attachment or a geo: link |

A preset reports a candidate by its shape. It does not verify a password, a card or a document, and it can match
something harmless. Do not delete or forward messages automatically on its word.

## Dates

`--timezone` takes an IANA zone such as `Europe/Madrid`; without it, the computer's zone is used and returned in the
answer. A date without a time is a whole calendar day. An inclusive upper day includes that whole day, an exclusive
one excludes it; a day when clocks change can last 23 or 25 hours.

`date:today` and `date:yesterday` are calendar days. `date:7d` means from 7 days ago until now (also `30m`, `2h`);
`date>=7d` and `date:[30d TO 7d}` work in comparisons and ranges, counted from the moment the query runs. An exact
time is quoted, with seconds and an offset: `date>="2026-01-01T10:00:00+02:00"`.

## Words, wildcards and regular expressions

Text is folded before it is indexed and searched: lower case, without accents. A side effect: some different words
become the same, such as `año` and `ano`. `text:` regular expressions and wildcards are folded the same way.

`text:/pay/` matches the whole word pay, not payment. `body:/pay/` matches only a message whose entire text is pay,
case-sensitive; to find it anywhere use `body:/.*pay.*/`. This is Lucene's regular-expression syntax, without
JavaScript lookaround, backreferences, anchors or flags.

On a large store a short prefix such as `a*` can expand to more than 10,000 words and is refused; lengthen it. Long
queries, deep nesting, large patterns and slow scans are refused with `validation_error`, reason `query.too-large`, not cut short: narrow the chat,
the dates or the pattern.

## The answer

`--json` returns `{ items, page: { limit, has_more }, next?, missing?, meta }`, even when nothing matched. `--jsonl`
streams the items only.

- `items`: the hits, best first (or newest first with `--newest`), each with its `ref` (`msg:…`), `timestamp`,
  `sender_name`, `excerpt` and `matched_in`.
- `meta.accounts`: which accounts were searched.
- `missing`: what the answer could not see, each with the step that fills it. `text` means the word index is still
  being built (step `store.migrate`, `wa personal store migrate`).
- `next`: the steps to run. `page.next` repeats the query for the next page.
- `page.has_more` is about the page, not about whether the phone holds more.

An error carries the position of the problem in the query and a hint.

## Over MCP

When an agent searches through `wa`'s MCP server, `wa_read` (`command: "search messages"`) takes the query as
`query`, and `timezone` for the calendar zone. `chat` takes an id or a stored name; `source`, `newest`, `context` and
`limit` work as the command options do; `saved` runs a saved search. `thread`, `thread_hops`, `thread_messages`,
`thread_bytes` and `thread_within` match the `--thread…` options. The answer has the same fields as `--json`.
`wa_read` (`command: "stats messages show"`) counts the same queries. `wa personal mcp --no-record`, or `record` set to
`false`, keeps the server's calls out of the query history ([MCP](mcp.md)).

## Next

- [Search](search.md): everyday searches, saved searches and counting.
- [The local store](archive.md): what the store holds, and why a search may not see a message.
