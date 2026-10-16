# Troubleshooting

Use this page when a command fails and its message did not say enough.

## "nothing recorded for profile … yet"

The local store has nothing for this profile. Reads answer only from the store, which `wa <profile> serve` fills
from your phone. Link the profile first with `wa <profile> session start`.

## "this WhatsApp login is in use by serve (pid …)"

WhatsApp allows one connection per linked device, and another `wa` command holds it. Stop that command, or wait for
it to finish. Writes through a running `serve` are planned.

## "the WhatsApp engine is not installed"

`wa` runs WhatsApp's protocol in a separate program. In a source checkout, build it with `pnpm engine:build` (needs
Go), or set `WA_ENGINE` to its path.

## "WhatsApp logged this device out"

The device was removed on the phone, or WhatsApp ended it. Run `wa <profile> session end`, then
`wa <profile> session start`.

## "name a profile"

Every account command names its profile as the first word: `wa personal chats list`. `wa` never picks one for you.

## Something else

Run the command again with `--debug` for the whole failure, and `wa doctor` for the state of this installation.
Report a problem at the [issue tracker](https://github.com/WireCatLabs/whatsapp-cli/issues/new).
