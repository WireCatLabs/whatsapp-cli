# ChatGPT, Codex or Claude in the browser

Use this page when you want an AI app that runs in the browser or on your phone, for example ChatGPT, Codex web or
Claude, to read and answer your WhatsApp messages. Such an app cannot start `wa` on your computer, so you give it an
internet address instead. At the end, the app is connected to `wa` through a private HTTPS address, it can do only
what your profile permits, and you know how to stop it or take its access back.

Terms used on this page:

- **MCP** (Model Context Protocol) is the standard way an AI app calls outside tools. `wa personal mcp` is the MCP
  server that comes with `wa`; the [MCP server guide](mcp.md) covers apps on your own computer.
- **Remote connection** means the app connects from its own servers, over the internet, to the address you give it.
  `wa personal mcp --http` serves the same tools over HTTP on `127.0.0.1` for this.
- **HTTPS tunnel** is a program that gives a port on your computer a public HTTPS address. This page uses
  [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel); Cloudflare Tunnel also works. You do not
  need to buy a domain for Funnel.
- **Public URL** is that address, for example `https://laptop.tail1234.ts.net`. You pass it to `wa` as
  `--public-url`, and the app gets it with `/mcp` at the end.
- **Access code** is a one-time code that `wa` prints in your terminal. The app's login page asks for it, so only a
  person who sees that terminal can connect an app.

```text
ChatGPT / Claude ──internet──▶ Tailscale Funnel ──▶ wa personal mcp --http (login) ──▶ WhatsApp
```

## What you can do

| Task | Where |
|---|---|
| Connect a browser or phone AI app to WhatsApp | [Start the tunnel and server](#start-the-tunnel-and-server), then [connect the app](#connect-the-app) |
| Run wa beside tg or max | [Run several servers together](#run-several-servers-together) |
| Use Cloudflare instead of Tailscale | [Alternative: Cloudflare Tunnel](#alternative-cloudflare-tunnel) |
| Allow less for one server run | [Permissions for this server process](#permissions-for-this-server-process) |
| Stop the server or log every app out | [Stop or revoke access](#stop-or-revoke-access) |

## Before you start

- **Whoever logs in reads your WhatsApp.** The login needs the access code from your terminal. Never put a tunnel in
  front of `wa personal mcp` without `--http`: that mode has no login at all.
- **Profile permissions decide what the app may change.** `deny` and `readonly` block writes; `ask` and `allow` let
  a requested MCP write go through without a form on the server. The app's own approval is separate and depends on
  its settings. The recipient list and the hourly limit still apply
  ([what an agent may do](mcp.md#what-an-agent-may-do), [permissions](permissions.md)).
- **The server shares the device's one connection with `serve`.** Reads from the local store work while `serve`
  runs. Unlike the terminal and `wa personal mcp`, the HTTP server does not go through `serve`: a send, an edit or a
  reaction from the app is refused until `serve` stops, and `serve` cannot start while the server holds a connection
  ([one connection, shared with `serve`](mcp.md#one-connection-shared-with-serve)).
- **The computer that runs `wa` must stay on.** To use it from a phone, or from a laptop with nothing installed, run
  all of this on a small server that is always on, and link `wa` there (`wa personal setup --agent none`). That is
  one more linked device on your phone.
- **Who can add a remote connector:**

| App | Plans | Documentation |
|---|---|---|
| ChatGPT | Plus, Pro, Business, Enterprise, Education — in developer mode | [developer mode](https://developers.openai.com/api/docs/guides/custom-mcp-server) |
| Claude | any; one custom connector on the free plan | [custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) |
| Gemini | only adults in the US with a personal Google account | [connected apps](https://support.google.com/gemini/answer/17209137?hl=en) |

The setup steps for each operating system have not all been tried on that system. If a step does not work,
[open an issue](https://github.com/WireCatLabs/whatsapp-cli/issues).

## Start the tunnel and server

Install `wa` and link a profile first ([installation](installation.md), [linking](sessions.md)). Use the same
operating system user and profile for setup and for the MCP server. Put a profile before the command when needed:
`wa work mcp`. Tailscale is a separate installation.

Install [Tailscale](https://tailscale.com/download), sign in, and enable
[Funnel](https://tailscale.com/docs/features/tailscale-funnel): MagicDNS, HTTPS certificates and Funnel permission
must be enabled in your tailnet (your Tailscale network). The first Funnel command can print an approval link.

Keep two terminal windows open. The first runs the tunnel. Copy the HTTPS origin it prints into the second window
when asked. The origin is the address without `/mcp` or any other path. Keep an explicit public port such as `:8443`
in it.

The server listens on `127.0.0.1:8765` and prints a one-time access code. It never needs administrator rights; only
the tunnel may need them. What the app may do is the profile's own `permissions`; set them before you start
([permissions for this server process](#permissions-for-this-server-process)).

### Windows (PowerShell)

Install the Tailscale Windows app and sign in from its tray menu. Open a new PowerShell window after installing
Node.js, `wa` and Tailscale, so it sees the updated PATH. Use `.cmd` for npm commands to avoid PowerShell
execution-policy errors.

First window: run PowerShell as Administrator for Funnel. The call operator `&` handles the space in the default
installation path; change the path if you installed Tailscale elsewhere.

```powershell
& "$env:ProgramFiles\Tailscale\tailscale.exe" funnel 8765
```

Second window: normal PowerShell, as the user who linked `wa`:

```powershell
$mcpPublicUrl = Read-Host 'Paste the HTTPS origin printed by Funnel (no /mcp)'
wa.cmd personal mcp --http --port 8765 --public-url $mcpPublicUrl
```

Run both processes in Windows itself. WSL is a separate environment: a Windows tunnel that points at the Windows
loopback address may not reach a server inside WSL.

### macOS (Terminal)

Install and sign in to the Tailscale app. Its CLI comes with the app; use this path when `tailscale` is not on PATH
([Tailscale CLI guide](https://tailscale.com/docs/reference/tailscale-cli?tab=macos)). First Terminal window:

```sh
TAILSCALE_BE_CLI=1 /Applications/Tailscale.app/Contents/MacOS/Tailscale funnel 8765
```

Second Terminal window, as the same user who ran `wa personal setup`. This works in both zsh and bash:

```sh
printf 'Paste the HTTPS origin printed by Funnel (no /mcp): '
IFS= read -r mcpPublicUrl
wa personal mcp --http --port 8765 --public-url "$mcpPublicUrl"
```

### Linux (Terminal)

Install Tailscale with the [Linux instructions](https://tailscale.com/download/linux), then sign in with
`sudo tailscale up`. First terminal window:

```sh
sudo tailscale funnel 8765
```

Second terminal window: your normal user, without `sudo`, so `wa` finds the device linked by `wa personal setup`:

```sh
printf 'Paste the HTTPS origin printed by Funnel (no /mcp): '
IFS= read -r mcpPublicUrl
wa personal mcp --http --port 8765 --public-url "$mcpPublicUrl"
```

## Run several servers together

Each server needs its own local port and its own public HTTPS address. For example, keep `tg` on local `8765` and
public `443`; run a second Funnel command with `--https=8443 8766`, and run `wa` with `--port 8766`. Use the second
Funnel origin, with `:8443`, for `wa`'s `--public-url` and for its connector address ending in `/mcp`. Use your
system's Tailscale command from above for the second Funnel command. Funnel supports public ports `443`, `8443` and
`10000` ([Funnel command reference](https://tailscale.com/docs/reference/tailscale-cli/funnel)).

## Alternative: Cloudflare Tunnel

If you already use Cloudflare, point its tunnel at the same local MCP server. A fixed hostname needs a Cloudflare
account and a domain on Cloudflare. Follow the
[named tunnel setup](https://developers.cloudflare.com/tunnel/get-started/): install `cloudflared` for your system,
create the tunnel in the dashboard, start its connector and add a public hostname such as `mcp.example.com`. Set its
local service to `http://127.0.0.1:8765`, and run MCP on that same computer.

Start the server in a second terminal:

```sh
wa personal mcp --http --port 8765 --public-url https://mcp.example.com
```

Add `https://mcp.example.com/mcp` to your AI app with OAuth and DCR, as described in
[connect the app](#connect-the-app). `--public-url` is the public origin used for login, not the local address and not
the `/mcp` path. The tunnel does not change profile permissions. Check the JSON at
`https://mcp.example.com/.well-known/oauth-protected-resource/mcp`, then login and the tool list.

**A temporary Quick Tunnel does not work.** `cloudflared tunnel --url http://127.0.0.1:8765` gives a random
`trycloudflare.com` address with no account or domain, but
[Quick Tunnels do not support SSE](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) (server-sent
events, the way the HTTP MCP server streams answers). Choose Funnel or a named tunnel.

## Connect the app

The address for the app is your tunnel origin with `/mcp` at the end, for example
`https://<device>.<network>.ts.net/mcp`. Add it as a remote MCP connector:

- **ChatGPT or Codex web:** open **Plugins**, choose **+ Add custom MCP server**, and create a plugin with the
  `/mcp` address and OAuth, as the [OpenAI connection guide](https://developers.openai.com/plugins/quickstart)
  describes. Connect with the access code, install the plugin, and turn it on in your chat (or mention it with `@`).
  Choose dynamic client registration (DCR) when offered; the server supports DCR and the S256 code challenge that
  the [OpenAI OAuth requirements](https://developers.openai.com/plugins/build/auth) ask for.
- **Claude:** add a custom connector with this address, as described in
  [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
  In the connector settings you can also set each tool to always allowed, needs approval, or blocked.

The three tools work without MCP prompts, resources or elicitation (questions the server asks the app), so apps
that support only tools can use them.

The app opens the `wa` login page. Check the line that says where the login goes: it must be the app you are
connecting, such as `chatgpt.com` or `claude.ai`. Then type the access code from your terminal. The code expires
after ten minutes; a new code is printed after each login. Five wrong codes stop logins for 30 seconds; after
that a new code is printed.

The app stays logged in as long as it uses the connection at least once every 30 days; it renews its login by
itself. After 30 days without use, it asks for a new code.

## Permissions for this server process

The server cannot see whether the app asked you before a call. If the app always allows a tool, the next call can go
through without a new question.

The profile's `permissions` decide what the app may do. Repeat `--permission key=level` to narrow them for this
server process only: `--permission messages.send=readonly` stops sending. It never loosens: an override that would
give more than the profile — `readonly` to `allow`, a `deny` to anything — stops the server at startup with
`validation_error` naming the key. An override leaves the saved configuration, the recipient list and the hourly
limit as they are. To let the app send from a read-only profile, change the profile first:
`wa personal config set permissions.messages.send allow`. Permission keys are on the [permissions](permissions.md)
page.

## Stop or revoke access

Press Ctrl-C in both terminal windows to stop the server and this tunnel. Start them again with the same commands;
app logins survive a normal server restart. Stopping the server also lets go of the device's connection, so `serve`
can start again.

If you started Funnel with `--bg`, Ctrl-C does not stop that background route. Check `tailscale funnel status` and
turn off only its public port, for example `tailscale funnel --https=443 off`. Do not use `funnel reset` when
another server uses Funnel: it clears all routes.

Taking access back from apps is separate from stopping a process. To log out every app for a profile:

```sh
wa personal mcp --revoke --json
```

Those apps must log in again with a new code. This does not unlink the device from WhatsApp.

## If it does not work

- **The app says it cannot connect:** open `https://<device>.<network>.ts.net/.well-known/oauth-protected-resource/mcp`
  in a browser. It must show a short JSON. If it does not, Funnel is not running, is not enabled in your Tailscale
  network, or points at another port.
- **The login page says "Too many wrong codes":** after five wrong codes it waits 30 seconds, then the terminal shows a
  new code. If you did not type them, someone found your address: stop the server, and think about a new device name
  in Tailscale.
- **The app connects, but there are no tools:** `wa personal mcp doctor` checks that the MCP server starts and lists
  its tools. It does not check the link to WhatsApp or the tunnel; `wa personal doctor` reads the device's state.
- **Reading works, writing fails:** the HTTP server does not go through `serve`, so a write is refused while `serve`
  runs; the error names it. Otherwise
  check the profile's permissions and any `--permission` overrides: `deny` and `readonly` block writes whatever the
  app approves.
- **You need a record of the calls:** `wa personal runs list` shows them. Successful calls appear only when recording
  is on; failed calls are kept by default, unless recording was turned off with `"record": false` or `--no-record`
  ([diagnostics](diagnostics.md)).
