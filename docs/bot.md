# A WhatsApp Business number as a bot

`wa <profile> bot …` speaks for a WhatsApp Business number on Meta's
[Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started), not for your
own WhatsApp. It never links a device and never starts the engine that `wa <profile> chats …` uses. It talks to
`graph.facebook.com` over HTTPS with a token you keep in the system keychain.

**Never register your own phone number, or any number whose WhatsApp you still use on a phone.** Registering a
number on the Cloud API deletes that number's WhatsApp account. Use Meta's free test number, or a number that has
no WhatsApp account.

## What you can do

| Command | What it does |
|---|---|
| `bot auth set` | Check an access token with Meta, then keep it. Add `--secret app-secret` or `--secret verify-token` for the webhook's two secrets. |
| `bot me` | The business number the token and `phone_number_id` name. |
| `bot messages send <chat> <text>` | Send text, a reply (`--reply-to`), or a file (`--file`, `--photo`, `--voice`). There is no silent message, edit or delete. |
| `bot templates list` | The message templates of your WhatsApp Business Account. |
| `bot templates send <chat> <name> [language]` | Send an approved template; `--payload` fills its placeholders. `hello_world` is pre-approved on the test number. |
| `bot watch --public-url <url>` | Receive messages and delivery receipts as Meta sends them, keep them in the local store and print them. |
| `bot webhooks set <url>` | Point this number's webhook at an address; `bot webhooks list` and `delete` read and remove it. |
| `bot media download <id> --output <file>` | Save a file someone sent, by the media id `bot watch --jsonl` printed. |
| `bot api <operation>` | Every Cloud API operation `wa` keeps, generated from Meta's OpenAPI file. |
| `bot mcp` | The bot's commands as MCP tools for an agent. |

A chat is the person's phone number in digits, such as `70000000001`. Meta names some people only by a
business-scoped user id; `bot watch` shows that chat as `user:<id>`, and you send to it the same way.

**The 24-hour rule.** You can send free text only within 24 hours of the person's last message to the number. After
that, WhatsApp delivers only a template. When the local store holds the person's last message, `wa` refuses a late
free-form send before it leaves and tells you to send a template. When it does not, Meta refuses it.

## Set up the test number

You do these steps once, in Meta's App Dashboard. `wa` cannot do them for you.

1. On [Meta for Developers](https://developers.facebook.com/apps/), create an app with the use case "Connect with
   customers through WhatsApp". Meta adds a test WhatsApp Business Account and a test number.
2. Under WhatsApp → API Setup, add up to five recipient numbers and confirm each with the code WhatsApp sends to it.
   The test number sends only to these.
3. In Business Settings, create a system user with the `business_management`, `whatsapp_business_messaging` and
   `whatsapp_business_management` permissions, and generate a token for it that does not expire. Note the app
   secret under App settings → Basic.
4. Copy the phone number ID and the WhatsApp Business Account ID from WhatsApp → API Setup into the profile:

   ```sh
   wa cloudtest config set --bot phone_number_id 100000000000001
   wa cloudtest config set --bot waba_id 200000000000002
   ```

   `graph_version` is `v23.0` unless you set another.
5. Keep the token and the two secrets. Each command asks at a hidden prompt; nothing appears on screen or in the
   shell history:

   ```sh
   wa cloudtest bot auth set
   wa cloudtest bot auth set --secret app-secret
   wa cloudtest bot auth set --secret verify-token
   ```

   The verify token is any string you choose. You type the same string in the App Dashboard in step 6.
6. Open a tunnel and start the receiver ([receive messages](#receive-messages)). Then, in WhatsApp → Configuration,
   enter the tunnel's address as the Callback URL with the same verify token, and subscribe to the `messages` field.

Check it: `wa cloudtest bot me` names the test number, and
`wa cloudtest bot templates send <your verified number> hello_world` arrives on your phone.

## Receive messages

Meta never lets a client ask for new messages. It sends each one to an HTTPS address you give it, and retries for up
to seven days until that address answers. `bot watch --public-url` is that address's receiver: it listens on
`127.0.0.1:8766` on your computer, and your tunnel publishes it.

```sh
wa cloudtest bot watch --public-url https://<name>.ts.net:8443
```

- It answers Meta's subscription check with the verify token you kept.
- It refuses any delivery whose `X-Hub-Signature-256` does not match your app secret.
- It answers Meta only after the message is in the local store, so a crash or a full disk loses nothing: Meta sends
  it again.
- `--port` changes the local port. The receiver needs its own port and its own public address beside `mcp --http`.

The tunnel must keep one address: Meta checks each new address again. Use Tailscale Funnel or a named Cloudflare
Tunnel, set up as in [ChatGPT, Codex or Claude in the browser](remote.md#webhook-receiver-for-a-bot). A Cloudflare
Quick Tunnel changes its address every time it starts.

Meta keeps one callback address per app, set in the App Dashboard, and sends template and account events only there.
`bot webhooks set <url>` adds an address for this number alone; set it to the same tunnel address.

## Permissions

A bot profile has its own permissions under `bot` in the configuration. `bot api` operations that cannot be undone,
such as `register-phone-number` and `delete-template`, ask before they run. The recipient list and the hourly limit
apply to bot sends as to personal ones ([permissions](permissions.md)).
