# Troubleshooting

Use this page when a command fails and its message did not say enough.

## "nothing recorded for profile … yet"

The local store has nothing for this profile. Reads answer only from the store, which `wa <profile> serve` fills
from your phone. Linking is not available yet; see the [roadmap](roadmap.md).

## "name a profile"

Every account command names its profile as the first word: `wa personal chats list`. `wa` never picks one for you.

## Something else

Run the command again with `--debug` for the whole failure, and `wa doctor` for the state of this installation.
Report a problem at the [issue tracker](https://github.com/WireCatLabs/whatsapp-cli/issues/new).
