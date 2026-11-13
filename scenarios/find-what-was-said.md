---
title: Find what someone said
goal: Get back a message, a file or a voice note when you remember only a word or the person.
steps:
  - run: wa search all invoice
    why: messages and notes in one search, best match first; add --offline to stay on this computer
  - run: wa contacts events Anna
    why: everything one person wrote or was mentioned in, newest first, from the store
  - run: wa messages context Team 1234
    why: the message a hit points to, with what came either side of it
look:
  - the chat and the time of each hit
  - the ref of the hit you want, which the next commands take
---

A search finds only what the store holds: the history the phone pushed at linking, and what `serve` saved since.
`wa personal messages sync <chat>` asks the phone for one chat's older messages, page by page; the phone answers only
recent history.
