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
  say({
    refused: {
      code: "provider_unavailable",
      message: `this WhatsApp login is in use by ${holder}`,
      reason: "device.in-use",
    },
  })
  process.exit(1)
}
say({
  hello: { protocol: mode === "old" ? 1 : 26, engine: "stub", version: "0", self: mode === "unlinked" ? null : self },
})
process.stderr.write("stub engine diagnostic\n")

createInterface({ input: process.stdin }).on("line", (line) => {
  const { id, op, ...fields } = JSON.parse(line)
  switch (op) {
    case "connect":
      say({ event: "connection", state: "connected" })
      say({ id, ok: null })
      if (mode === "dies") setTimeout(() => process.exit(3), 200)
      break
    case "me":
      say({ id, ok: { jid: self, name: "Owner" } })
      break
    case "send":
      if (fields.text === "crash before the answer") process.exit(3)
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
    case "sendAlbum":
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
              kind: (fields.file ?? fields.files[0]).kind,
              ref: { media: "image", directPath: "/v/stub", mediaKey: "AAAA" },
            },
          ],
        },
      })
      break
    case "pin":
      if (fields.duration !== undefined && ![86400, 604800, 2592000].includes(fields.duration))
        say({ id, error: { code: "validation_error", message: "a pin lasts 24 hours, 7 days or 30 days" } })
      else say({ id, ok: null })
      break
    case "unpin":
      say({ id, ok: null })
      break
    // The Go engine asks the phone about an expired file by the message's key, so the stub refuses a download without one.
    case "download":
      if (!fields.chat || !fields.message) {
        say({ id, error: { code: "validation_error", message: "a message id is needed" } })
        break
      }
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
    // One message just before the anchor, written as the Go engine writes an `older` answer; an offline phone times out.
    case "older":
      if (fields.chat === "offline@stub") {
        say({ id, error: { code: "timeout", message: "the phone did not send older messages in time" } })
        break
      }
      process.stdout.write(
        `{"id":${id},"ok":{"messages":[{"id":"3EB0OLDER${fields.count}${fields.fromMe ? "M" : "T"}","chat":"${fields.chat}",` +
          `"sender":"100000000000002@lid","senderName":null,"fromMe":false,"timestamp":"2026-08-31T23:59:59.000Z",` +
          `"editedAt":null,"text":"synthetic older text","replyTo":null}],"more":true}}\n`,
      )
      break
    case "directory":
      say({ id, ok: [] })
      break
    // The same lines engine/cmd/wa-engine's wire-shape tests expect the Go engine to write.
    case "group":
      process.stdout.write(
        `{"id":${id},"ok":{"chat":{"jid":"120363000000000001@g.us","name":"Book club","kind":"group","unread":null,` +
          `"lastMessageAt":null,"participants":1},"description":"synthetic description",` +
          `"link":"https://chat.whatsapp.com/AAAAAAAAAAAAAAAAAAAAAA","addMode":"admin_add","approval":true,` +
          `"announce":true,"locked":false,"ephemeral":0,"members":[{"jid":"100000000000001@lid","name":null,"role":"owner"}]}}\n`,
      )
      break
    case "requests":
      process.stdout.write(
        `{"id":${id},"ok":[{"jid":"100000000000002@lid","name":"Ann Lee","requestedAt":"2026-09-01T10:00:00.000Z"},` +
          `{"jid":"100000000000003@lid","name":null,"requestedAt":null}]}\n`,
      )
      break
    case "profile":
      process.stdout.write(
        `{"id":${id},"ok":{"jid":"100000000000002@lid","name":"Ann Lee","about":"synthetic about","business":false,` +
          `"verified":false,"contact":true,"photo":null}}\n`,
      )
      break
    case "privacy":
    case "setPrivacy":
      if (fields.privacy?.some((change) => change.value === "crash@stub")) process.exit(3)
      if (op === "setPrivacy" && !fields.privacy?.every((change) => change.name && change.value)) {
        say({ id, error: { code: "validation_error", message: "no privacy setting to change" } })
        break
      }
      process.stdout.write(
        `{"id":${id},"ok":{"groupadd":"contacts","last":"none","online":"match_last_seen","calladd":"known",` +
          `"profile":"contact_blacklist","status":"","readreceipts":"none"}}\n`,
      )
      break
    case "mute":
      if (fields.jid === "nokeys@stub")
        say({
          id,
          error: {
            code: "provider_unavailable",
            message: "WhatsApp has not sent the settings keys yet; keep serve running a few minutes and try again",
            reason: "settings.keys-missing",
          },
        })
      else if (fields.until === undefined) say({ id, error: { code: "validation_error", message: "no until" } })
      else say({ id, ok: null })
      break
    case "updateProfile":
      say({ id, ok: { jid: self, name: fields.pushName ?? "Owner" } })
      break
    case "deleteChat":
    case "clearChat":
    case "deleteForMe":
    case "archiveChat":
    case "unarchiveChat":
    case "markChatUnread":
      if (fields.chat === "crash@stub") process.exit(3)
      if (!fields.chat || !fields.message || !fields.timestamp || typeof fields.fromMe !== "boolean")
        say({ id, error: { code: "validation_error", message: "no last message" } })
      else say({ id, ok: null })
      break
    case "star":
      if (fields.chat === "crash@stub") process.exit(3)
      if (!fields.chat || !fields.message || typeof fields.starred !== "boolean")
        say({ id, error: { code: "validation_error", message: "no message or no starred" } })
      else say({ id, ok: null })
      break
    case "pinChat":
    case "unpinChat":
      if (!fields.jid) say({ id, error: { code: "validation_error", message: "no chat" } })
      else say({ id, ok: null })
      break
    case "participants":
      process.stdout.write(`{"id":${id},"ok":{"notAdded":[]}}\n`)
      break
    case "close":
      say({ id, ok: null })
      process.exit(0)
      break
    default:
      say({ id, error: { code: "validation_error", message: "the engine has no such request" } })
  }
})
