// Stands in for the Go engine in tests of the JSON-lines client. `--mode` picks the behaviour; the engine's own
// flags (--store, --holder, --link) follow and are ignored, except that --holder is echoed in a refusal.
import { writeFileSync } from "node:fs"
import { createInterface } from "node:readline"

const args = process.argv.slice(2)
const mode = args[args.indexOf("--mode") + 1]
const holder = args[args.indexOf("--holder") + 1]
const say = (value) => process.stdout.write(`${JSON.stringify(value)}\n`)
const self = "100000000000001@lid"

if (mode === "unlinked-store") {
  say({ refused: { code: "authentication_error", message: "this profile is not linked to WhatsApp" } })
  process.exit(1)
}
if (mode === "refuse") {
  say({ refused: { code: "provider_unavailable", message: `this WhatsApp login is in use by ${holder}` } })
  process.exit(1)
}
say({
  hello: { protocol: mode === "old" ? 1 : 3, engine: "stub", version: "0", self: mode === "unlinked" ? null : self },
})
process.stderr.write("stub engine diagnostic\n")

createInterface({ input: process.stdin }).on("line", (line) => {
  const { id, op, ...fields } = JSON.parse(line)
  switch (op) {
    case "connect":
      say({ event: "connection", state: "connected" })
      say({ id, ok: null })
      break
    case "me":
      say({ id, ok: { jid: self, name: "Owner" } })
      break
    case "send":
      if (fields.text === "garbled") say({ event: "message", message: { id: 1 } })
      say({
        id,
        ok: {
          id: fields.sendId,
          chat: fields.chat,
          sender: self,
          senderName: "Owner",
          fromMe: true,
          timestamp: "2026-09-01T10:00:00.000Z",
          editedAt: null,
          text: fields.text,
          replyTo: null,
        },
      })
      break
    case "edit":
      say({
        id,
        ok: {
          id: fields.message,
          chat: fields.chat,
          sender: self,
          senderName: "Owner",
          fromMe: fields.fromMe,
          timestamp: "2026-09-01T10:05:00.000Z",
          editedAt: "2026-09-01T10:05:00.000Z",
          text: fields.text,
          replyTo: null,
        },
      })
      break
    case "react":
      if (fields.emoji !== null) say({ id, error: { code: "validation_error", message: "the stub only removes" } })
      else say({ id, ok: null })
      break
    case "sendMedia":
    case "forward":
      say({
        id,
        ok: {
          id: fields.sendId,
          chat: fields.chat,
          sender: self,
          senderName: "Owner",
          fromMe: true,
          timestamp: "2026-09-01T10:00:00.000Z",
          editedAt: null,
          text: fields.text,
          replyTo: null,
          attachments: [
            fields.attachment ?? {
              kind: fields.file.kind,
              ref: { media: "image", directPath: "/v/stub", mediaKey: "AAAA" },
            },
          ],
        },
      })
      break
    case "download":
      writeFileSync(fields.path, `synthetic ${fields.attachment.kind} bytes`, { mode: 0o600, flag: "wx" })
      say({ id, ok: null })
      break
    case "link":
      say({ login: "pair", code: "ABCD-EFGH" })
      say({ id, ok: { jid: self, name: "Owner" } })
      break
    case "chat":
      if (fields.jid === "crash@stub") process.exit(3)
      say({ id, error: { code: "not_found", message: "WhatsApp has no such chat" } })
      break
    case "directory":
      say({ id, ok: [] })
      break
    case "close":
      say({ id, ok: null })
      process.exit(0)
      break
    default:
      say({ id, error: { code: "validation_error", message: "the engine has no such request" } })
  }
})
