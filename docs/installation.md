# Installation

Use this page to install `wa` from npm, keep it up to date, or remove it. You need Node.js 22.16 or a newer 22, or
24 or newer.

> ⚠️ **`wa` is an unofficial client of your real WhatsApp account.** WhatsApp may ban an account that uses one, and
> bans accounts that send in bulk or write to strangers. `wa` writes only when a command asks, limits sends and holds
> every write when WhatsApp says to slow down. Do not send in bulk or to strangers ([limits](limits.md)).

## Install

```sh
npm install --global @wirecat/whatsapp-cli
wa --version
```

npm also installs the engine, the program that speaks WhatsApp's protocol, as a separate small package for your
system. It exists for Linux, macOS and Windows, on x64 and arm64. Keep optional packages on: `--omit=optional` leaves
the engine out.

Then link a profile and install the agent skill with `wa personal setup` (see [usage](usage.md)).

## After linking: keep `serve` running

The phone sends your history in parts, over several minutes after the link, and only while WhatsApp is open on it.
Only a running `serve` saves the parts that come after `setup` or `session start` ends. So right after linking, keep
WhatsApp open on the phone and install `serve` as a service:

```sh
wa personal server install                               # writes the unit; starts nothing
systemctl --user enable wa-serve-personal.service        # Linux: start at login; use the name install prints
wa personal server start
```

On macOS, skip the `systemctl` line: `server install` writes a launchd agent instead. Details:
[`serve` as a service](archive.md#as-a-service).

The install itself writes nothing into your agents' folders. To install the agent skill without linking, run
`wa skill install` (`--for claude` or `--for agents` for one folder). To have the install do it, set
`WA_INSTALL_AGENT` to `all`, `claude`, `codex`, `cursor` or `gemini`:
`WA_INSTALL_AGENT=all npm install --global --allow-scripts=@wirecat/whatsapp-cli @wirecat/whatsapp-cli`.

npm 12 blocks unapproved install hooks. If it prints `npm warn install-scripts` and says the package has
`install scripts blocked because they are not covered by allowScripts`, `wa` still installs, but the
`WA_INSTALL_AGENT` hook does not run. The scoped `--allow-scripts=@wirecat/whatsapp-cli` flag above allows that hook
for this global install. Alternatively, leave hooks blocked and run `wa skill install` afterwards.
See [npm's install-script policy](https://docs.npmjs.com/cli/v12/commands/npm-install/#allow-scripts).

## From source

To run `wa` from a checkout of the repository instead:

```sh
git clone https://github.com/WireCatLabs/whatsapp-cli.git
cd whatsapp-cli
pnpm install
pnpm build
pnpm engine:build   # needs Go
node dist/bin/wa.js --version
```

## Where files go

The device keys, the settings and the local store each have their own place:
[where the parts are kept](sessions.md#where-the-parts-are-kept).

## Shell completion

Tab completes commands, options and their values. Where a chat is expected, it offers chats from the local store.
Add one line to your shell's startup file:

```sh
echo 'source <(wa complete zsh)' >> ~/.zshrc      # zsh
echo 'source <(wa complete bash)' >> ~/.bashrc    # bash
wa complete fish | source                         # fish, in config.fish
```

PowerShell: `wa complete powershell | Out-String | Invoke-Expression` in your profile.

A Tab never connects to WhatsApp. With no local store yet, only commands and options complete.

## Upgrade

```sh
wa upgrade            # with the package manager that installed wa
wa upgrade --check    # only say whether a newer version exists; installs nothing
```

`upgrade` asks npm, so `--offline` is refused with exit code `2`. `upgrade --check` runs under `WA_READ_ONLY`;
`upgrade` without it does not.

After an update, `wa upgrade` restarts each running background `serve`, so it does not keep running the old code.
The engine comes as a package of `wa`, so it updates with it. Once a day `wa` says on stderr when a newer version
exists; `WA_NO_UPDATE_CHECK=1`, or `update_check: false` in the settings, turns that off.

From source: `git pull && pnpm install && pnpm build && pnpm engine:build`.

## Uninstall

Removing the command leaves your data. Unlink first, while `wa` is still there:

```sh
wa personal server uninstall         # if you installed the background unit; stop it first
wa personal session end              # unlinks the device on WhatsApp's side and deletes its keys here
npm uninstall -g @wirecat/whatsapp-cli
rm -rf ~/.config/whatsapp-cli ~/.local/share/whatsapp-cli ~/.cache/whatsapp-cli
```

Repeat `session end` for each profile. The local store is shared with other WireCat tools. Delete
`~/.local/share/WireCat/` only if nothing else uses it: it holds the messages every one of them has kept.

## Next

[Link a profile and read your first chats](usage.md#set-up-a-profile).
