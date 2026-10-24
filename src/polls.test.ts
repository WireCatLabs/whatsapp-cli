import { createHash } from "node:crypto"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeEach, describe, expect, it } from "vitest"
import type { EngineEvent, WaVote, WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"
import { watchItems } from "./testing/watch-records.js"

const hashOf = (text: string) => createHash("sha256").update(text).digest("hex")
const answerId = (text: string) => hashOf(text).slice(0, 8)

const base = contractSeed({ ids: whatsAppIds })
const theirs = base.messages.find((message) => message.chatId === base.busy && !message.outgoing) as Message
const whichDay = {
  question: "Which day?",
  answers: ["Monday", "Tuesday"].map((text) => ({ id: answerId(text), text })),
  multiple: false,
}
const poll: Message = {
  ...theirs,
  id: "3EB0000000000000000P01",
  text: "Which day?",
  attachments: [],
  providerMetadata: { poll: whichDay },
}
// Its own poll, so the votes it collects do not change what the poll above shows.
const counted: Message = { ...poll, id: "3EB0000000000000000P02" }
const seed = { ...base, messages: [...base.messages, poll, counted] }
const self = base.account?.id ?? ""
const other = "100000000000088@lid"

// Each test gets a store of its own: votes one test casts would otherwise show up in the next one's poll.
let store = ""

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    env: { ...process.env, MESSAGING_STORE: store },
    ...(engine ? { engine } : {}),
    ...(signal ? { signal } : {}),
  })
  return { code, stdout: streams.stdout.join("\n"), lines: streams.stdout, stderr: streams.stderr.join("") }
}

const polling = async (argv: string[]) => {
  let engine: FakeEngine | undefined
  const result = await wa(["voting", "polls", ...argv, "--json"], () => {
    engine = fakeEngine(seed)
    return engine
  })
  return { ...result, actions: engine?.actions ?? [], sent: engine?.sent ?? [] }
}

// A command that reads the store may first warn that no `wa serve` keeps it up to date.
const errorCode = (stderr: string) => JSON.parse(stderr.slice(stderr.indexOf("{"))).error.code

/** `wa watch` while the engine pushes `events`, as the phone would, then stops. */
const watching = async (events: EngineEvent[] = []) => {
  const controller = new AbortController()
  const pushing = () => {
    const engine = fakeEngine(seed)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("vote"))
        setImmediate(() => {
          for (const event of events) engine.push(event)
          setImmediate(() => controller.abort())
        })
      return stop
    }
    return engine
  }
  const result = await wa(["voting", "watch", "--events", "--jsonl"], pushing, controller.signal)
  expect(result.code, result.stderr).toBe(0)
  return watchItems(result.lines)
}

const vote = (voter: string, answers: string[], votedAt: string, extra: Partial<WaVote> = {}): EngineEvent => ({
  event: "vote",
  vote: {
    chat: base.busy,
    message: counted.id,
    voter,
    voterName: null,
    selected: answers.map(hashOf),
    votedAt,
    ...extra,
  },
})

beforeEach(async () => {
  store = join(mkdtempSync(join(tmpdir(), "wa-polls-")), "messages.db")
  await watching()
})

describe("wa polls create", () => {
  it("sends a poll whose answers are named by the hash a vote carries, and keeps it to show", async () => {
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
    const shown = await polling(["show", base.busy, result.sent[0]?.id ?? ""])
    expect(JSON.parse(shown.stdout).item).toMatchObject({ question: "Pizza?", creator: true })
  })

  it("repeats with --operation-id as one message", async () => {
    const result = await polling([
      "create",
      base.busy,
      "Pizza?",
      "yes",
      "no",
      "--operation-id",
      "3EB0000000000000000002",
    ])
    expect(result.code).toBe(0)
    expect(result.sent).toMatchObject([{ id: "3EB0000000000000000002", poll: { multiple: false } }])
  })

  it.each([
    ["--revote, since every WhatsApp vote can be changed", ["--revote"]],
    ["two answers with the same text", ["yes"]],
  ])("refuses %s, and sends nothing", async (_, extra) => {
    const result = await polling(["create", base.busy, "Pizza?", "yes", "no", ...extra])
    expect(result.code).toBe(2)
    expect(result.sent).toEqual([])
  })

  it.each([["--anonymous"], ["--silent"], ["--send-as", base.person]])(
    "does not offer %s, and never starts the engine",
    async (...option) => {
      const result = await wa(["voting", "polls", "create", base.busy, "Pizza?", "yes", "no", ...option], () => {
        throw new Error("an option WhatsApp lacks must never start the engine")
      })
      expect(result.code).toBe(2)
      expect(result.stderr).toContain(option[0])
    },
  )
})

describe("wa polls show and vote", () => {
  it("reads the poll from the store, with nobody's vote yet", async () => {
    const result = await polling(["show", base.busy, poll.id])
    expect(result.code, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({
      question: "Which day?",
      answers: [
        { id: answerId("Monday"), text: "Monday", voters: 0 },
        { id: answerId("Tuesday"), text: "Tuesday", voters: 0 },
      ],
      voters: 0,
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

  it("has no `polls close`: a WhatsApp poll stays open", async () => {
    const result = await polling(["close", base.busy, poll.id])
    expect(result.code).toBe(2)
    expect(result.actions).toEqual([])
  })
})

describe("votes from WhatsApp", () => {
  const show = async () => JSON.parse((await polling(["show", base.busy, counted.id])).stdout).item
  const twoVoted = () =>
    watching([
      vote(base.person, ["Monday"], "2026-09-01T10:01:00.000Z"),
      vote(other, ["Tuesday"], "2026-09-01T10:02:00.000Z", { voterName: "Synthetic Voter", poll: whichDay }),
      vote(other, ["Lunch"], "2026-09-01T10:03:00.000Z"),
    ])

  it("passes each vote on as `watch` reads it, by answer id, and counts it in `polls show`", async () => {
    const events = await twoVoted()
    expect(events.filter((event) => event.event === "vote")).toMatchObject([
      {
        chat_id: base.busy,
        message_id: counted.id,
        vote: { person_id: base.person, answers: [answerId("Monday")] },
      },
      { vote: { person_id: other, name: "Synthetic Voter", answers: [answerId("Tuesday")] } },
    ])
    expect(await show()).toMatchObject({
      answers: [
        { id: answerId("Monday"), voters: 1, chosen: false },
        { id: answerId("Tuesday"), voters: 1, chosen: false },
      ],
      voters: 2,
    })
  })

  it("lists who voted for what with `polls voters`, newest first", async () => {
    await twoVoted()
    const all = await polling(["voters", base.busy, counted.id])
    expect(all.code, all.stderr).toBe(0)
    expect(JSON.parse(all.stdout).items.map((one: { person_id: string }) => one.person_id)).toEqual([
      other,
      base.person,
    ])
    const monday = await polling(["voters", base.busy, counted.id, `answers:${answerId("Monday")}`])
    expect(JSON.parse(monday.stdout).items).toMatchObject([{ person_id: base.person, answers: [answerId("Monday")] }])
    const second = JSON.parse((await polling(["voters", base.busy, counted.id, "--limit", "1", "--page", "2"])).stdout)
    expect(second.items).toMatchObject([{ person_id: base.person }])
  })

  const pushed = {
    id: "3EB0000000000000000P03",
    chat: "120363000000000077@g.us",
    sender: base.person,
    senderName: null,
    fromMe: false,
    timestamp: "2026-09-01T09:00:00.000Z",
    editedAt: null,
    text: whichDay.question,
    replyTo: null,
    poll: whichDay,
  }
  const history = (...votes: WaVote[]): EngineEvent => ({
    event: "history",
    history: {
      kind: "recent",
      chats: [{ jid: pushed.chat, name: null, kind: "group", unread: 0, lastMessageAt: null, participants: 2 }],
      contacts: [],
      messages: [pushed],
      votes,
    },
  })
  const pushedVote = (answers: string[], votedAt: string): WaVote => ({
    chat: pushed.chat,
    message: pushed.id,
    voter: other,
    voterName: null,
    selected: answers.map(hashOf),
    votedAt,
    poll: whichDay,
  })
  const showPushed = async () => {
    const shown = await polling(["show", pushed.chat, pushed.id])
    expect(shown.code, shown.stderr).toBe(0)
    return JSON.parse(shown.stdout).item
  }

  it("stores the votes a history push carries with their poll, and passes none on as a `watch` vote", async () => {
    const events = await watching([history(pushedVote(["Tuesday"], "2026-09-01T09:05:00.000Z"))])
    expect(events.filter((event) => event.event === "vote")).toEqual([])
    expect(await showPushed()).toMatchObject({ answers: [{ voters: 0 }, { voters: 1 }], voters: 1 })
  })

  it("keeps a live vote over an older one the history push carries for the same voter", async () => {
    await watching([history()])
    await watching([vote(other, ["Monday"], "2026-09-01T09:10:00.000Z", { chat: pushed.chat, message: pushed.id })])
    await watching([history(pushedVote(["Tuesday"], "2026-09-01T09:07:00.000Z"))])
    expect(await showPushed()).toMatchObject({ answers: [{ voters: 1 }, { voters: 0 }], voters: 1 })
  })

  it("counts the account's own vote once, whether this command or the phone cast it", async () => {
    await twoVoted()
    const voted = await polling(["vote", base.busy, counted.id, answerId("Monday")])
    expect(JSON.parse(voted.stdout).item.poll).toMatchObject({
      answers: [
        { id: answerId("Monday"), voters: 2, chosen: true },
        { id: answerId("Tuesday"), voters: 1, chosen: false },
      ],
      voters: 3,
    })
    await watching([vote(self, ["Tuesday"], new Date(Date.now() + 60_000).toISOString())])
    expect(await show()).toMatchObject({
      answers: [
        { id: answerId("Monday"), voters: 1, chosen: false },
        { id: answerId("Tuesday"), voters: 2, chosen: true },
      ],
      voters: 3,
    })
  })
})
