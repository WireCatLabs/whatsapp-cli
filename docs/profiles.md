# Profiles

A **profile** is a name for one linked device of `wa` on this computer: one WhatsApp account, with its own keys and
its own settings. `wa` never picks one for you: a command that uses an account names its profile as the first word
(`wa personal chats list`) or through `WA_PROFILE`, every time, even with only one account.

Read this page when you want a second account, or want your AI agent to have fewer rights than you. At the end you
know how to pick a profile for a command and how to give it its own settings.

## What profiles let you do

| You want to | How |
|---|---|
| Use two WhatsApp accounts on one computer | Link once per profile: `wa work session start` |
| Give your agent fewer rights than you have | A profile with its own [permissions](permissions.md) |
| Keep an agent on that one profile | `WA_PROFILE_LOCK` ([profiles in linking](sessions.md#profiles)) |
| See every profile on this computer | `wa account list` |

## Choose a profile

Put the profile name before the command:

```sh
wa work config show
```

`wa account list` shows every profile on this computer and the account each is linked as; `wa work session end`
unlinks the profile `work`.

A setting under `profiles.work` in the config file applies to that profile; values under `defaults` apply when it
has no value of its own. The rules for profile names, and the order in which `wa` picks a profile, are in
[profiles in linking](sessions.md#profiles).

Each profile is a device of its own on the phone's list of linked devices, with its own one connection
([one connection per device](sessions.md#one-connection-per-device)).

Profiles are not separate operating-system users: an agent with unrestricted file access can still reach other data
on that computer.

## Settings and access

- [Configuration](configuration.md) explains saved values, environment variables and options.
- [Permissions](permissions.md) controls what each profile may do.
- [Linking, devices and profiles](sessions.md) explains how to link a profile.
