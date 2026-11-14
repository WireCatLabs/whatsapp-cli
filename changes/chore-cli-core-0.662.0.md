### Changed — may break callers

- **A `readonly` level no longer stops a sync** (cli-core 0.662.0, was 0.659.0). Commands that only fetch from
  WhatsApp into the local store (`sync`, `messages sync`, `contacts sync`, `metadata sync`, `store gaps repair`,
  `--sync-first`) run at `readonly`; `deny` still refuses them. Commands that write the owner's files or call another
  service stay blocked by `readonly`. A profile that used `readonly` to stop syncing sets the key to `deny`.
- **Dates in list queries read the computer's zone** (cli-core 0.661.0). `today` and a bare date in `tasks list`,
  `chats list` and the other list queries started in UTC and now start at local midnight, as search does.
- **The MCP tool `messages_photo` takes `attachment`, from 1** (cli-core 0.661.0), as `attachments_show` does. It
  took `index` from 0.
