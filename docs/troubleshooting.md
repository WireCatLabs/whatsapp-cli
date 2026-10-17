# Troubleshooting

Use this page when a command fails and its message did not say enough.

## "nothing recorded for profile … yet"

The local store has nothing for this profile. Reads answer only from the store, which `wa <profile> serve` fills
from your phone. Link the profile first with `wa <profile> session start`.

## "this WhatsApp login is in use by serve (pid …)"

WhatsApp allows one connection per linked device, and another `wa` command holds it. Stop that command, or wait for
it to finish. Writes through a running `serve` are planned.

## "the WhatsApp engine is not installed"

`wa` runs WhatsApp's protocol in a separate program, the engine. npm installs it with `wa` as a small package for
your system, `@wirecat/whatsapp-engine-<system>-<processor>`; the message names the one it looked for. It is missing
when the install skipped optional packages (`--omit=optional`, or `optional=false` in `.npmrc`): reinstall without
that. Engine packages exist for Linux, macOS and Windows on x64 and arm64. In a source checkout, build it with
`pnpm engine:build` (needs Go). Either way, `WA_ENGINE` set to a path runs that engine instead.

## "WhatsApp logged this device out"

The device was removed on the phone, or WhatsApp ended it. Run `wa <profile> session end`, then
`wa <profile> session start`.

## "name a profile"

Every account command names its profile as the first word: `wa personal chats list`. `wa` never picks one for you.

## Something else

Run the command again with `--debug` for the whole failure, and `wa doctor` for the state of this installation.
Report a problem at the [issue tracker](https://github.com/WireCatLabs/whatsapp-cli/issues/new).
