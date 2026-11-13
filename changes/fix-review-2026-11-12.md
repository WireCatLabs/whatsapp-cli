### Security

- **A run with moved folders never unlinks a device at WhatsApp.** `session end` there deletes only the run's own
  device keys and says to remove the device on the phone. With only `WA_CONFIG_DIR` or `WA_CACHE_DIR` set (or
  another `HOME` beside your own state folder), the run reads your real linked device: `session end` then answers
  `ended: false` and says why, and `account remove` refuses (`device.owners`) and deletes nothing
  ([sessions](../docs/sessions.md)).
- **A Cloud API media download reaches only the host Meta named for it**, redirects included. 0.39.0 held it to
  `graph.facebook.com`, so a media address on any other host was refused. A fetch handed in passes the host check too.
  `contracts/wirecat.json` lists wa's hosts for WireCat Desktop, and the package ships it.

### Added

- **`wa guide`**: short scenarios (catch up, find what was said, an agent that cannot send), and a "What you can do"
  block on the first help screen, as tg and max have. The repeated "Getting started" and "For agents" sections are
  gone.

### Fixed

- **The pages said linking stops after 45 seconds of quiet.** It stops when the phone says its history is complete,
  or after 5 minutes with nothing new ([sessions](../docs/sessions.md)).
