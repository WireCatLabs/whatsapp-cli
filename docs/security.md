# Security

Read this before you link `wa` to your account. It says what `wa` keeps on your computer and what can go wrong.

What every WireCat tool has in common — the local store, the send guard, what an agent may do over MCP, other people's
text on your screen, how to report a vulnerability — is on the
[shared security page](https://wirecat.dev/en/docs/security). This page covers what only WhatsApp adds.

## What `wa` keeps

- **The linked device's keys**, in `~/.local/share/whatsapp-cli/profiles/<profile>/private.db` (on Windows,
  `%LOCALAPPDATA%\whatsapp-cli\Data\profiles\<profile>\private.db`). Anyone who copies this file can read and
  send as you until you remove the device on your phone (Settings → Linked devices). Only your user can read it.
- **Your chats and messages**, in the WireCat store shared with tg and max.
- **Settings**, in `~/.config/whatsapp-cli/`. Never a secret.

## What can go wrong

- **WhatsApp may ban the account.** Its terms forbid unofficial clients. Bans reported by other projects followed
  bulk sends, messages to strangers or status posts; `wa` does none of these unless you ask.
- **A lost laptop.** Remove the device on your phone; the keys on the laptop stop working.
