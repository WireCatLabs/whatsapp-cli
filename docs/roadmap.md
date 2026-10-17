# Roadmap

This page lists what is planned for `wa` and is not in it yet. Read it before you build a workaround for a missing
feature: it may already be on the way. The order is approximate and can change. To suggest something, open an
[issue on GitHub](https://github.com/WireCatLabs/whatsapp-cli/issues).

Linking, receiving into the local store, sending text with replies, edits, deleting for everyone, reactions and
marking read are in `wa` already ([using wa](usage.md)).

## Next

1. **The first release on npm**, with the engine for Linux, macOS and Windows.
2. **Writes while `serve` runs.** Today a send for a profile is refused while `serve` holds its one connection.
3. **Files**: photos, documents and voice messages, sent and received; then forwarding.
4. **Groups and contacts**: members, admins and invite links; looking a person up.
5. **Older history from your phone**, on request.

What each released version changed is in the [changelog](https://github.com/WireCatLabs/whatsapp-cli/blob/main/CHANGELOG.md).
