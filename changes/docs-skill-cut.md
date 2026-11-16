### Changed — may break callers

- **The agent skill is shorter.** `SKILL.md` keeps what an agent needs on every turn (the profile rule, answering
  from the chats, the limits on sending, output and exit codes) in about 8 KB instead of 29 KB, and links the rest in
  `skills/whatsapp-cli/references/`: search, history, sending, the connection, groups, the local store, commands and
  setup. No rule was dropped. An agent that reads the skill pays about 5,000 fewer tokens on every turn.
