# Roadmap

This page lists what is planned for `wa` and is not in it yet. Read it before you build a workaround for a missing
feature: it may already be on the way. The order is approximate and can change. To suggest something, open an
[issue on GitHub](https://github.com/WireCatLabs/whatsapp-cli/issues).

Linking, receiving into the local store, sending text with replies and Markdown, files (sent, received, downloaded,
forwarded), edits, deleting for everyone, reactions, polls, marking read, running a group
([groups](groups.md#run-a-group)) and a person's profile, blocking and number lookup
([people](people.md#ask-whatsapp-about-a-person)), and writes while `serve` runs
([one connection per device](sessions.md#one-connection-per-device)) are in `wa` already ([using wa](usage.md)).

## Next

1. **The first release on npm**, with the engine for Linux, macOS and Windows.
2. **Group members from WhatsApp**: listing who is in a group, who joined and left, and the group photo.
3. **Older history from your phone**, on request: `messages sync <chat>` asking the phone for 50 messages at a time,
   while it is online. `wa` can already ask; `messages sync` still refuses
   ([why](archive.md#why-it-cannot-download-older-history)).
4. **Poll results**: counting the votes as they arrive, and `polls voters`.

What each released version changed is in the [changelog](https://github.com/WireCatLabs/whatsapp-cli/blob/main/CHANGELOG.md).
