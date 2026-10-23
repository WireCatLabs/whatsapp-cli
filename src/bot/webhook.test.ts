import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { decodeDelivery, webhookIntake } from "./webhook.js"

const APP_SECRET = "s3cret-app-made-up"
const VERIFY = "s3cret-verify-made-up"

const delivery = (value: Record<string, unknown>) =>
  Buffer.from(
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "200000000000002", changes: [{ field: "messages", value }] }],
    }),
  )

const metadata = { display_phone_number: "70000000009", phone_number_id: "100000000000001" }

const request = (body: Uint8Array, signature: string | null, url = "http://127.0.0.1:8766/") => ({
  method: "POST",
  url: new URL(url),
  headers: new Headers(signature === null ? {} : { "x-hub-signature-256": signature }),
  body,
})

const sign = (body: Uint8Array, secret = APP_SECRET) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`

describe("Meta's webhook deliveries", () => {
  const intake = webhookIntake({ appSecret: APP_SECRET, verifyToken: VERIFY })

  it("checks the signature over the bytes as sent, not over the JSON written again", () => {
    const body = Buffer.from('{"object":"whatsapp_business_account",  "entry":[]}')
    expect(intake.webhookAuthentic(request(body, sign(body)))).toBe(true)
    expect(intake.webhookAuthentic(request(body, sign(Buffer.from(JSON.stringify(JSON.parse(body.toString()))))))).toBe(
      false,
    )
    expect(intake.webhookAuthentic(request(body, sign(body, "another-secret")))).toBe(false)
    expect(intake.webhookAuthentic(request(body, null))).toBe(false)
  })

  it("refuses every delivery while no app secret is kept", () => {
    const body = delivery({ metadata })
    expect(
      webhookIntake({ appSecret: undefined, verifyToken: VERIFY }).webhookAuthentic(request(body, sign(body))),
    ).toBe(false)
  })

  it("answers the handshake with the challenge only for the kept verify token", () => {
    const at = (token: string) =>
      intake.webhookHandshake({
        ...request(
          new Uint8Array(),
          null,
          `http://127.0.0.1:8766/?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=42`,
        ),
        method: "GET",
      })
    expect(at(VERIFY)).toEqual({ status: 200, body: "42" })
    expect(at("guess")?.status).toBe(403)
  })

  it("reads a text by phone number, a reply, a photo by media id, and a person named by user id", () => {
    const events = decodeDelivery(
      delivery({
        metadata,
        contacts: [{ profile: { name: "Ann" }, wa_id: "70000000001" }],
        messages: [
          { from: "70000000001", id: "wamid.A", timestamp: "1761200000", type: "text", text: { body: "hi" } },
          {
            from: "70000000001",
            id: "wamid.B",
            timestamp: "1761200001",
            type: "image",
            context: { id: "wamid.A" },
            image: { id: "300000000000003", mime_type: "image/jpeg", caption: "look" },
          },
        ],
      }),
    )
    expect(events).toMatchObject([
      {
        event: "message",
        message: { id: "wamid.A", chatId: "70000000001", senderName: "Ann", text: "hi" },
        update: { id: "wamid.A" },
      },
      {
        event: "message",
        message: {
          id: "wamid.B",
          text: "look",
          replyToId: "wamid.A",
          attachments: [{ kind: "photo", mime: "image/jpeg" }],
        },
      },
    ])

    const byUserId = decodeDelivery(
      delivery({
        metadata,
        contacts: [{ profile: { name: "Bea" }, user_id: "900000000000009" }],
        messages: [{ id: "wamid.C", timestamp: "1761200002", type: "text", text: { body: "yo" } }],
      }),
    )
    expect(byUserId[0]).toMatchObject({ message: { chatId: "user:900000000000009" } })
  })

  it("keeps delivery statuses: delivered and read as receipts, sent and failed as notices", () => {
    const events = decodeDelivery(
      delivery({
        metadata,
        statuses: [
          { id: "wamid.D", status: "delivered", timestamp: "1761200003", recipient_id: "70000000001" },
          { id: "wamid.D", status: "failed", timestamp: "1761200004", recipient_id: "70000000001" },
        ],
      }),
    )
    expect(events).toMatchObject([
      { event: "delivery", messageId: "wamid.D", delivery: "delivered", update: { id: "wamid.D:delivered" } },
      { event: "other", type: "status:failed", chatId: "70000000001" },
    ])
  })

  it("refuses a body that is not a WhatsApp delivery", () => {
    expect(() => decodeDelivery(Buffer.from("not json"))).toThrow("not JSON")
    expect(() => decodeDelivery(Buffer.from('{"object":"page"}'))).toThrow("not a WhatsApp delivery")
  })
})

describe("the rest of a delivery", () => {
  it("reads buttons, list replies, documents with names and places, and notes a reaction and another field", () => {
    const events = decodeDelivery(
      Buffer.from(
        JSON.stringify({
          object: "whatsapp_business_account",
          entry: [
            {
              changes: [
                { field: "account_update", value: {} },
                {
                  field: "messages",
                  value: {
                    metadata,
                    messages: [
                      { from: "70000000001", id: "wamid.E", timestamp: "1", type: "button", button: { text: "Yes" } },
                      {
                        from: "70000000001",
                        id: "wamid.F",
                        timestamp: "2",
                        type: "interactive",
                        interactive: { list_reply: { title: "Size M" } },
                      },
                      {
                        from: "70000000001",
                        id: "wamid.G",
                        timestamp: "3",
                        type: "document",
                        document: { id: "300000000000005", filename: "terms.pdf" },
                      },
                      {
                        from: "70000000001",
                        id: "wamid.H",
                        timestamp: "4",
                        type: "location",
                        location: { name: "Shop", address: "Main St 1" },
                      },
                      { from: "70000000001", id: "wamid.I", timestamp: "5", type: "unsupported" },
                      {
                        from: "70000000001",
                        id: "wamid.J",
                        type: "reaction",
                        reaction: { emoji: "👍", message_id: "wamid.E" },
                      },
                      { from: "70000000001", type: "text" },
                    ],
                  },
                },
              ],
            },
          ],
        }),
      ),
    )
    expect(events).toMatchObject([
      { event: "other", type: "account_update", chatId: null },
      { message: { text: "Yes", senderName: null } },
      { message: { text: "Size M" } },
      { message: { text: "", attachments: [{ kind: "file", name: "terms.pdf" }] } },
      { message: { text: "Shop, Main St 1" } },
      { message: { text: "" } },
      { event: "other", type: "reaction", chatId: "70000000001", update: { id: "wamid.J" } },
    ])
    expect(events).toHaveLength(7)
  })

  it("answers nothing to a request that is not a handshake", () => {
    expect(
      webhookIntake({ appSecret: APP_SECRET, verifyToken: VERIFY }).webhookHandshake({
        ...request(new Uint8Array(), null),
        method: "GET",
      }),
    ).toBeUndefined()
    expect(
      webhookIntake({ appSecret: APP_SECRET, verifyToken: undefined }).webhookHandshake({
        ...request(new Uint8Array(), null, "http://127.0.0.1:8766/?hub.mode=subscribe&hub.verify_token=x"),
        method: "GET",
      }),
    ).toMatchObject({ status: 403 })
  })
})
