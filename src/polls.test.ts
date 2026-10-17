import { createHash } from "node:crypto"
import { captureStreams } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const answerId = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 8)

const base = contractSeed({ ids: whatsAppIds })
const theirs = base.messages.find((message) => message.chatId === base.busy && !message.outgoing) as Message
const poll: Message = {
  ...theirs,
  id: "3EB0000000000000000P01",
  text: "Which day?",
  attachments: [],
  providerMetadata: {
    poll: {
      question: "Which day?",
      answers: ["Monday", "Tuesday"].map((text) => ({ id: answerId(text), text })),
      multiple: false,
    },
  },
}
const seed = { ...base, messages: [...base.messages, poll] }

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    ...(engine ? { engine } : {}),
    ...(signal ? { signal } : {}),
  })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const polling = async (argv: string[]) => {
  let engine: FakeEngine | undefined
  const result = await wa(["voting", "polls", ...argv, "--json"], () => {
    engine = fakeEngine(seed)
    return engine
  })
  return { ...result, actions: engine?.actions ?? [], sent: engine?.sent ?? [] }
}

const errorCode = (stderr: string) => JSON.parse(stderr).error.code

beforeAll(async () => {
  const controller = new AbortController()
  const filling = () => {
    const engine = fakeEngine(seed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => controller.abort())
      return stop
    }
    return engine
  }
  expect((await wa(["voting", "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
})

describe("wa polls create", () => {
  it("sends a poll whose answers are named by the hash a vote carries", async () => {
    const result = await polling(["create", base.busy, "Pizza?", "yes", "no", "--multiple"])
    expect(result.code).toBe(0)
    expect(result.sent).toMatchObject([
      {
        text: "Pizza?",
        poll: {
          question: "Pizza?",
          answers: [
            { id: answerId("yes"), text: "yes" },
            { id: answerId("no"), text: "no" },
          ],
          multiple: true,
        },
      },
    ])
  })

  it.each([
    ["--anonymous, since everyone sees the votes", "--anonymous"],
    ["two answers with the same text", "yes"],
  ])("refuses %s, and sends nothing", async (_, extra) => {
    const result = await polling(["create", base.busy, "Pizza?", "yes", "no", extra])
    expect(result.code).toBe(2)
    expect(result.sent).toEqual([])
  })
})

describe("wa polls show and vote", () => {
  it("reads the poll from the store, its votes uncounted", async () => {
    const result = await polling(["show", base.busy, poll.id])
    expect(result.code, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({
      question: "Which day?",
      answers: [
        { id: answerId("Monday"), text: "Monday", voters: null },
        { id: answerId("Tuesday"), text: "Tuesday", voters: null },
      ],
      voters: null,
      closed: false,
      anonymous: false,
    })
  })

  it("votes by the answer's text, in the poll addressed by its stored sender", async () => {
    const result = await polling(["vote", base.busy, poll.id, answerId("Tuesday")])
    expect(result.code, result.stderr).toBe(0)
    expect(result.actions).toEqual([
      {
        op: "vote",
        key: { chat: base.busy, id: poll.id, fromMe: false, sender: poll.senderId },
        answers: ["Tuesday"],
      },
    ])
  })

  it("takes the vote back with --retract", async () => {
    const result = await polling(["vote", base.busy, poll.id, "--retract"])
    expect(result.code).toBe(0)
    expect(result.actions).toMatchObject([{ op: "vote", answers: [] }])
  })

  it.each([
    ["an answer the poll does not have", ["ffffffff"]],
    ["two answers in a poll that takes one", [answerId("Monday"), answerId("Tuesday")]],
  ])("refuses %s, and votes nothing", async (_, answers) => {
    const result = await polling(["vote", base.busy, poll.id, ...answers])
    expect(result.code).toBe(2)
    expect(errorCode(result.stderr)).toBe("validation_error")
    expect(result.actions).toEqual([])
  })

  it("refuses to close a poll, which WhatsApp cannot do", async () => {
    const result = await polling(["close", base.busy, poll.id])
    expect(result.code).toBe(2)
    expect(result.actions).toEqual([])
  })
})
