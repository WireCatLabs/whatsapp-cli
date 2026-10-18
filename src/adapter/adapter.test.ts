import type { MessageEvent } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { describe, expect, it } from "vitest"
import { EngineError, type WaMessage } from "../engine/contract.js"
import { fakeEngine, whatsAppIds } from "../testing/fake-engine.js"
import { whatsAppAdapter } from "./adapter.js"
import { toChat } from "./map.js"

const seed = contractSeed({ ids: whatsAppIds })

const incoming = (fields: Partial<WaMessage> = {}): WaMessage => ({
  id: "3EB0000000000000000ABC",
  chat: seed.busy,
  sender: seed.person,
  senderName: "Ann Lee",
  fromMe: false,
  timestamp: "2026-09-01T10:00:00.000Z",
  editedAt: null,
  text: "synthetic text",
  replyTo: null,
  ...fields,
})

const watching = async (pushes: (engine: ReturnType<typeof fakeEngine>) => void) => {
  const engine = fakeEngine(seed)
  const adapter = whatsAppAdapter(engine)
  const controller = new AbortController()
  const events: MessageEvent[] = []
  const done = adapter.watch(
    (event) => events.push(event),
    controller.signal,
    () => {
      pushes(engine)
      controller.abort()
    },
  )
  return { done, events }
}

describe("whatsAppAdapter", () => {
  it("refuses a send option WhatsApp cannot honour, before the engine sees it", async () => {
    const engine = fakeEngine(seed)
    const sending = whatsAppAdapter(engine).send(seed.dialog, "hi", { sendId: "3EB0AA", spoiler: true })
    await expect(sending).rejects.toMatchObject({
      code: "validation_error",
      message: expect.stringContaining("spoiler"),
    })
    expect(engine.sent).toEqual([])
  })

  it("never repeats the typed name or a chat id in a refusal, since errors reach run records", async () => {
    const adapter = whatsAppAdapter(fakeEngine(seed))
    for (const query of ["Synthetic Secret Name", seed.twins]) {
      const refusal = adapter.resolve(query).then(
        () => "",
        (failure: Error) => failure.message,
      )
      const message = await refusal
      expect(message).not.toBe("")
      expect(message).not.toContain(query)
      for (const chat of seed.chats) expect(message).not.toContain(chat.id)
    }
  })

  it("passes a reply on to the engine", async () => {
    const engine = fakeEngine(seed)
    const sent = await whatsAppAdapter(engine).send(seed.dialog, "yes", { sendId: "3EB0AB", replyTo: "3EB0AA" })
    expect(sent.message.replyToId).toBe("3EB0AA")
  })

  it("turns an engine refusal into the same code from the closed list", async () => {
    const engine = fakeEngine(seed)
    engine.me = async () => {
      throw new EngineError("rate_limited", "slow down")
    }
    await expect(whatsAppAdapter(engine).me()).rejects.toMatchObject({ code: "rate_limited", message: "slow down" })
  })

  it("hands new, edited and deleted messages to watch untitled, for cli-core to title from the store", async () => {
    const { done, events } = await watching((engine) => {
      engine.push({ event: "message", message: incoming() })
      engine.push({ event: "edit", message: incoming({ editedAt: "2026-09-01T10:05:00.000Z" }) })
      engine.push({ event: "delete", chat: seed.busy, id: "3EB0000000000000000ABC" })
    })
    await done
    expect(events.map((event) => event.event)).toEqual(["message", "edit", "delete"])
    expect(events[0]).toMatchObject({ message: { chatTitle: null, text: "synthetic text" } })
    expect(events[2]).toMatchObject({ chatId: seed.busy, chatTitle: null })
  })

  it.each([
    ["logged_out", "authentication_error", "device.logged-out"],
    ["replaced", "provider_unavailable", "device.replaced"],
    ["banned", "permission_error", "account.banned"],
    ["outdated", "provider_unavailable", "client.outdated"],
    ["stopped", "provider_unavailable", "engine.stopped"],
  ] as const)("ends watch when WhatsApp says %s, with %s and %s", async (state, code, reason) => {
    const engine = fakeEngine(seed)
    const watched = whatsAppAdapter(engine).watch(
      () => {},
      new AbortController().signal,
      () => engine.push({ event: "connection", state }),
    )
    await expect(watched).rejects.toMatchObject({ code, details: { reason } })
  })

  it("ends watch on a temporary ban with the hold until the end WhatsApp gave", async () => {
    const until = "2099-01-01T00:00:00.000Z"
    const engine = fakeEngine(seed)
    const watched = whatsAppAdapter(engine).watch(
      () => {},
      new AbortController().signal,
      () => engine.push({ event: "connection", state: "banned", until }),
    )
    await expect(watched).rejects.toMatchObject({ details: { reason: "account.banned", standing: { until } } })
  })

  it("keeps watching through a dropped connection; the engine reconnects", async () => {
    const { done, events } = await watching((engine) => {
      engine.push({ event: "connection", state: "disconnected" })
      engine.push({ event: "message", message: incoming() })
    })
    await done
    expect(events).toHaveLength(1)
  })

  it("ends feed when WhatsApp logs the device out", async () => {
    const engine = fakeEngine(seed)
    const feeding = whatsAppAdapter(engine).feed(() => {}, new AbortController().signal)
    engine.push({ event: "connection", state: "logged_out" })
    await expect(feeding).rejects.toMatchObject({ code: "authentication_error" })
  })

  it("maps archived and muted chats, and leaves them out when WhatsApp does not say", () => {
    const chat = {
      jid: seed.busy,
      name: "Book club",
      kind: "group",
      unread: 0,
      lastMessageAt: null,
      participants: 3,
    } as const
    expect(toChat({ ...chat, archived: true, muted: false })).toMatchObject({ archived: true, muted: false })
    expect(toChat(chat)).not.toHaveProperty("archived")
  })
})
