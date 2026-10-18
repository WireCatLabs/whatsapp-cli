# Roadmap

This page lists what is planned for `wa` and is not in it yet. Read it before you build a workaround for a missing
feature: it may already be on the way. The order is approximate and can change. To suggest something, open an
[issue on GitHub](https://github.com/WireCatLabs/whatsapp-cli/issues).

Linking, receiving into the local store, sending text with replies and Markdown, files (sent, received, downloaded,
forwarded), edits, deleting for everyone, reactions, polls and their votes, marking read, running a group and
listing its members ([groups](groups.md#run-a-group)), a person's profile, blocking and number lookup
([people](people.md#ask-whatsapp-about-a-person)), the account's privacy ([usage](usage.md#privacy)), older history asked of your phone
([the local store](archive.md#older-history-from-your-phone)), and writes while `serve` runs
([one connection per device](sessions.md#one-connection-per-device)) are in `wa` already ([using wa](usage.md)).
What is not: [not in wa yet](usage.md#not-in-wa-yet).

## Next

- **Removing a group's photo**: `chats update --photo` sets one; taking it away is done on the phone for now.

## Later

- **Several files in one message**, and thumbnails on sent photos and videos.
- **Files WhatsApp no longer keeps**: asking the sender's phone to upload an expired file again.
- **Communities.**

What each released version changed is in the [changelog](../CHANGELOG.md).
