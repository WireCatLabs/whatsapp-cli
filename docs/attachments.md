# File attachments

Use this page when you need to send a photo or a document, save a file someone sent, hear a voice note as text, or
find a message by the text inside its file. You will learn what `wa` sends, what it keeps, what it can fetch again
later, and what it cannot.

Some words on this page:

- **Sending** delivers a file to a chat. **Downloading** saves the file's bytes on this computer. **Reading**
  (extracting) gets the text inside a saved file. These are separate steps: a downloaded scan is still a picture
  until something reads it.
- **The file's keys** are what WhatsApp needs to fetch a file again: where it is and how to decrypt it. The local
  store keeps them, never the file itself.
- **The search index** keeps the text of each read file next to its message. A search with `content:` finds the
  message by that text.

## What you can do

| Task | Command |
| --- | --- |
| Send a file, a photo, a video or a voice note | `wa personal messages send --file`, `--photo`, `--voice` |
| Save the files of a message, or of a whole chat | `wa personal messages download` |
| Send a stored message again, file included | `wa personal messages forward` |
| Hear a voice note as text | `wa personal messages transcribe` |
| See the files the store knows, and which still need text | `wa personal attachments list` |
| Read text from saved files into the search index | `wa personal attachments extract` |
| Keep text that your agent read from a scan or a photo | `wa personal attachments text set` |
| Find a message by its file | `wa personal search messages 'has:file'`, `'content:…'` |

## What you can send

A message carries one file, and the text becomes its caption. A `--photo` and a video `--file` given together go as
one album: the text is the photo's caption, and the answer is the photo's message. An album holds photos and videos
only, so a document beside a photo is refused. Only the photo's message reaches the local store; the video is in the
chat on WhatsApp. A photo carries the small preview the chat shows before it downloads
(not a WEBP, and not a video yet). Sending needs an explicit command and passes the profile's
[permissions and send limits](permissions.md), as any send does.

| File | Option | What the chat gets |
| --- | --- | --- |
| Documents, archives and any other file | `--file` | A file to download, with its name |
| JPG, PNG, WEBP | `--photo` | A photo; `--file` sends the original as a file instead |
| MP4, M4V, MOV | `--file` | A playable video; `--as-file` sends it as a file to download |
| Ogg Opus recording | `--voice` | A voice note, alone: no text and no other file beside it |

```sh
wa personal messages send "Book club" "the agenda" --file agenda.pdf
wa personal messages send "Book club" "us, last week" --photo photo.jpg
wa personal messages send "Book club" --file trip.mp4 --as-file
wa personal messages send "Book club" --voice note.ogg
```

`--filename` changes the name others see, not the format. `wa` refuses a file from a credential folder or from its
own folders unless you add `--allow-any-file`. WhatsApp has no silent or scheduled delivery and no posting as someone
else, so `wa` has no `--silent`, `--at-time` or `--send-as`.

## What the store keeps

For each photo, video, voice note, audio, document and sticker that reaches the local store, `wa` keeps its name,
size and type, and its keys. The keys never appear in an answer, in JSON, in MCP output or in `watch` events. A place
keeps its coordinates, name and address, and a contact card its name and the card itself, so both can be forwarded.
The card holds a phone number, so it stays with the keys and is never shown. A live location keeps only where it was.

Two kinds of message have no keys, so `wa` cannot save or forward their file:

- **A view-once photo or video.** WhatsApp's own apps neither save nor forward one, so `wa` drops its keys when it
  arrives.
- **A message stored before `wa` handled files.** It names its file, but cannot fetch it.

WhatsApp keeps a file on its servers only for a limited time. When a download finds it gone, `wa` asks your phone
to upload it again, as WhatsApp's own apps do, and fetches the new copy. Your phone must be online and still hold the
file: one deleted from the phone is gone for good.

## Download

The message id `3EB0A1B2C3D4E5F6A7B8` on this page is made up; take a real one from `messages list -v`.

```sh
wa personal messages download "Book club" 3EB0A1B2C3D4E5F6A7B8 --output-dir ~/Downloads --json
wa personal messages download "Book club" --all --output-dir ./book-club
```

A download fetches the file with the keys in the store; the message must be there, so keep `serve` running. A place,
a contact card or a file without keys is named in `skipped` and nothing is saved for it. A file WhatsApp no longer
keeps is asked of your phone again. The phone has about 20 seconds to answer, so with a slow phone give the command a
longer `--timeout`. Each later download asks again, since the store cannot keep the new copy's address. If the phone
no longer has the file, the download ends with exit `6`; ask the sender to send it again. `--all` saves every file of
the chat, newest first; run it again to continue where it stopped. While `serve` runs, a download goes through its
connection ([one connection per device](sessions.md#one-connection-per-device)).

## Forward

```sh
wa personal messages forward "Book club" 3EB0A1B2C3D4E5F6A7B8 --to "Ann Lee"
```

A forward sends the stored text and file again, marked forwarded, or the stored place or contact card. It needs the
message in the store, with keys for its file; otherwise it is refused and nothing is sent, and you forward it on the
phone. A place or a card stored by an older `wa`, a live location and a message with several contact cards are refused
the same way.

A forward reuses the file's keys and does not check that WhatsApp still keeps the file: checking would mean
downloading it first. An old file may reach the recipient as one that will not open. To be sure, download it and send
it as a new file.

## Voice notes as text

```sh
wa personal models audio list                    # the speech models, and which are downloaded
wa personal models audio download parakeet-v3    # once, about 670 MB
wa personal messages transcribe "Book club" 3EB0A1B2C3D4E5F6A7B8 --local
```

WhatsApp has no speech recognition of its own, so `transcribe` always uses a model on this machine; `--local` says
so explicitly, and `--model` picks one. The voice note does not leave your computer. Without a downloaded model the
command stops with exit `6` and names the model to download.

## Read the text of files

`wa` reads text layers itself: plain text, PDF and DOCX text, ODT, ODS, XLSX, PPTX and EPUB. Text inside a picture
or a scan is not read this way.

```sh
wa personal messages download "Book club" 3EB0A1B2C3D4E5F6A7B8 --output-dir ./files --extract
wa personal attachments extract --chat "Book club" --download --output-dir ./files
wa personal attachments list 'is:needs_text' --json
wa personal search messages 'content:"reading list"'
```

`--extract` reads the files this download saved. `attachments extract` reads files already saved, or with
`--download` first saves the ones no download saved yet. `attachments list` shows each file, where it was saved and
whether its text is held, never the text itself.

A scan or a photo is read by your agent, with its own vision tools. The agent then keeps the text so search finds it:

```sh
wa personal attachments text set "Book club" 3EB0A1B2C3D4E5F6A7B8 --text-file scan.txt
```

To read scans in bulk with a model API instead, set `models.ocr.provider` and `models.ocr.model`, then run
`attachments extract --ocr`. Pictures go to that provider only with an explicit `--ocr`.

## Files for a remote agent

An agent on this computer opens the saved path. An agent on another computer gets a file's bytes with
`attachments show`, a bounded piece at a time, as base64 in JSON; `--page` turns one PDF page into a picture, with
the optional `@napi-rs/canvas` package installed where `wa` can load it. See
[from the browser](remote.md) for connecting such an agent.

## Next step

Find a message by its file with `has:file`, `filename:` or `content:` ([search](search.md#files)), and see every
option on the [commands page](commands.md).
