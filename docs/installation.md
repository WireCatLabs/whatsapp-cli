# Installation

Use this page to install `wa` from npm. You need Node.js 22.16 or newer.

```sh
npm install --global @wirecat/whatsapp-cli
wa --version
```

`wa` is not published to npm yet; until it is, build it from the repository:

```sh
git clone https://github.com/WireCatLabs/whatsapp-cli.git
cd whatsapp-cli
pnpm install
pnpm build
node dist/bin/wa.js --version
```

Linking to WhatsApp is not available yet; see the [roadmap](roadmap.md).
