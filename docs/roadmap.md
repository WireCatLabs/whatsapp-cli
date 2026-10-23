# Roadmap

This page lists what is planned for `wa` and is not in it yet. Read it before you build a workaround for a missing
feature: it may already be on the way. The order is approximate and can change. To suggest something, open an
[issue on GitHub](https://github.com/WireCatLabs/whatsapp-cli/issues).

## What works today

`wa` links to your account as a device and keeps your chats in a local store: reading, search, sending text and
files, replies, edits, deletes, reactions, polls, groups, channels, people and your own profile. The guide is
[using wa](usage.md), and every command is in the [command reference](commands.md). What `wa` cannot do, and why,
is in [not in wa yet](usage.md#not-in-wa-yet). `wa` is early: some of it has not been checked on real phones yet.

## In progress

- **Bots through WhatsApp's official Cloud API**: a business number answering from `wa`, apart from your personal
  account.
- **A checked archive of your files**: saving every received file into a folder of your choice, with a check that
  each copy is complete.

## Next

- **Files in channels**: saving one from a post, and an album to a channel you run.
- **Old files**: downloading a file that WhatsApp no longer keeps on its servers, from your phone.
- **Business accounts**: WhatsApp Business labels, and another business's profile.
- **A guide command** that walks you through common tasks step by step.

## Later

- **More files in one message** than a photo and a video, and previews on sent videos and WEBP photos.
- **Communities**: listing a community's groups, and adding a group to one or taking it out. A group already
  names its community ([communities](groups.md#communities)).
- **Your reactions in the local store**: a reaction you send is kept on this computer too, as one from your phone is.

What each released version changed is in the [changelog](../CHANGELOG.md).
