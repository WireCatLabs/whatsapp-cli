### Changed — may break callers

- **An agent can no longer delete a chat or clear its history over MCP** (cli-core 0.664.0, was 0.662.0). Over MCP
  an `ask` level went ahead without a question, so an agent could remove a whole chat from your WhatsApp account
  without asking. `chats delete` and `chats clear` now stay on the command line, where `ask` still asks first.
- **`store clear --allow-dangerous` is yours alone** (cli-core 0.663.0). Its MCP tool no longer takes
  `allow_dangerous`: an agent previews with `dry_run`, and you run the command in a terminal.
- **Lists without `--limit` show the configured `defaults.limit`** (20 unless set), so `metadata sync` and
  `tags rebuild` drop from 50 to 20 (cli-core 0.663.0).
- **`models chats show|set allowed|ask|denied`** decides whether chat text may go to a model outside this computer
  (cli-core 0.664.0). Under `denied`, `conversations embed` and `conversations links rebuild --analyze` with such a
  model refuse even with `--yes`. Only you can make it less strict.

### Fixed

- **Every time flag reads one grammar** (cli-core 0.663.0): ISO with or without seconds and zone, a date alone,
  `today`, `yesterday`, `30m`, `2h`, `7d`.
- **`tasks scan`, `conversations embed` and `conversations links rebuild` take `yes` over MCP** (cli-core 0.663.0
  and 0.664.0), so an agent is no longer stuck at a preview.
- **`search conversations` answers a long question on a large store**: when the word half runs out of time, the
  meaning half still answers (cli-core 0.664.0).
