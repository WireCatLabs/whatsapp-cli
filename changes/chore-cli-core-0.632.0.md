### Added

- **`muted:` in search and stats, from `@wirecat/cli-core` 0.632.0.** `muted:false` leaves out the chats you muted, so
  `stats messages show -- 'date>=30d muted:false'` counts only what the sync still reads. `stats messages responses`
  and `stats messages waiting` take it too.
