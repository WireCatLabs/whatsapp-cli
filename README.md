# wa — WhatsApp from the command line

`wa` reads and sends messages in your **personal WhatsApp account** from a terminal, a script or an AI agent. It
links to your account as a device, the way WhatsApp Web does, and keeps your chats in a local store you can search
offline.

> **Not usable yet.** This is the foundation: the shared commands, the local store and the checks are in place, but
> `wa` cannot link to WhatsApp yet. Follow the [roadmap](docs/roadmap.md).

`wa` is part of the [WireCat](https://wirecat.dev) family, beside [tg](https://github.com/WireCatLabs/tg-cli) for
Telegram and [max](https://github.com/WireCatLabs/max-cli) for MAX. All three share their commands, their store and
their agent tools, so what you learn in one works in the others.

## How it differs from tg and max

- **History comes from your phone.** WhatsApp has no way to ask for old messages. Your phone sends them when `wa`
  links, and `wa serve` keeps receiving new ones. Every read answers from the local store and never connects.
- **One connection per device.** While `wa serve` runs, nothing else may connect for the same profile.
- **Unofficial.** WhatsApp's terms forbid unofficial clients, and WhatsApp may ban an account that uses one. `wa`
  never sends in bulk or to strangers; you decide what to send.

## Documentation

- [Commands](docs/commands.md)
- [Security](docs/security.md)
- [Changelog](CHANGELOG.md)

## License

[Apache-2.0](LICENSE).
