### Changed — may break callers

- **Built on cli-core 0.714.0** (was 0.681.0) and cli-base 0.125.1 (was 0.106.0). The shared store moves to version
  71, so upgrade the other WireCat CLIs that share it too. WhatsApp has no scheduled messages, so wa still has no
  `messages scheduled` commands. A CRM's client files get their own limits (`crm.<provider>:<account>.files.*` in
  `wa config set`), and `wa --wcat-describe` now tells WireCat Desktop how to remove an account. See the
  [cli-core changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md).
