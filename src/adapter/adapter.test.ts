import type { MessageEvent } from "@wirecat/cli-core"
import type { HistoryBatch } from "@wirecat/cli-core/cli"
import { contractSeed } from "@wirecat/cli-core/testing"
import { afterEach, describe, expect, it, vi } from "vitest"
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

  it("hands held re-keys on before a push that follows them, and a push's re-keys with the push", async () => {
    const engine = fakeEngine(seed)
    const controller = new AbortController()
    const batches: HistoryBatch[] = []
    const feeding = whatsAppAdapter(engine).feed((batch) => batches.push(batch), controller.signal)
    const rekey = { from: "70000000009@s.whatsapp.net", to: "100000000000001@lid" }
    engine.push({ event: "rekey", ...rekey })
    engine.push({
      event: "history",
      history: { kind: "recent", chats: [], contacts: [], messages: [incoming()], votes: [], rekeys: [rekey] },
    })
    controller.abort()
    await feeding
    expect(batches.slice(-2)).toMatchObject([
      { rekeys: [rekey] },
      { rekeys: [rekey], messages: [{ id: incoming().id }] },
    ])
  })

  describe("re-keys that arrive together", () => {
    afterEach(() => {
      vi.useRealTimers()
    })
    const rekeyOf = (n: number) => ({
      from: `7${String(n).padStart(10, "0")}@s.whatsapp.net`,
      to: `1${String(n).padStart(14, "0")}@lid`,
    })
    const feeding = (onBatch: (batch: HistoryBatch) => void = () => {}, warn: (line: string) => void = () => {}) => {
      const engine = fakeEngine(seed)
      const controller = new AbortController()
      const batches: HistoryBatch[] = []
      // The fake engine's seed history comes first; only the re-key batches are looked at.
      const done = whatsAppAdapter(engine, undefined, undefined, warn).feed((batch) => {
        if (batch.messages) return
        batches.push(batch)
        onBatch(batch)
      }, controller.signal)
      return { engine, controller, batches, done }
    }

    it("go to cli-core as one batch per 500, in arrival order", async () => {
      vi.useFakeTimers()
      const { engine, controller, batches, done } = feeding()
      const rekeys = Array.from({ length: 1200 }, (_, n) => rekeyOf(n))
      for (const rekey of rekeys) engine.push({ event: "rekey", ...rekey })
      await vi.advanceTimersByTimeAsync(100)
      expect(batches.map((batch) => batch.rekeys?.length)).toEqual([500, 500, 200])
      expect(batches.flatMap((batch) => batch.rekeys)).toEqual(rekeys)
      controller.abort()
      await done
      expect(batches).toHaveLength(3)
    })

    it("hand a single re-key on within 100 ms, while feed runs", async () => {
      vi.useFakeTimers()
      const { engine, controller, batches, done } = feeding()
      engine.push({ event: "rekey", ...rekeyOf(1) })
      await vi.advanceTimersByTimeAsync(99)
      expect(batches).toEqual([])
      await vi.advanceTimersByTimeAsync(1)
      expect(batches).toEqual([{ rekeys: [rekeyOf(1)] }])
      controller.abort()
      await done
    })

    it("are handed on when feed stops before the window closes", async () => {
      vi.useFakeTimers()
      const { engine, controller, batches, done } = feeding()
      for (const n of [1, 2, 3]) engine.push({ event: "rekey", ...rekeyOf(n) })
      controller.abort()
      await done
      expect(batches).toEqual([{ rekeys: [rekeyOf(1), rekeyOf(2), rekeyOf(3)] }])
      expect(vi.getTimerCount()).toBe(0)
    })

    it("reach cli-core before a live message that follows them", async () => {
      vi.useFakeTimers()
      const engine = fakeEngine(seed)
      const adapter = whatsAppAdapter(engine)
      const controller = new AbortController()
      const order: string[] = []
      const fed = adapter.feed((batch) => {
        if (batch.rekeys?.length) order.push("rekey")
      }, controller.signal)
      const listened = adapter.listen(() => order.push("message"), controller.signal)
      await vi.advanceTimersByTimeAsync(0)
      engine.push({ event: "rekey", ...rekeyOf(1) })
      engine.push({ event: "message", message: incoming() })
      await vi.advanceTimersByTimeAsync(0)
      expect(order).toEqual(["rekey", "message"])
      controller.abort()
      await Promise.all([fed, listened])
      expect(order).toEqual(["rekey", "message"])
    })

    it("are skipped with a warning when cli-core refuses them at the window's end, and feed goes on", async () => {
      vi.useFakeTimers()
      const warnings: string[] = []
      const { engine, controller, batches, done } = feeding(
        (batch) => {
          if (batch.rekeys?.length === 1) throw new TypeError("refused")
        },
        (line) => warnings.push(line),
      )
      engine.push({ event: "rekey", ...rekeyOf(1) })
      await vi.advanceTimersByTimeAsync(100)
      engine.push({ event: "rekey", ...rekeyOf(2) })
      engine.push({ event: "rekey", ...rekeyOf(3) })
      controller.abort()
      await expect(done).resolves.toBeUndefined()
      expect(batches.at(-1)).toEqual({ rekeys: [rekeyOf(2), rekeyOf(3)] })
      expect(warnings).toEqual([
        expect.stringContaining("rekey event could not be handled and was skipped (TypeError)"),
      ])
    })
  })

  it("skips a pushed history event that fails, says so once on stderr, and stores the ones after it", async () => {
    const engine = fakeEngine(seed)
    const warnings: string[] = []
    const controller = new AbortController()
    const handed: string[] = []
    const feeding = whatsAppAdapter(engine, undefined, undefined, (line) => warnings.push(line)).feed((batch) => {
      const id = batch.messages?.[0]?.id ?? ""
      if (!id.startsWith("3EB0FEED")) return
      if (id === "3EB0FEED00000002") throw new TypeError(`unexpected ${id} synthetic text`)
      handed.push(id)
    }, controller.signal)
    for (const id of ["3EB0FEED00000001", "3EB0FEED00000002", "3EB0FEED00000003"])
      engine.push({
        event: "history",
        history: { kind: "recent", chats: [], contacts: [], messages: [incoming({ id })], votes: [] },
      })
    controller.abort()
    await expect(feeding).resolves.toBeUndefined()
    expect(handed).toEqual(["3EB0FEED00000001", "3EB0FEED00000003"])
    expect(warnings).toEqual([
      expect.stringContaining("history event could not be handled and was skipped (TypeError)"),
    ])
    expect(warnings[0]).not.toMatch(/3EB0|synthetic|@/)
  })

  it("skips live events that fail, says the first at once and the count at the end, and hands on the rest", async () => {
    const engine = fakeEngine(seed)
    const warnings: string[] = []
    const controller = new AbortController()
    const ids: string[] = []
    const watched = whatsAppAdapter(engine, undefined, undefined, (line) => warnings.push(line)).watch(
      (event) => {
        if (event.event !== "message") return
        if (["3EB0FEED00000002", "3EB0FEED00000003"].includes(event.message.id)) throw new Error("boom")
        ids.push(event.message.id)
      },
      controller.signal,
      () => {
        for (const id of ["3EB0FEED00000001", "3EB0FEED00000002", "3EB0FEED00000003", "3EB0FEED00000004"])
          engine.push({ event: "message", message: incoming({ id }) })
        controller.abort()
      },
    )
    await expect(watched).resolves.toBeUndefined()
    expect(ids).toEqual(["3EB0FEED00000001", "3EB0FEED00000004"])
    expect(warnings).toEqual([
      expect.stringContaining("message event could not be handled and was skipped (Error)"),
      "2 pushed events could not be handled and were skipped in all",
    ])
  })

  it("ends feed when handling a push finds the engine gone", async () => {
    const engine = fakeEngine(seed)
    const feeding = whatsAppAdapter(engine, undefined, undefined, () => {}).feed(() => {
      throw new EngineError("provider_unavailable", "the WhatsApp engine stopped unexpectedly", "engine.stopped")
    }, new AbortController().signal)
    engine.push({
      event: "history",
      history: { kind: "recent", chats: [], contacts: [], messages: [incoming()], votes: [] },
    })
    await expect(feeding).rejects.toMatchObject({ code: "provider_unavailable", details: { reason: "engine.stopped" } })
  })

  it("hands on what a one-shot connection received while it was away, without connecting", async () => {
    const engine = fakeEngine(seed)
    let connects = 0
    engine.ready = async () => {
      connects += 1
    }
    engine.push({ event: "message", message: incoming() })
    const controller = new AbortController()
    const events: MessageEvent[] = []
    const listened = whatsAppAdapter(engine).listen((event) => events.push(event), controller.signal)
    engine.push({ event: "delete", chat: seed.busy, id: "3EB0000000000000000ABD" })
    controller.abort()
    await listened
    expect(connects).toBe(0)
    expect(events.map((event) => event.event)).toEqual(["message", "delete"])
  })

  it("ends listen quietly when this process logged the device out", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine)
    const listened = adapter.listen(() => {}, new AbortController().signal)
    await adapter.logout()
    engine.push({ event: "connection", state: "logged_out" })
    await expect(listened).resolves.toBeUndefined()
  })

  it("ends listen with why when the phone logged the device out", async () => {
    const engine = fakeEngine(seed)
    const listened = whatsAppAdapter(engine).listen(() => {}, new AbortController().signal)
    engine.push({ event: "connection", state: "logged_out" })
    await expect(listened).rejects.toMatchObject({ code: "authentication_error" })
  })

  it("hands on the history a one-shot connection is pushed, re-keys too, without connecting", async () => {
    const engine = fakeEngine(seed)
    let connects = 0
    engine.ready = async () => {
      connects += 1
    }
    const controller = new AbortController()
    const batches: HistoryBatch[] = []
    const listened = whatsAppAdapter(engine).listenHistory?.((batch) => batches.push(batch), controller.signal)
    engine.push({ event: "rekey", from: "70000000001@s.whatsapp.net", to: seed.person })
    const notice = { jid: seed.busy, kind: "group" as const, parent: null }
    engine.push({
      event: "history",
      history: { kind: "other", chats: [notice], contacts: [], messages: [], votes: [] },
    })
    controller.abort()
    await listened
    expect(connects).toBe(0)
    expect(batches.slice(-2)).toMatchObject([
      { rekeys: [{ from: "70000000001@s.whatsapp.net", to: seed.person }] },
      { chats: [{ id: seed.busy, kind: "group", parentChatId: null }] },
    ])
    expect(batches.at(-1)?.chats?.[0]).not.toHaveProperty("title")
    expect(batches.at(-1)?.chats?.[0]).not.toHaveProperty("unreadCount")
  })

  it("hands the engine only the stored phone-form one-to-one chats, in one request, and none when there are none", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine)
    await adapter.storedChats?.([seed.busy, seed.person, "120363000000000001@newsletter", "status@broadcast"])
    expect(engine.storedAsked).toEqual([])
    await adapter.storedChats?.(["70000000009@s.whatsapp.net", seed.busy, "70000000008@s.whatsapp.net"])
    expect(engine.storedAsked).toEqual([["70000000009@s.whatsapp.net", "70000000008@s.whatsapp.net"]])
  })

  it("hands the engine the phone-form recipients the store lacks, in the same request", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine)
    await adapter.storedChats?.([seed.busy], [seed.person, "100000000000004@lid"])
    expect(engine.storedAsked).toEqual([])
    await adapter.storedChats?.([], ["70000000007@s.whatsapp.net", "120363000000000001@g.us"])
    expect(engine.storedAsked).toEqual([[]])
    expect(engine.recipientsAsked).toEqual([["70000000007@s.whatsapp.net"]])
  })

  it("ends the history listen quietly when this process logged the device out, and with why when the phone did", async () => {
    const engine = fakeEngine(seed)
    const adapter = whatsAppAdapter(engine)
    const ours = adapter.listenHistory?.(() => {}, new AbortController().signal)
    await adapter.logout()
    engine.push({ event: "connection", state: "logged_out" })
    await expect(ours).resolves.toBeUndefined()

    const phone = fakeEngine(seed)
    const theirs = whatsAppAdapter(phone).listenHistory?.(() => {}, new AbortController().signal)
    phone.push({ event: "connection", state: "logged_out" })
    await expect(theirs).rejects.toMatchObject({ code: "authentication_error" })
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
