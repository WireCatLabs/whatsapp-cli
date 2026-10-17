# Troubleshooting

Use this page when a command fails and its message did not say enough.

## "nothing recorded for profile … yet"

The local store has nothing for this profile. Reads answer only from the store, which `wa <profile> serve` fills
from your phone. Link the profile first with `wa <profile> setup`.

## "this WhatsApp login is in use by serve (pid …)"

WhatsApp allows one connection per linked device, and another `wa` command holds it. Stop that command, or wait for
it to finish. Writes through a running `serve` are planned. `wa <profile> doctor` names the last holder and says
whether its process still runs.

## "the WhatsApp engine is not installed"

`wa` runs WhatsApp's protocol in a separate program. In a source checkout, build it with `pnpm engine:build` (needs
Go), or set `WA_ENGINE` to its path. `wa doctor` says whether it finds the engine, and where it looked.

## "WhatsApp logged this device out"

The device was removed on the phone, or WhatsApp ended it. Run `wa <profile> session end`, then
`wa <profile> session start`.

## "wa setup needs a terminal to link a device"

Linking shows a code to scan or type. Run `setup` in a terminal, or pass `--qr-file <png>` and scan the image it
writes. A device linked before needs no terminal.

## "name a profile"

Every account command names its profile as the first word: `wa personal chats list`. `wa` never picks one for you.

## Something else

Run the command again with `--debug` for the whole failure, and `wa <profile> doctor` for the state of this
installation: the engine, the device keys' file modes and the lock, read without connecting.
Report a problem at the [issue tracker](https://github.com/WireCatLabs/whatsapp-cli/issues/new).
