### Added

- **`muted:` in search and stats, from `@wirecat/cli-core` 0.633.0.** `muted:false` leaves out the chats you muted, so
  `stats messages show -- 'date>=30d muted:false'` counts only what the sync still reads. `stats messages responses`
  and `stats messages waiting` take it too.
- **`store import`, from `@wirecat/cli-core` 0.633.0.** Loads made-up chats, people and messages from a file marked synthetic into a test store, such as Desktop's sandbox; it refuses the owner's real store.
