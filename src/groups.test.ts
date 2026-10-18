import { Readable } from "node:stream"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import { EngineError, type WhatsAppEngine } from "./engine/contract.js"
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

// A command that reads the store may first warn that no `wa serve` keeps it up to date.
// A hold cli-core takes is announced on stderr beside the error line.
const errorOf = (stderr: string) => JSON.parse(stderr.slice(stderr.indexOf('{"error"'))).error
const errorCode = (stderr: string) => JSON.parse(stderr.slice(stderr.indexOf("{"))).error.code

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

  it("lists a group's members from WhatsApp, a page at a time or all of them", async () => {
    const everyone = (seed.members[seed.busy] ?? []).map((member) => member.id)
    const ids = (body: { items: { id: string }[] }) => body.items.map((member) => member.id)

    const second = await acting("chats", "members", "list", seed.busy, "--limit", "1", "--page", "2")
    expect(second.code).toBe(0)
    expect(ids(second.body)).toEqual(everyone.slice(1, 2))
    const all = await acting("chats", "members", "list", seed.busy, "--all")
    expect(ids(all.body)).toEqual(everyone)
  })

  it("fetches a group's members from WhatsApp into the store, where members history shows them join", async () => {
    const everyone = (seed.members[seed.busy] ?? []).map((member) => member.id)
    const fetched = await acting("chats", "members", "fetch", seed.busy, "--track", "--max-pages", "1")
    expect(fetched.code).toBe(0)
    expect(fetched.body).toMatchObject({ participants: everyone.length, complete: true, tracked: true })
    expect(fetched.body.joined).toEqual(everyone)
    expect(fetched.closed).toBe(true)
    const history = await acting("chats", "members", "history", seed.busy)
    expect(
      history.body.items.flatMap((event: { people: { id: string }[] }) => event.people.map((one) => one.id)),
    ).toEqual(everyone)
  })

  it("audits a group's members, asking for a sync while the store lacks the chat's start", async () => {
    const result = await acting("chats", "members", "audit", seed.busy, "--deep", "1", "--max-pages", "1")
    expect(result.code).toBe(0)
    expect(result.closed).toBe(true)
    expect(JSON.parse(result.stdout).next).toMatchObject([{ step: "messages.sync", args: { chat: seed.busy } }])
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

  it("turns a request down", async () => {
    const declined = await acting("chats", "requests", "decline", seed.busy, REQUESTER)
    expect(declined.code).toBe(0)
    expect(declined.done).toEqual([{ op: "answerRequest", jid: seed.busy, people: [REQUESTER], accept: false }])
  })
})

describe("wa account show", () => {
  it("names the linked account, and has no phone number to show even with --show-phone", async () => {
    for (const flags of [[], ["--show-phone"]]) {
      const result = await acting("account", "show", ...flags)
      expect(result.code).toBe(0)
      expect(result.body).toMatchObject({ id: seed.account?.id, name: seed.account?.name })
      expect(result.body.phone ?? null).toBeNull()
    }
  })
})

describe("wa contacts", () => {
  it("reads a person's profile from WhatsApp", async () => {
    const result = await acting("contacts", "profile", seed.person)
    expect(result.code).toBe(0)
    expect(result.body).toMatchObject({ id: seed.person, has_photo: true })
  })

  it("has no phone number in a profile, even with --show-phone", async () => {
    const result = await acting("contacts", "profile", seed.person, "--show-phone")
    expect(result.code).toBe(0)
    expect(result.body).toMatchObject({ id: seed.person })
    expect(result.body.phone ?? null).toBeNull()
  })

  it("checks a person by their WhatsApp profile; Telegram's ban lists answer unknown", async () => {
    const checked = await acting("contacts", "check", seed.person)
    expect(checked.code).toBe(0)
    expect(checked.body.reasons.map((one: { reason: string }) => one.reason)).toEqual(["no_username", "no_bio"])
    expect(checked.body.registries).toMatchObject([
      { name: "cas", answer: "unknown" },
      { name: "lols", answer: "unknown" },
    ])
    const unasked = await acting("contacts", "check", seed.person, "--no-registries")
    expect(unasked.body.registries).toEqual([])
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

  it("keeps the address book the phone shares", async () => {
    const newcomer = { jid: "100000000000088@lid", name: "Synthetic Newcomer" }
    const result = await wa([PROFILE, "contacts", "sync", "--json"], () => {
      const engine = fakeEngine(seed)
      const book = engine.contacts
      engine.contacts = async () => [...(await book()), newcomer]
      return engine
    })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({ added: 1 })
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

  it("holds every write after a ban until a doctor --online connects again", async () => {
    const profile = "banned"
    const ban = () =>
      new EngineError("permission_error", "WhatsApp has banned or restricted this account", "account.banned")
    const send = (engine: () => FakeEngine) =>
      wa([profile, "messages", "send", seed.dialog, "synthetic text", "--json"], engine)

    const refused = await send(() => {
      const engine = fakeEngine(seed)
      engine.send = async () => {
        throw ban()
      }
      return engine
    })
    expect(errorOf(refused.stderr)).toMatchObject({
      code: "permission_error",
      reason: "account.banned",
      details: { standing: { state: "banned" } },
    })

    let held: FakeEngine | undefined
    const meanwhile = await send(() => {
      held = fakeEngine(seed)
      return held
    })
    expect(errorOf(meanwhile.stderr).message).toContain("holds its writes")
    expect(held?.sent ?? []).toEqual([])

    let reacting: FakeEngine | undefined
    const reaction = await wa(
      [profile, "reactions", "add", seed.dialog, "3EB0000000000000000BEEF", "👍", "--json"],
      () => {
        reacting = fakeEngine(seed)
        return reacting
      },
    )
    expect(reaction.code).toBe(5)
    expect(reacting?.actions ?? []).toEqual([])

    const stillBanned = await wa([profile, "doctor", "--online", "--json"], () => {
      const engine = fakeEngine(seed)
      engine.ready = async () => {
        throw ban()
      }
      return engine
    })
    const report = JSON.parse(stillBanned.stdout).item
    expect(report.online.standing.state).toBe("banned")
    expect(report.flood.send_block).toMatchObject({ state: "banned", until: null })

    const back = await wa([profile, "doctor", "--online", "--json"], () => fakeEngine(seed))
    expect(JSON.parse(back.stdout).item.flood.send_block).toBeNull()
    expect((await send(() => fakeEngine(seed))).code).toBe(0)
  })

  it("lifts a ban hold with flood clear", async () => {
    const refused = await wa(["cleared", "messages", "send", seed.dialog, "synthetic text", "--json"], () => {
      const engine = fakeEngine(seed)
      engine.send = async () => {
        throw new EngineError("permission_error", "WhatsApp has banned or restricted this account", "account.banned")
      }
      return engine
    })
    expect(errorOf(refused.stderr).details.standing).toMatchObject({ state: "banned" })

    const cleared = await wa(["cleared", "flood", "clear", "--json"], () => fakeEngine(seed))
    expect(cleared.code, cleared.stderr).toBe(0)
    expect(
      (await wa(["cleared", "messages", "send", seed.dialog, "synthetic text", "--json"], () => fakeEngine(seed))).code,
    ).toBe(0)
  })

  it("holds writes until the end WhatsApp gives a temporary ban", async () => {
    const ends = new Date(Date.now() + 2 * 60 * 60_000).toISOString()
    const refused = await wa(["dated", "messages", "send", seed.dialog, "synthetic text", "--json"], () => {
      const engine = fakeEngine(seed)
      engine.send = async () => {
        throw new EngineError(
          "permission_error",
          "WhatsApp has banned or restricted this account",
          "account.banned",
          ends,
        )
      }
      return engine
    })
    const error = errorOf(refused.stderr)
    expect(error.message).toContain(`the ban ends ${ends}`)
    expect(error.details.standing).toMatchObject({ state: "banned", until: ends })

    let held: FakeEngine | undefined
    const meanwhile = await wa(["dated", "messages", "send", seed.dialog, "synthetic text", "--json"], () => {
      held = fakeEngine(seed)
      return held
    })
    expect(errorOf(meanwhile.stderr).message).toContain("holds its writes")
    expect(held?.sent ?? []).toEqual([])
    expect((await wa(["dated", "messages", "list", seed.dialog, "--json"], () => fakeEngine(seed))).code).toBe(0)
  })

  it("holds writes for 15 minutes after WhatsApp's rate limit; reads go on, and flood clear lifts it", async () => {
    const profile = "slowed"
    const limited = await wa([profile, "messages", "send", seed.dialog, "synthetic text", "--json"], () => {
      const engine = fakeEngine(seed)
      engine.send = async () => {
        throw new EngineError("rate_limited", "WhatsApp asks to slow down", "account.rate-limited")
      }
      return engine
    })
    expect(errorOf(limited.stderr)).toMatchObject({
      code: "rate_limited",
      reason: "account.rate-limited",
      details: { standing: { state: "limited" } },
    })

    const meanwhile = await wa([profile, "messages", "send", seed.dialog, "synthetic text", "--json"], () =>
      fakeEngine(seed),
    )
    expect(errorOf(meanwhile.stderr).details.standing).toMatchObject({ state: "limited" })
    expect((await wa([profile, "account", "show", "--json"], () => fakeEngine(seed))).code).toBe(0)
    const checked = await wa([profile, "doctor", "--online", "--json"], () => fakeEngine(seed))
    expect(JSON.parse(checked.stdout).item.flood.send_block).toMatchObject({ state: "limited" })

    expect((await wa([profile, "flood", "clear", "--json"])).code).toBe(0)
    const lifted = await wa([profile, "messages", "send", seed.dialog, "synthetic text", "--json"], () =>
      fakeEngine(seed),
    )
    expect(lifted.code).toBe(0)
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

// Each command here names a chat, and only WhatsApp's chat list turns a name into an id.
const naming = async (profile: string, ...argv: string[]) => {
  let engine: FakeEngine | undefined
  let listed = 0
  const result = await wa([profile, ...argv, "--json"], () => {
    engine = fakeEngine(seed)
    const directory = engine.directory
    engine.directory = () => {
      listed += 1
      return directory()
    }
    return engine
  })
  const body = result.code === 0 ? JSON.parse(result.stdout).item : undefined
  return { ...result, body, listed, closed: engine?.closed }
}

describe("wa recipients add", () => {
  it("looks the chat up by its WhatsApp name and puts its id on the list", async () => {
    const added = await naming("guarded", "recipients", "add", "Ann Lee")
    expect(added.code).toBe(0)
    expect(added.body).toEqual({ id: seed.dialog, title: "Ann Lee", added: true })
    expect(added.listed).toBe(1)
    expect(added.closed).toBe(true)
  })

  it("refuses a name two chats share, and a name no chat has, and adds nothing", async () => {
    const shared = await naming("unlisted", "recipients", "add", "Twins")
    expect(shared.code).toBe(2)
    expect(errorOf(shared.stderr).message).toContain("2 chats share that name")
    const unknown = await naming("unlisted", "recipients", "add", "Synthetic nobody")
    expect(errorCode(unknown.stderr)).toBe("not_found")
    const list = await wa(["unlisted", "recipients", "list", "--json"])
    expect(JSON.parse(list.stdout).items).toEqual([])
  })
})

describe("wa chats rules", () => {
  it("keeps a group's rules by the id WhatsApp gives for its name", async () => {
    const shown = await naming("rules", "chats", "rules", "show", "Book club")
    expect(shown.body).toMatchObject({
      chat_id: seed.busy,
      title: "Book club",
      saved: false,
      rules: { links: "report" },
    })
    expect(shown.listed).toBe(1)

    const set = await naming("rules", "chats", "rules", "set", "Book club", "links", "delete")
    expect(set.body).toMatchObject({ chat_id: seed.busy, saved: true, rules: { links: "delete" } })
    expect((await naming("rules", "chats", "rules", "show", seed.busy)).body.rules.links).toBe("delete")

    const unset = await naming("rules", "chats", "rules", "unset", seed.busy, "links")
    expect(unset.body).toMatchObject({ chat_id: seed.busy, saved: true, rules: { links: "report" } })
    expect(unset.closed).toBe(true)
  })

  it("refuses a name two groups share, and saves nothing", async () => {
    const refused = await naming("rules", "chats", "rules", "set", "Twins", "links", "delete")
    expect(refused.code).toBe(2)
    expect(errorOf(refused.stderr).message).toContain("name one by its id")
    expect((await naming("rules", "chats", "rules", "show", seed.chats[2]?.id ?? "")).body.saved).toBe(false)
  })
})
