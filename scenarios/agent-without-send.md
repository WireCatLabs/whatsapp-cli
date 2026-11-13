---
title: Give an agent your account, never the send button
goal: Let an agent read and draft from your WhatsApp while every send is refused.
steps:
  - run: wa mcp add claude-code --permission messages.send=deny --allow-writes
    why: add this profile to Claude Code; its server refuses messages send whatever the profile allows, and --allow-writes acknowledges the other tools that may write
  - run: wa sends list
    why: every attempt to send, refused ones too, so you can see what the agent tried
look:
  - refused lines in sends list, and which command asked
---

WhatsApp bans numbers that send in bulk or to strangers, so a send stays your call. For a script, `WA_READ_ONLY=1`
does the same for one run: it reads and syncs, and refuses every send, edit and delete.
