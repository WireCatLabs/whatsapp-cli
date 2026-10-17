# Linking, devices and profiles

Read this page when you connect `wa` to your WhatsApp account for the first time, when you add a second account, or
when `wa` says a profile is not linked. At the end you know how to link, how to check who a profile is, how to
unlink, and where `wa` keeps what it needs to stay linked.

First, the words this page uses:

- **Linked device**: `wa` on this computer, as WhatsApp sees it. You link it from the phone, the way you link
  WhatsApp Web, and the phone lists it under Settings → Linked devices. Its keys live in one file on this computer.
  Whoever has that file can read and send as you, so treat it like your password.
- **History push**: the copy of your recent chats the phone sends once, seconds after linking. WhatsApp has no way to
  ask for older messages later, so `wa` keeps what arrives.
- **Profile**: a name for one linked device on this computer, with its own keys and settings. Every command that
  uses an account names it, so you pick one name at setup (`wa personal setup`) and use it from then on
  ([profiles](#profiles)).

## First run

`wa personal setup` guides a first run in five steps: this computer's folders, the link, the account, five chats
from the local store, and the agent skill (`--agent codex`, `cursor`, `claude`, `gemini`, `all` or `none`). Allow
about five minutes, most of it the history push. Run it in a terminal. A profile linked before is checked without
linking again, and nothing is asked. `wa personal session start` is the command for the link alone.

## Linking

```sh
wa personal session start          # a QR code in the terminal
wa personal session start phone    # your number, typed in the terminal, then a code to type on the phone
```

**QR:** scan the code in WhatsApp on the phone: Settings → Linked devices → Link a device. The code is renewed while
you wait.

**Phone:** type your number in international format when `wa` asks. `wa` shows an eight-character pairing code;
on the phone, open Settings → Linked devices → Link a device → Link with phone number instead, and type it. The
number goes to the engine on its input, never as an argument, so other programs on this computer cannot see it in
the list of processes.

Right after either, the phone pushes your history. `session start` keeps the same connection open, saves what
arrives into the local store, and stops when the phone has been quiet for 45 seconds, or at Ctrl+C. Then keep
receiving with `wa personal server install` ([the local store](archive.md)).

### When an agent runs the link

Your AI agent can start the link for you, but it has no terminal to draw the QR code in. `--qr-file` writes the code
as a picture (PNG) instead, and the agent shows it to you to scan:

```sh
wa personal setup --qr-file login.png --agent claude --json
wa personal session start --qr-file login.png
```

The file is replaced when the code is renewed, and removed when linking ends, whether it worked or not. A pairing
code is for you to run in your own terminal: an agent never asks you for your phone number or a code in the chat.

## Check and unlink

```sh
wa personal account show     # who this profile is linked as; the phone number shows only its last four digits
wa account list              # every profile on this computer, and the account each is linked as
wa personal session end      # unlink the device on WhatsApp's side, and delete its keys here
```

`wa personal session end` removes the device **on WhatsApp's side too**: it disappears from the phone's list of linked
devices. It leaves the local store as it is.

## One connection per device

WhatsApp allows one connection for each linked device; a second one makes WhatsApp drop the first. So one `wa`
command at a time may connect a profile. `serve`, `watch` and every command that connects take the device's lock
first; another command for the same profile is refused and names the holder:

```text
this WhatsApp login is in use by serve (pid 4242)
```

`serve` is the exception. While it runs, a command for the same profile that would connect does not take the lock:
it runs inside `serve`, on `serve`'s connection. It reaches `serve` through a socket next to `serve`'s lock
(`<state>/serve/<profile>.sock`, mode `0600`, so only your own user can open it). This covers sends, edits,
deletions, reactions, marking read, downloads, group and people commands, `watch`, `doctor --online` and the MCP
server `wa <profile> mcp`. The send guard and the profile's permissions still apply. A command run this way never
asks: a write at permission level `ask` needs `--yes` (`--allow-dangerous` for a deletion), or it is refused and
says so.

- **Not through `serve`:** linking (`session start`, `setup`) and `mcp --http`. `--offline` and `--dry-run` runs do
  not connect at all.
- **`serve` is starting or does not answer:** the command fails. It never opens a second connection.
- **`wa` was upgraded and `serve` not restarted:** the command runs inside the older `serve`, with its code. When the
  two speak different relay versions, the command is refused and says to restart `serve`. `wa upgrade` restarts
  running servers itself; otherwise use `wa <profile> server restart`.
- **Windows:** not built yet. While `serve` runs, a command that connects is refused as above, with exit code 12.

With no `serve` running, each command connects on its own. While one of them holds the device, or `wa personal mcp`,
which keeps its connection for two minutes after a call, `serve` cannot start. Reads never connect, so they work
beside any of them.

## How long a link lives

Until it is ended: by `wa personal session end`, from the phone's list of linked devices, or by WhatsApp itself. The
phone must come online now and then, or WhatsApp logs its linked devices out. When the device was removed, every
command that connects says so with exit code `4`; link again with `wa personal session start`
([WhatsApp logged this device out](troubleshooting.md#whatsapp-logged-this-device-out)).

## Profiles

A profile is a separate linked device: its own keys, settings, recipients and runs. It is named by **the first
word**, not by an option:

```sh
wa personal chats list     # profile "personal"
wa work chats list         # profile "work"
export WA_PROFILE=work     # the same for the whole shell session
```

**The first word is the profile when it is not a command.** A profile therefore cannot be called `chats`,
`messages` or any other command word. Names are letters, digits, dot, dash and underscore, starting with a letter or
a digit.

The order, first match wins: the first word, `WA_PROFILE`, `default_profile` in the config file. With none of them,
a command that uses an account stops with exit code `2` and lists the profiles on this computer. `wa` never picks
one, not even the only one. Commands that use no account run without a profile: `--help`, `--version`, `commands`,
`skill show`, `account list` and `config show`.

**`WA_PROFILE_LOCK` pins a process to one profile.** Set it where an agent runs, and a first word or `WA_PROFILE`
naming any other profile is refused (exit code `5`). Without it, an agent could pick a profile with fewer limits.

What each profile is for: [profiles](profiles.md).

## Where the parts are kept

| What | Where |
|---|---|
| the device keys | `~/.local/share/whatsapp-cli/profiles/<profile>/private.db`, readable by your user only |
| who holds the one connection | `private.db.lock` beside it |
| chats and messages | the WireCat store every WireCat CLI shares, `~/.local/share/WireCat/wirecat.db` |
| settings | `~/.config/whatsapp-cli/config.json`; never a secret |

`WA_CONFIG_DIR`, `WA_STATE_DIR` and `WA_CACHE_DIR` move the three folders ([configuration
reference](configuration-reference.md)).

## Next

- [Read your first chats](usage.md)
- [Settings, and the order they resolve in](configuration.md)
- [What reaches the disk, and what never does](security.md)
