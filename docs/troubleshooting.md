# Troubleshooting

Use this page when a command fails and its message did not say enough. Find the message you see, or its exit code,
and the page tells you what it means and what to do next.

A few words this page uses:

- The **exit code** is the number a command returns when it ends: `0` means it completed, and any other number names
  the kind of failure. Scripts and AI agents read it; the table below maps each one to its section.
- **`wa <profile> doctor`** checks the installation without connecting to WhatsApp. Run it first.

In `--json` output an error that ends the command is one line on stderr, `{"error":{"code":"…","reason":"…",
"message":"…"}}`, and the exit code says the same as the `code`. Every code is also in the
[exit code reference](commands.md#exit-codes).

## By exit code

| Code | Name | What it usually means | Where |
|---|---|---|---|
| `1` | `internal_error` | a fault in `wa` itself | [something else](#something-else) |
| `2` | `validation_error` | a value or option `wa` does not accept, a name that fits several chats, no profile named, or a command WhatsApp cannot run | [name a profile](#name-a-profile), [not in wa yet](usage.md#not-in-wa-yet) |
| `3` | `configuration_error` | the config file is wrong, or the store is newer than this `wa` | [the store and other versions](archive.md#the-store-and-other-versions) |
| `4` | `authentication_error` | the profile is not linked, or WhatsApp logged the device out | [logged out](#whatsapp-logged-this-device-out) |
| `5` | `permission_error` | the profile's `permissions` refused it, or WhatsApp banned or restricted the account | [permissions](permissions.md), [writes](limits.md#writes) |
| `6` | `not_found` | no such chat, message or person in the local store; nothing stored yet | [nothing recorded](#nothing-recorded-for-profile--yet) |
| `7` | `confirmation_required` | the chat is not on the recipient list, or the change asks first and nobody could answer | [questions in scripts](permissions.md#questions-in-scripts) |
| `8` | `rate_limited` | the hourly send limit, or WhatsApp asked the account to slow down | [writes](limits.md#writes) |
| `9` | `timeout` | the phone did not answer in time, or `--timeout` ended the command | [older history](archive.md#older-history-from-your-phone) |
| `10` | `network_error` | `wa` could not connect to WhatsApp in time | [something else](#something-else) |
| `11` | `provider_error` | WhatsApp refused the request, or the engine could not do it | [something else](#something-else) |
| `12` | `provider_unavailable` | another command holds the device, the engine stopped, or WhatsApp no longer accepts this version | [login in use](#this-whatsapp-login-is-in-use-by-serve-pid-) |
| `14` | `outcome_unknown` | the connection broke after a write left: it may have happened | [safe retries](cli-contract.md#previews-and-safe-retries) |
| `130` | `cancelled` | you pressed Ctrl+C, or answered no to a question | |

## First: `wa doctor`

```sh
wa personal doctor
wa personal doctor --online
```

`doctor` connects to nothing. It shows whether the engine is installed, whether the device keys exist with private
file modes, and who last held the device's one connection. `--online` also connects once and reads the account; it
sends nothing ([what `doctor` shows](diagnostics.md#check-the-installation-wa-doctor)).

## "nothing recorded for profile … yet"

The local store has nothing for this profile. Reads answer only from the store, which `wa <profile> serve` fills
from your phone. Link the profile first with `wa <profile> setup`.

## "this WhatsApp login is in use by serve (pid …)"

WhatsApp allows one connection per linked device, and another `wa` command holds it. Stop that command, or wait for
it to finish. When the holder is `serve`, commands normally go through it instead; you see this on Windows, where
commands do not go through `serve`, or while `serve` is still starting
([one connection per device](sessions.md#one-connection-per-device)). `wa <profile> doctor` names the last holder and
says whether its process still runs.

## "the WhatsApp engine is not installed"

`wa` runs WhatsApp's protocol in a separate program, the engine. npm installs it with `wa` as a small package for
your system, `@wirecat/whatsapp-engine-<system>-<processor>`; the message names the one it looked for. It is missing
when the install skipped optional packages (`--omit=optional`, or `optional=false` in `.npmrc`): reinstall without
that. Engine packages exist for Linux, macOS and Windows on x64 and arm64. In a source checkout, build it with
`pnpm engine:build` (needs Go). Either way, `WA_ENGINE` set to a path runs that engine instead. `wa doctor` says
whether it finds the engine, and where it looked.

## "WhatsApp logged this device out"

The device was removed on the phone, or WhatsApp ended it. Run `wa <profile> session end`, then
`wa <profile> session start`.

## `serve` stopped by itself

`wa <profile> server logs` says why. A network drop does not stop it: it connects again and goes on saving. It stops
when the engine dies (exit 12), and when WhatsApp ends the connection: logged out (exit 4), banned (exit 5), another
connection took the login over or WhatsApp no longer accepts this version (exit 12). Its unit starts it again 30
seconds later, except after exit 4 or 5: for 4, run `wa <profile> session start`, then `wa <profile> server start`;
for 5, see the phone, and start it again once the ban ends. After a takeover, stop the other connection first. On
macOS the unit does not restart it after any failure, since launchd cannot leave out one exit code.

## "wa setup needs a terminal to link a device"

Linking shows a code to scan or type. Run `setup` in a terminal, or pass `--qr-file <png>` and scan the image it
writes. A device linked before needs no terminal.

## "name a profile"

Every account command names its profile as the first word: `wa personal chats list`. `wa` never picks one for you.

## Something else

Run the command again with `--debug` for the whole failure, and `wa <profile> doctor` for the state of this
installation: the engine, the device keys' file modes and the lock, read without connecting.
Report a problem at the [issue tracker](https://github.com/WireCatLabs/whatsapp-cli/issues/new).
