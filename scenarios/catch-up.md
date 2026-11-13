---
title: Catch up after a day away
goal: Know what changed, who waits on you and what you promised, without opening every chat.
steps:
  - run: wa review 'date>1d' --transcribe
    why: every message since yesterday in the chats that changed, yours too, with voice notes as text
  - run: wa review --unanswered 4h
    why: questions to you that nobody answered for four hours or more
  - run: wa tasks agenda
    why: tasks due today, replies you owe and replies you are waiting for
look:
  - who asked first and how long ago
  - promises in your own messages that no task holds yet
---

`review` reads what `serve` saved in the local store and marks nothing read. Keep `wa personal server install`
running, so the store has what arrived while you were away.
