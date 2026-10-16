# Configuration

Use this page to change how `wa` behaves for one profile or for all of them.

```sh
wa personal config show                     # each setting in force, and where it came from
wa personal config set limit 50             # this profile only
wa config set limit 50 --defaults           # every profile
wa personal config unset limit
```

Settings live in `~/.config/whatsapp-cli/config.json`. They never hold a secret. Every setting and environment
variable is in the [configuration reference](configuration-reference.md).
