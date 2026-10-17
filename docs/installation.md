# Installation

Use this page to install `wa` from npm. You need Node.js 22.16 or newer.

```sh
npm install --global @wirecat/whatsapp-cli
wa --version
```

npm also installs the engine, the program that speaks WhatsApp's protocol, as a separate small package for your
system. It exists for Linux, macOS and Windows, on x64 and arm64. Keep optional packages on: `--omit=optional` leaves
the engine out.

`wa` is not published to npm yet; until it is, build it from the repository:

```sh
git clone https://github.com/WireCatLabs/whatsapp-cli.git
cd whatsapp-cli
pnpm install
pnpm build
pnpm engine:build   # needs Go
node dist/bin/wa.js --version
```

Then link a profile and install the agent skill with `wa personal setup` (see [usage](usage.md)).
