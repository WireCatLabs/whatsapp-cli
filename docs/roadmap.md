# Roadmap

This page lists what is planned for `wa` and is not in it yet. Read it before you build a workaround for a missing
feature: it may already be on the way. The order is approximate and can change. To suggest something, open an
[issue on GitHub](https://github.com/WireCatLabs/whatsapp-cli/issues).

Linking, receiving into the local store, sending text with replies and Markdown, files (sent, received, downloaded,
forwarded) and a photo and a video as one album, edits, deleting for you or for everyone, reactions, polls and their
votes, message pins and stars, marking read, muting, archiving, pinning, deleting and clearing a chat, running a group
and listing its members ([groups](groups.md#run-a-group)), the community a group is in, a person's profile, blocking and
number lookup ([people](people.md#ask-whatsapp-about-a-person)), your own name, about line and photo, the account's
privacy
([usage](usage.md#privacy)), older history asked of your phone ([the local
store](archive.md#older-history-from-your-phone)), following, reading and posting to channels
([channels](usage.md#channels)), and writes while `serve` runs ([one connection per
device](sessions.md#one-connection-per-device)) are in `wa` already ([using wa](usage.md)).
What is not: [not in wa yet](usage.md#not-in-wa-yet).

## Next

- **Removing a group's photo**: `chats update --photo` sets one; taking it away is done on the phone for now.
- **Files in channels**: sending a photo or a file to a channel you run, and saving one from a post.

## Later

- **More files in one message** than a photo and a video, and previews on sent videos and WEBP photos.
- **Communities**: listing a community's groups, and adding a group to one or taking it out. A group already
  names its community ([communities](groups.md#communities)).

What each released version changed is in the [changelog](../CHANGELOG.md).
