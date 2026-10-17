import { Readable } from "node:stream"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"
import { REQUESTER } from "./testing/fake-groups.js"

const seed = contractSeed({ ids: whatsAppIds })
const stranger = "100000000000077@lid"

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal, stdin?: string) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    ...(engine ? { engine } : {}),
    ...(signal ? { signal } : {}),
    ...(stdin === undefined ? {} : { stdin: Readable.from([stdin]) }),
  })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

const PROFILE = "groups"

const actingWith = async (stdin: string | undefined, argv: string[]) => {
  let engine: FakeEngine | undefined
  const result = await wa(
    [PROFILE, ...argv, "--json"],
    () => {
      engine = fakeEngine(seed)
      return engine
    },
    undefined,
    stdin,
  )
  const body =
    result.code === 0 && result.stdout ? ((parsed) => parsed.item ?? parsed)(JSON.parse(result.stdout)) : undefined
  return { ...result, body, done: engine?.groupActions ?? [], closed: engine?.closed }
}

const acting = (...argv: string[]) => actingWith(undefined, argv)

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
  expect((await wa([PROFILE, "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
})

describe("wa chats members", () => {
  it("adds someone the account knows, and refuses a stranger without asking WhatsApp", async () => {
    const known = await acting("chats", "members", "add", seed.busy, seed.person)
    expect(known.code).toBe(0)
    expect(known.done).toEqual([{ op: "add", jid: seed.busy, people: [seed.person] }])

    const strange = await acting("chats", "members", "add", seed.busy, stranger)
    expect(strange.code).toBe(5)
    expect(errorCode(strange.stderr)).toBe("permission_error")
    expect(strange.done).toEqual([])
  })

  it("adds nobody when the profile denies it", async () => {
    expect((await wa(["denying", "config", "set", "permissions.chats.members.add", "deny"])).code).toBe(0)
    let engine: FakeEngine | undefined
    const result = await wa(["denying", "chats", "members", "add", seed.busy, seed.person, "--json"], () => {
      engine = fakeEngine(seed)
      return engine
    })
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(engine?.groupActions ?? []).toEqual([])
  })

  it("removes a member", async () => {
    const result = await acting("chats", "members", "remove", seed.busy, stranger)
    expect(result.code).toBe(0)
    expect(result.done).toEqual([{ op: "remove", jid: seed.busy, people: [stranger] }])
  })
})

describe("wa chats admins", () => {
  it("promotes a member with every right, since a WhatsApp admin has them all", async () => {
    const result = await acting("chats", "admins", "add", seed.busy, seed.person)
    expect(result.code).toBe(0)
    expect(result.done).toEqual([{ op: "promote", jid: seed.busy, people: [seed.person] }])
  })

  it("offers no --can to pick rights", async () => {
    const result = await acting("chats", "admins", "add", seed.busy, seed.person, "--can", "members")
    expect(result.code).toBe(2)
    expect(result.done).toEqual([])
  })

  it("demotes an admin", async () => {
    const result = await acting("chats", "admins", "remove", seed.busy, seed.person)
    expect(result.code).toBe(0)
    expect(result.done).toEqual([{ op: "demote", jid: seed.busy, people: [seed.person] }])
  })
})

describe("wa chats create, join, leave, update, link", () => {
  it("creates a group with people the account knows", async () => {
    const result = await acting("chats", "create", "Synthetic club", seed.person)
    expect(result.code).toBe(0)
    expect(result.done).toEqual([{ op: "createGroup", people: [seed.person] }])
  })

  it("refuses --channel, which WhatsApp makes in the app only, and makes nothing", async () => {
    const result = await acting("chats", "create", "Synthetic news", "--channel")
    expect(result.code).toBe(2)
    expect(result.done).toEqual([])
  })

  it("renames a group and changes its description", async () => {
    const result = await acting("chats", "update", seed.busy, "--title", "Synthetic club", "--description", "synthetic")
    expect(result.code).toBe(0)
    expect(result.done).toEqual([
      { op: "updateGroup", jid: seed.busy, change: { title: "Synthetic club", description: "synthetic" } },
    ])
  })

  it("joins by an invite link, or says the request waits for an admin", async () => {
    const joined = await acting("chats", "join", "https://chat.whatsapp.com/FAKE0000000000000000AB")
    expect(joined.code).toBe(0)
    expect(joined.body.chat.id).toBe(seed.busy)
    const asked = await acting("chats", "join", "https://chat.whatsapp.com/APPROVAL0000000000000AB")
    expect(asked.code).toBe(0)
    expect(asked.body.requested).toBe(true)
  })

  it("leaves a group", async () => {
    const result = await acting("chats", "leave", seed.busy)
    expect(result.code).toBe(0)
    expect(result.done).toEqual([{ op: "leave", jid: seed.busy }])
  })

  it("turns on admin-only adds and join approval in WhatsApp's terms", async () => {
    const result = await acting("chats", "update", seed.busy, "--only-admins-add", "on", "--join-approval", "on")
    expect(result.code).toBe(0)
    expect(result.done).toEqual([
      { op: "updateGroup", jid: seed.busy, change: { addMode: "admin_add", approval: true } },
    ])
    expect(result.body.chat.settings).toMatchObject({ only_admins_add: true, join_approval: true })
  })

  it("turns on admin-only sending and info, and disappearing messages, in WhatsApp's terms", async () => {
    const result = await acting(
      "chats",
      "update",
      seed.busy,
      "--only-admins-send",
      "on",
      "--only-admins-edit-info",
      "on",
      "--disappear-time",
      "7d",
    )
    expect(result.code).toBe(0)
    expect(result.done).toEqual([
      { op: "updateGroup", jid: seed.busy, change: { announce: true, locked: true, ephemeral: 604_800 } },
    ])
    expect(result.body.chat.settings).toMatchObject({
      only_admins_send: true,
      only_admins_edit_info: true,
      disappearing_seconds: 604_800,
    })
  })

  it("turns disappearing messages off", async () => {
    const result = await acting("chats", "update", seed.busy, "--disappear-time", "off")
    expect(result.code).toBe(0)
    expect(result.done).toEqual([{ op: "updateGroup", jid: seed.busy, change: { ephemeral: 0 } }])
  })

  it("refuses a disappearing time WhatsApp does not offer, and changes nothing", async () => {
    const result = await acting("chats", "update", seed.busy, "--disappear-time", "1h")
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("24h, 7d or 90d")
    expect(result.done).toEqual([])
  })

  it("shows the invite link and replaces it", async () => {
    const shown = await acting("chats", "link", "show", seed.busy)
    expect(shown.code).toBe(0)
    expect(shown.body.link).toMatch(/^https:\/\/chat\.whatsapp\.com\//)
    const reset = await acting("chats", "link", "reset", seed.busy)
    expect(reset.code).toBe(0)
    expect(reset.done).toEqual([{ op: "resetLink", jid: seed.busy }])
  })
})

describe("wa chats requests", () => {
  it("lists who asked to join and lets one in", async () => {
    const listed = await acting("chats", "requests", "list", seed.busy, "--limit", "1", "--page", "1")
    expect(listed.code).toBe(0)
    expect(listed.body.items).toEqual([expect.objectContaining({ person_id: REQUESTER })])
    const accepted = await acting("chats", "requests", "accept", seed.busy, REQUESTER)
    expect(accepted.code).toBe(0)
    expect(accepted.done).toEqual([{ op: "answerRequest", jid: seed.busy, people: [REQUESTER], accept: true }])
  })
})

describe("wa contacts", () => {
  it("reads a person's profile from WhatsApp", async () => {
    const result = await acting("contacts", "profile", seed.person)
    expect(result.code).toBe(0)
    expect(result.body).toMatchObject({ id: seed.person, has_photo: true })
  })

  it("blocks and unblocks", async () => {
    const blocked = await acting("contacts", "block", seed.person)
    expect(blocked.code).toBe(0)
    const unblocked = await acting("contacts", "unblock", seed.person)
    expect(unblocked.code).toBe(0)
    expect([...blocked.done, ...unblocked.done]).toEqual([
      { op: "block", jid: seed.person, blocked: true },
      { op: "block", jid: seed.person, blocked: false },
    ])
  })

  it("refuses adding a contact, which WhatsApp keeps on the phone only", async () => {
    const result = await acting("contacts", "add", seed.person)
    expect(result.code).toBe(2)
    expect(result.done).toEqual([])
  })

  it("finds the person behind one number", async () => {
    const result = await actingWith("+1 000 000 0000\n", ["contacts", "lookup"])
    expect(result.code).toBe(0)
    expect(result.body.id).toMatch(/@lid$/)
  })
})

describe("wa doctor --online", () => {
  it("connects to check the account, and reports it active", async () => {
    const result = await acting("doctor", "--online")
    expect(result.code).toBe(0)
    expect(JSON.stringify(result.body)).toContain('"state":"active"')
  })

  it("reports a banned account when WhatsApp refuses the connection for it", async () => {
    const result = await wa([PROFILE, "doctor", "--online", "--json"], () => {
      const engine = fakeEngine(seed)
      engine.ready = async () => engine.push({ event: "connection", state: "banned" })
      return engine
    })
    expect(result.stdout).toContain('"state":"banned"')
  })
})

describe("wa review --unanswered", () => {
  it("answers from the store without starting the engine for the groups' admins", async () => {
    const result = await wa([PROFILE, "review", "--unanswered", "1h", "--json"], () => {
      throw new Error("review must not start the engine")
    })
    expect(result.code).toBe(0)
  })
})
