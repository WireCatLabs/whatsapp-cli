import { cpSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"
import { captureStreams } from "@wirecat/cli-base"
import { contractSeed } from "@wirecat/cli-core/testing"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { EngineError, type EngineEvent, type WaChat, type WaChatEvent, type WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { type FakeEngine, fakeEngine, whatsAppIds } from "./testing/fake-engine.js"
import { REQUESTER } from "./testing/fake-groups.js"

const seed = contractSeed({ ids: whatsAppIds })
const stranger = "100000000000077@lid"

// Each test gets a copy of one filled store: what one test stores would otherwise change the next one's answer.
let store = ""
let filledStore = ""

const wa = async (argv: string[], engine?: () => WhatsAppEngine, signal?: AbortSignal, stdin?: string) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    env: { ...process.env, MESSAGING_STORE: store },
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
  store = join(mkdtempSync(join(tmpdir(), "wa-groups-")), "messages.db")
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
  filledStore = store
})

beforeEach(() => {
  const copy = mkdtempSync(join(tmpdir(), "wa-groups-"))
  cpSync(dirname(filledStore), copy, { recursive: true })
  store = join(copy, "messages.db")
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

  it("sets a group's photo from a JPEG, before the rest of the change", async () => {
    const photo = join(mkdtempSync(join(tmpdir(), "wa-photo-test-")), "synthetic.jpg")
    writeFileSync(photo, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))
    const alone = await acting("chats", "update", seed.busy, "--photo", photo)
    expect(alone.code).toBe(0)
    expect(alone.done).toEqual([{ op: "setGroupPhoto", jid: seed.busy }])
    expect(alone.body.chat.id).toBe(seed.busy)

    const both = await acting("chats", "update", seed.busy, "--photo", photo, "--title", "Synthetic club")
    expect(both.code).toBe(0)
    expect(both.done).toEqual([
      { op: "setGroupPhoto", jid: seed.busy },
      { op: "updateGroup", jid: seed.busy, change: { title: "Synthetic club" } },
    ])

    const long = await acting("chats", "update", seed.busy, "--photo", photo, "--title", "x".repeat(26))
    expect(long.code).toBe(2)
    expect(long.done).toEqual([])
  })

  it("removes a group's photo with no file, before the rest of the change, and never beside a new one", async () => {
    const alone = await acting("chats", "update", seed.busy, "--remove-photo")
    expect(alone.code).toBe(0)
    expect(alone.done).toEqual([{ op: "removeGroupPhoto", jid: seed.busy }])

    const titled = await acting("chats", "update", seed.busy, "--remove-photo", "--title", "Synthetic club")
    expect(titled.done).toEqual([
      { op: "removeGroupPhoto", jid: seed.busy },
      { op: "updateGroup", jid: seed.busy, change: { title: "Synthetic club" } },
    ])

    const photo = join(mkdtempSync(join(tmpdir(), "wa-photo-test-")), "synthetic.jpg")
    writeFileSync(photo, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))
    const both = await acting("chats", "update", seed.busy, "--photo", photo, "--remove-photo")
    expect(both.code).toBe(2)
    expect(both.done).toEqual([])
  })

  it.each([
    ["set", "setGroupPhoto"],
    ["removed", "removeGroupPhoto"],
  ] as const)("says the photo was %s when the rest of the change then fails", async (done, op) => {
    const photo = join(mkdtempSync(join(tmpdir(), "wa-photo-test-")), "synthetic.jpg")
    writeFileSync(photo, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))
    const change = done === "set" ? ["--photo", photo] : ["--remove-photo"]
    let engine: FakeEngine | undefined
    const result = await wa(
      [PROFILE, "chats", "update", seed.busy, ...change, "--title", "Synthetic club", "--json"],
      () => {
        engine = fakeEngine(seed)
        engine.updateGroup = async () => {
          throw new EngineError("outcome_unknown", "the WhatsApp engine stopped before WhatsApp confirmed the change")
        }
        return engine
      },
    )
    expect(errorOf(result.stderr)).toMatchObject({
      code: "outcome_unknown",
      message: expect.stringMatching(new RegExp(`^the photo was ${done}, the rest of the change was not: `)),
    })
    expect(engine?.groupActions).toEqual([{ op, jid: seed.busy }])
  })

  it("sets no photo when the profile denies chats update", async () => {
    const photo = join(mkdtempSync(join(tmpdir(), "wa-photo-test-")), "synthetic.jpg")
    writeFileSync(photo, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))
    expect((await wa(["no-update", "config", "set", "permissions.chats.update", "deny"])).code).toBe(0)
    let engine: FakeEngine | undefined
    const result = await wa(["no-update", "chats", "update", seed.busy, "--photo", photo, "--json"], () => {
      engine = fakeEngine(seed)
      return engine
    })
    expect(errorCode(result.stderr)).toBe("permission_error")
    expect(engine?.groupActions ?? []).toEqual([])
  })

  it("refuses a photo that is not a JPEG, whatever its name, and changes nothing", async () => {
    const photo = join(mkdtempSync(join(tmpdir(), "wa-photo-test-")), "synthetic.jpg")
    writeFileSync(photo, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const result = await acting("chats", "update", seed.busy, "--photo", photo, "--title", "Synthetic club")
    expect(result.code).toBe(2)
    expect(errorOf(result.stderr)).toMatchObject({
      code: "validation_error",
      message: expect.stringContaining("is not a .jpg or .jpeg image"),
    })
    expect(result.done).toEqual([])
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

/** `wa watch` while the engine pushes `events` once it is ready. */
const watching = async (events: EngineEvent[]) => {
  const controller = new AbortController()
  const result = await wa(
    [PROFILE, "watch", "--events", "--jsonl"],
    () => {
      const engine = fakeEngine(seed)
      engine.ready = async () => {
        setImmediate(() => {
          for (const event of events) engine.push(event)
          setImmediate(() => controller.abort())
        })
      }
      return engine
    },
    controller.signal,
  )
  expect(result.code, result.stderr).toBe(0)
  return result.stdout
}

const offline = async (...argv: string[]) => {
  const result = await wa([PROFILE, ...argv, "--offline", "--json"], () => {
    throw new Error("a stored read must never start the engine")
  })
  expect(result.code, result.stderr).toBe(0)
  return JSON.parse(result.stdout)
}

describe("wa communities", () => {
  const community = "120363000000000009@g.us"
  const neighbours = {
    ...seed,
    chats: [
      ...seed.chats.map((chat) => (chat.id === seed.busy ? { ...chat, parentChatId: community } : chat)),
      {
        id: community,
        title: "Synthetic neighbours",
        kind: "group" as const,
        unreadCount: 0,
        lastMessageAt: null,
        participantsCount: 3,
        providerMetadata: { community: true },
      },
    ],
  }
  const updated = async (chat: string) => {
    const result = await wa([PROFILE, "chats", "update", chat, "--description", "synthetic", "--json"], () =>
      fakeEngine(neighbours),
    )
    expect(result.code).toBe(0)
    return JSON.parse(result.stdout).item.chat
  }

  it("a group in a community names it as its parent, and the community says it is one", async () => {
    const group = await updated(seed.busy)
    expect(group.parent_chat_id).toBe(community)
    expect(group.provider_metadata).toBeUndefined()

    const parent = await updated(community)
    expect(parent.kind).toBe("group")
    expect(parent.provider_metadata).toEqual({ community: true })
    expect(parent.parent_chat_id).toBeUndefined()
  })

  it("keeps a pushed group's community in the store, and the community whole though it came after", async () => {
    const pushed = (jid: string, name: string, more: Partial<WaChat>): WaChat => ({
      jid,
      name,
      kind: "group",
      unread: 0,
      lastMessageAt: null,
      participants: null,
      ...more,
    })
    const chats = [
      pushed(seed.busy, "Book club", { parent: community }),
      pushed(community, "Synthetic neighbours", { community: true }),
    ]
    await watching([{ event: "history", history: { kind: "recent", chats, contacts: [], messages: [], votes: [] } }])

    const group = (await offline("chats", "show", seed.busy)).item
    expect(group.parent_chat_id).toBe(community)
    expect(group.provider_metadata).toBeUndefined()
    const parent = (await offline("chats", "show", community)).item
    expect(parent).toMatchObject({
      title: "Synthetic neighbours",
      kind: "group",
      provider_metadata: { community: true },
    })
    expect(parent.parent_chat_id).toBeUndefined()
    const listed = (await offline("chats", "list")).items.find((chat: { id: string }) => chat.id === seed.busy)
    expect(listed.parent_chat_id).toBe(community)
  })

  it("keeps a stored community through a push that does not say, and clears it when a chat says none", async () => {
    const pushing = (more: Partial<WaChat>): EngineEvent => ({
      event: "history",
      history: {
        kind: "recent",
        chats: [
          {
            jid: seed.busy,
            name: "Book club",
            kind: "group",
            unread: 0,
            lastMessageAt: null,
            participants: null,
            ...more,
          },
        ],
        contacts: [],
        messages: [],
        votes: [],
      },
    })
    await watching([pushing({ parent: community }), pushing({})])
    expect((await offline("chats", "show", seed.busy)).item.parent_chat_id).toBe(community)

    await watching([pushing({ parent: null })])
    const group = (await offline("chats", "show", seed.busy)).item
    expect(group.parent_chat_id).toBeUndefined()
    expect(group.title).toBe("Book club")
  })

  it("keeps what a group push leaves out, and a notice that the group left its community clears only that", async () => {
    const pushing = (chat: WaChat): EngineEvent => ({
      event: "history",
      history: { kind: "other", chats: [chat], contacts: [], messages: [], votes: [] },
    })
    // A group the seed has no messages or members of, so what the store shows is what was pushed.
    const alone = "120363000000000077@g.us"
    const lastMessageAt = "2026-09-01T10:00:00.000Z"
    await watching([
      pushing({
        jid: alone,
        name: "Book club",
        kind: "group",
        unread: 3,
        lastMessageAt,
        participants: 5,
        parent: community,
      }),
      pushing({ jid: alone, name: "Book club", kind: "group", participants: 5 }),
    ])
    const kept = { title: "Book club", unread_count: 3, last_message_at: lastMessageAt, participants_count: 5 }
    expect((await offline("chats", "show", alone)).item).toMatchObject({ ...kept, parent_chat_id: community })

    await watching([pushing({ jid: alone, kind: "group", parent: null })])
    const group = (await offline("chats", "show", alone)).item
    expect(group).toMatchObject(kept)
    expect(group.parent_chat_id).toBeUndefined()
  })

  it("a notice that a group joined a community sets only its parent", async () => {
    const pushing = (chat: WaChat): EngineEvent => ({
      event: "history",
      history: { kind: "other", chats: [chat], contacts: [], messages: [], votes: [] },
    })
    const joining = "120363000000000078@g.us"
    const lastMessageAt = "2026-09-02T10:00:00.000Z"
    await watching([
      pushing({ jid: joining, name: "Chess club", kind: "group", unread: 2, lastMessageAt, participants: 4 }),
    ])
    expect((await offline("chats", "show", joining)).item.parent_chat_id).toBeUndefined()

    await watching([pushing({ jid: joining, kind: "group", parent: community })])
    expect((await offline("chats", "show", joining)).item).toMatchObject({
      title: "Chess club",
      unread_count: 2,
      last_message_at: lastMessageAt,
      participants_count: 4,
      parent_chat_id: community,
    })
  })
})

describe("a group the owner left", () => {
  const pushing = (chat: WaChat): EngineEvent => ({
    event: "history",
    history: { kind: "other", chats: [chat], contacts: [], messages: [], votes: [] },
  })
  const leftChats = async () => {
    const result = await wa([PROFILE, "store", "clear", "--left", "--dry-run", "--json"])
    expect(result.code, result.stderr).toBe(0)
    const answer = JSON.parse(result.stdout)
    return (answer.item ?? answer).left as { id: string; title: string | null }[]
  }
  const leftIds = async () => (await leftChats()).map(({ id }) => id)

  it("is listed by store clear --left once WhatsApp says so, and stays listed after a full push", async () => {
    const left = "120363000000000079@g.us"
    const lastMessageAt = "2026-09-03T10:00:00.000Z"
    await watching([pushing({ jid: left, name: "Old club", kind: "group", unread: 1, lastMessageAt, participants: 6 })])
    expect(await leftIds()).not.toContain(left)

    await watching([pushing({ jid: left, kind: "group", membershipState: "left" })])
    expect(await leftChats()).toContainEqual(expect.objectContaining({ id: left, title: "Old club" }))

    await watching([pushing({ jid: left, name: "Old club", kind: "group", participants: 6 })])
    expect(await leftIds()).toContain(left)
  })

  it("is out of chats list, and deleted by store clear --left --allow-dangerous, only it", async () => {
    const left = "120363000000000080@g.us"
    await watching([
      pushing({ jid: left, name: "Gone club", kind: "group", participants: 2 }),
      pushing({ jid: left, kind: "group", membershipState: "left" }),
    ])
    expect(await leftIds()).toEqual([left])
    const listed = (await offline("chats", "list", "--all")).items.map(({ id }: { id: string }) => id)
    expect(listed).not.toContain(left)
    const result = await wa([PROFILE, "store", "clear", "--left", "--allow-dangerous", "--json"])
    expect(result.code, result.stderr).toBe(0)
    expect(await leftIds()).toEqual([])
    expect((await offline("chats", "show", seed.busy)).item.id).toBe(seed.busy)
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

describe("wa watch", () => {
  it("titles a message from the chat's stored title, which WhatsApp's event lacks", async () => {
    const controller = new AbortController()
    const result = await wa(
      [PROFILE, "watch", "--jsonl"],
      () => {
        const engine = fakeEngine(seed)
        engine.ready = async () => {
          setImmediate(() => {
            engine.push({
              event: "message",
              message: {
                id: "3EB0000000000000000ABD",
                chat: seed.busy,
                sender: seed.person,
                senderName: "Ann Lee",
                fromMe: false,
                timestamp: "2026-09-01T10:00:00.000Z",
                editedAt: null,
                text: "synthetic text",
                replyTo: null,
              },
            })
            setImmediate(() => controller.abort())
          })
        }
        return engine
      },
      controller.signal,
    )
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ chatId: seed.busy, chatTitle: "Book club" })
  })
})

describe("wa chats events", () => {
  const joined: WaChatEvent = {
    chat: seed.busy,
    id: "0123456789abcdef0123456789abcdef",
    timestamp: new Date(Math.floor(Date.now() / 1000 - 3600) * 1000).toISOString(),
    event: "add",
    by: seed.person,
    byName: "Ann Lee",
    people: [{ jid: stranger, name: null }],
  }

  it("keeps an add seen under watch, lists it once offline though a history push repeats it, and counts it", async () => {
    const printed = await watching([{ event: "chat_event", change: joined }])
    expect(JSON.parse(printed)).toMatchObject({ event: "chat_event", chatId: seed.busy, chatTitle: "Book club" })
    await watching([
      {
        event: "history",
        history: { kind: "recent", chats: [], contacts: [], messages: [], votes: [], events: [joined] },
      },
    ])

    const listed = await offline("chats", "events", seed.busy)
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]).toMatchObject({ type: "add", by: { id: seed.person }, people: [{ id: stranger }] })

    const stats = await offline(
      "stats",
      "chats",
      "show",
      seed.busy,
      "--since-time",
      "30d",
      "--by",
      "day",
      "--timezone",
      "UTC",
    )
    expect(stats.item.members).toMatchObject({ joined: 1, left: 0 })
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

// Each command here names a chat; cli-core answers a stored name, and WhatsApp's chat list only a name the store lacks.
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
  it("looks the chat up by its stored name and puts its id on the list", async () => {
    const added = await naming("guarded", "recipients", "add", "Ann Lee")
    expect(added.code).toBe(0)
    expect(added.body).toEqual({ id: seed.dialog, title: "Ann Lee", added: true })
    expect(added.listed).toBe(0)
    expect(added.closed).toBe(true)
  })

  it("refuses a name two chats share, and a name no chat has, and adds nothing", async () => {
    const shared = await naming("unlisted", "recipients", "add", "Twins")
    expect(shared.code).toBe(2)
    expect(errorOf(shared.stderr).message).toContain("matches 2 chats")
    const unknown = await naming("unlisted", "recipients", "add", "Synthetic nobody")
    expect(errorCode(unknown.stderr)).toBe("not_found")
    const list = await wa(["unlisted", "recipients", "list", "--json"])
    expect(JSON.parse(list.stdout).items).toEqual([])
  })

  it("takes the id of a group the store does not hold without asking WhatsApp's chat list", async () => {
    const unstored = "120363000000000099@g.us"
    const added = await naming("unstored", "recipients", "add", unstored)
    expect(added.code).toBe(0)
    expect(added.body).toMatchObject({ id: unstored, added: true })
    expect(added.listed).toBe(0)
  })

  it("asks WhatsApp's chat list for a name the store does not hold", async () => {
    const newcomer: WaChat = {
      jid: "100000000000098@lid",
      name: "Synthetic Newcomer",
      kind: "dm",
      unread: null,
      lastMessageAt: null,
      participants: null,
    }
    const result = await wa(["fallback", "recipients", "add", "Synthetic Newcomer", "--json"], () => {
      const engine = fakeEngine(seed)
      const directory = engine.directory
      engine.directory = async () => [...(await directory()), newcomer]
      return engine
    })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({ id: newcomer.jid, added: true })
  })
})

describe("wa chats rules", () => {
  it("keeps a group's rules by the id its stored name gives", async () => {
    const shown = await naming("rules", "chats", "rules", "show", "Book club")
    expect(shown.body).toMatchObject({
      chat_id: seed.busy,
      title: "Book club",
      saved: false,
      rules: { links: "report" },
    })
    expect(shown.listed).toBe(0)

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

  it("refuses a newAccount rule before connecting, since WhatsApp does not say how old an account is", async () => {
    const refused = await wa(["ages", "chats", "rules", "set", seed.busy, "newAccount.days", "3", "--json"], () => {
      throw new Error("a refused rule must never start the engine")
    })
    expect(refused.code).toBe(2)
    expect(refused.stdout).toBe("")
    expect(errorOf(refused.stderr).message).toBe(
      "WhatsApp does not say how old an account is, so newAccount cannot work",
    )
    expect((await naming("ages", "chats", "rules", "show", seed.busy)).body.saved).toBe(false)
  })
})

describe("wa tags auto", () => {
  it("with --sync-first, reads the group's description from WhatsApp and tags the group by it", async () => {
    const asked: string[] = []
    const result = await wa([PROFILE, "tags", "auto", "--chat", seed.busy, "--sync-first", "--json"], () => {
      const engine = fakeEngine(seed)
      const group = engine.group
      engine.group = async (jid, options) => {
        asked.push(jid)
        return { ...(await group(jid, options)), description: "a synthetic news digest" }
      }
      return engine
    })
    expect(result.code, result.stderr).toBe(0)
    expect(asked).toEqual([seed.busy])
    expect(JSON.parse(result.stdout).item.items).toMatchObject([
      { chat_id: seed.busy, source: "metadata", tags: [{ tag: "news", fields: ["description"] }] },
    ])
  })

  it("without it, tags from the store alone and never starts the engine", async () => {
    const result = await wa([PROFILE, "tags", "auto", "--chat", seed.chats[2]?.id ?? "", "--json"], () => {
      throw new Error("tags auto without --sync-first must not start the engine")
    })
    expect(result.code, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).item.items).toMatchObject([{ source: "stored-chat", tags: [] }])
  })
})

describe("wa metadata", () => {
  it("keeps a group's title and description from WhatsApp's group read, and answers them from the store", async () => {
    const refreshed = await acting("metadata", "refresh", "--chat", seed.busy)
    expect(refreshed.code, refreshed.stderr).toBe(0)
    expect(refreshed.body.chats).toEqual([expect.objectContaining({ chat_id: seed.busy, description: null })])

    const kept = await wa([PROFILE, "metadata", "get", "--chat", seed.busy, "--json"], () => {
      throw new Error("a stored read must not start the engine")
    })
    expect(kept.code, kept.stderr).toBe(0)
    expect(JSON.parse(kept.stdout).item).toMatchObject({ chat_id: seed.busy, metadata: { title: expect.any(String) } })

    const missing = await acting("metadata", "refresh", "--only-missing", "--limit", "50")
    expect(missing.code, missing.stderr).toBe(0)
    expect(missing.body.chats.map((chat: { chat_id: string }) => chat.chat_id)).not.toContain(seed.busy)
  })

  it("refuses a one-to-one chat without asking WhatsApp", async () => {
    const result = await acting("metadata", "refresh", "--chat", seed.dialog)
    expect(result.code).toBe(0)
    expect(result.body.chats).toEqual([
      expect.objectContaining({ chat_id: seed.dialog, error: expect.objectContaining({ code: "validation_error" }) }),
    ])
  })
})
