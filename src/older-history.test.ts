import { readFileSync } from "node:fs"
import { join } from "node:path"
import { captureStreams } from "@wirecat/cli-base"
import type { StoredMessages } from "@wirecat/cli-core/cli"
import { openStore } from "@wirecat/cli-core/store"
import { contractSeed } from "@wirecat/cli-core/testing"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { whatsAppAdapter } from "./adapter/adapter.js"
import type { WaMessage, WhatsAppEngine } from "./engine/contract.js"

import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const inBusy = seed.messages.filter((message) => message.chatId === seed.busy)
const oldest = inBusy[0]
const account = seed.account?.id ?? null

// What the phone still holds of the busy chat, older than anything it pushed: one an hour, back from the first push.
const onPhone: WaMessage[] = Array.from({ length: 60 }, (_, n) => ({
  id: `3EB0000000000000000P${String(n).padStart(2, "0")}`,
  chat: seed.busy,
  sender: seed.person,
  senderName: null,
  fromMe: false,
  timestamp: new Date(Date.parse(oldest?.timestamp ?? "") - (n + 1) * 3_600_000).toISOString(),
  editedAt: null,
  text: "synthetic older text",
  replyTo: null,
}))

// cli-core's seam for starting a job's process; wa's own Environment does not name it.
type SpawnJob = (argv: string[], env: NodeJS.ProcessEnv, log: string) => number

const wa = async (
  argv: string[],
  engine: () => WhatsAppEngine,
  signal?: AbortSignal,
  more: { env?: NodeJS.ProcessEnv; spawnJob?: SpawnJob } = {},
) => {
  const streams = captureStreams()
  const code = await run(argv, { streams, tty: false, engine, ...(signal ? { signal } : {}), ...more })
  return { code, stdout: streams.stdout.join(""), stderr: streams.stderr.join("") }
}

// The lookups cli-core hands a connection, over the store the CLI filled, for calling the adapter directly.
const opened = openStore({ env: process.env, command: "wa" })
const lookups = (owner: string): StoredMessages => {
  const key = { provider: "whatsapp", account: owner }
  return {
    message: async (chatId, messageId) => (await opened).messages.message(key, messageId, { chatId }),
    newestIncoming: async () => undefined,
    anchor: async (chatId, at) =>
      (
        await (
          await opened
        ).messages.messagesWindow(
          key,
          chatId,
          at === undefined ? { at: new Date(0).toISOString(), before: 0, after: 1 } : { at, before: 1, after: 0 },
        )
      )[0],
    wroteTo: async () => false,
    pollVotes: async () => [],
  }
}
const stored = lookups(account ?? "")

// Fills the store as the phone's first history push does, then stops watching.
const filled = async (profile: string, from: typeof seed) => {
  const controller = new AbortController()
  const filling = () => {
    const engine = fakeEngine(from)
    const listen = engine.listen
    engine.listen = (kinds, onEvent) => {
      const stop = listen(kinds, onEvent)
      if (kinds.includes("history")) setImmediate(() => controller.abort())
      return stop
    }
    return engine
  }
  expect((await wa([profile, "watch", "--jsonl"], filling, controller.signal)).code).toBe(0)
}

beforeAll(() => filled("older", seed))

afterAll(async () => (await opened).close())

describe("older history from the phone", () => {
  it("counts back from the oldest stored message on the first page, and asks at most 50", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const page = await whatsAppAdapter(engine, stored).history(seed.busy, { limit: 100 })
    expect(engine.olderAsked).toEqual([
      {
        anchor: expect.objectContaining({ chat: seed.busy, id: oldest?.id, timestamp: oldest?.timestamp }),
        count: 50,
      },
    ])
    expect(page.hasMore).toBe(true)
    expect(page.items).toHaveLength(50)
    expect(page.items.at(-1)?.id).toBe(onPhone[0]?.id)
    expect(page.items.map((message) => message.timestamp)).toEqual(page.items.map((m) => m.timestamp).toSorted())
  })

  it("then counts back from the newest stored message at or before the time the last page reached", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const middle = inBusy[4]
    await whatsAppAdapter(engine, stored).history(seed.busy, { limit: 20, before: middle?.timestamp ?? "" })
    expect(engine.olderAsked[0]?.anchor).toMatchObject({ id: middle?.id, fromMe: middle?.outgoing === true })
  })

  it("says the chat's start is reached only when the phone sends nothing", async () => {
    const engine = fakeEngine(seed, { phone: [] })
    expect(await whatsAppAdapter(engine, stored).history(seed.busy, { limit: 50 })).toEqual({
      items: [],
      hasMore: false,
    })
  })

  it("refuses a chat the store holds nothing of, without asking the phone", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    await expect(whatsAppAdapter(engine, stored).history("100000000000099@lid", { limit: 50 })).rejects.toMatchObject({
      code: "not_found",
      message: expect.stringContaining("local store"),
    })
    expect(engine.olderAsked).toEqual([])
  })

  it("passes on the phone's silence as a timeout, never as an empty page", async () => {
    const engine = fakeEngine(seed)
    await expect(whatsAppAdapter(engine, stored).history(seed.busy, { limit: 50 })).rejects.toMatchObject({
      code: "timeout",
    })
  })

  it("still refuses `messages sync --all`: there is no chat list to walk", async () => {
    const engine = fakeEngine(seed, { phone: onPhone })
    const result = await wa(["older", "messages", "sync", "--all", "--json"], () => engine)
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("name one chat")
    expect(engine.olderAsked).toEqual([])
  })
})

// A page sync stores moves the chat's oldest message, which every test counts back from.
const ownAccount = async (profile: string, n: number) => {
  const own = { ...seed, account: { id: `1000000000000${80 + n}@lid`, name: "Synthetic owner", username: null } }
  await filled(profile, own)
  return own
}

// Each on an account of its own.
describe("messages sync", () => {
  const sync = async (profile: string, engine: WhatsAppEngine, ...options: string[]) => {
    const argv = [profile, "messages", "sync", seed.busy, ...options, "--pause", "1ms", "--no-catch-up", "--json"]
    const result = await wa(argv, () => engine)
    expect(result.code).toBe(0)
    return JSON.parse(result.stdout).item
  }

  it("asks the phone through `messages sync <chat>` and stores the page", async () => {
    const own = await ownAccount("stores", 3)
    const engine = fakeEngine(own, { phone: onPhone })
    await sync("stores", engine, "--limit", "50")
    expect(engine.olderAsked).toHaveLength(1)
    expect(await lookups(own.account.id).message(seed.busy, onPhone[0]?.id ?? "")).toMatchObject({ id: onPhone[0]?.id })
  })

  it("asks the phone for --page-size messages at a time", async () => {
    const engine = fakeEngine(await ownAccount("paged", 4), { phone: onPhone })
    await sync("paged", engine, "--page-size", "5", "--limit", "10")
    expect(engine.olderAsked.map((asked) => asked.count)).toEqual([5, 5])
  })

  it("serves more than 50 as one request after another, each counting back from the last one's oldest", async () => {
    const first = seed.messages.find((message) => message.chatId === seed.dialog)
    const older: WaMessage[] = Array.from({ length: 120 }, (_, n) => ({
      ...(onPhone[0] as WaMessage),
      id: `3EB0000000000000000D${String(n).padStart(3, "0")}`,
      chat: seed.dialog,
      timestamp: new Date(Date.parse(first?.timestamp ?? "") - (n + 1) * 60_000).toISOString(),
    }))
    const engine = fakeEngine(await ownAccount("chunked", 5), { phone: older })
    const argv = ["chunked", "messages", "sync", seed.dialog, "--limit", "500", "--pause", "1ms", "--no-catch-up"]
    const result = await wa([...argv, "--json"], () => engine)
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout).item).toMatchObject({ fetched: 120, complete: true })
    // The fourth ask, past the 20 the third brought, finds nothing: that is the chat's start.
    expect(engine.olderAsked.map((one) => one.count)).toEqual([50, 50, 50, 50])
    const anchors = [first?.id, older[49]?.id, older[99]?.id, older[119]?.id]
    expect(engine.olderAsked.map((one) => one.anchor.id)).toEqual(anchors)
  })

  it("with --since-time, stops asking the phone once its pages reach that time", async () => {
    const engine = fakeEngine(await ownAccount("since", 1), { phone: onPhone })
    const item = await sync("since", engine, "--since-time", onPhone[4]?.timestamp ?? "", "--page-size", "3")
    expect(engine.olderAsked.map((asked) => asked.count)).toEqual([3, 3])
    expect(item).toMatchObject({ fetched: 6, reached_since: true })
  })

  it("with --last, stops once the chat's newest n messages are held", async () => {
    const engine = fakeEngine(await ownAccount("last", 2), { phone: onPhone })
    const item = await sync("last", engine, "--last", String(inBusy.length + 4), "--page-size", "4")
    expect(engine.olderAsked.map((asked) => asked.count)).toEqual([4])
    expect(item).toMatchObject({ fetched: 4, reached_last: true })
  })

  it("refuses --dry-run without starting the engine: the phone pushes history, there is no count", async () => {
    const result = await wa(["older", "messages", "sync", seed.busy, "--dry-run", "--json"], () => {
      throw new Error("a dry run must never start the engine")
    })
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr.slice(result.stderr.indexOf("{"))).error.message).toContain(
      "pushes its history instead",
    )
  })
})

describe("store gaps repair", () => {
  it("asks the phone for the gap between two held stretches, counting back from the message above it", async () => {
    const own = await ownAccount("gaps", 5)
    const key = { provider: "whatsapp", account: own.account.id }
    const at = (message?: { timestamp: string }) => Date.parse(message?.timestamp ?? "")
    const store = await opened
    await store.sync.markRange(key, seed.busy, at(oldest), at(inBusy.at(-1)))
    await store.sync.markRange(key, seed.busy, at(onPhone[30]), at(onPhone[20]))
    const gap = { from: at(onPhone[20]) + 1, to: at(oldest) - 1 }

    const engine = fakeEngine(own, { phone: onPhone })
    const argv = ["gaps", "store", "gaps", "repair", seed.busy, "--page-size", "10", "--pause", "1ms", "--no-catch-up"]
    const result = await wa([...argv, "--json"], () => engine)
    expect(result.code, result.stderr).toBe(0)
    expect(engine.olderAsked.map((asked) => [asked.anchor.id, asked.count])).toEqual([
      [oldest?.id, 10],
      [onPhone[9]?.id, 10],
      [onPhone[19]?.id, 10],
    ])
    expect(JSON.parse(result.stdout).item).toMatchObject({
      before: { gaps: [gap] },
      repaired: [gap],
      after: { gaps: [] },
      complete: true,
      requests: 3,
    })
    expect(engine.closed).toBe(true)
  })
})

const never = () => {
  throw new Error("the command that starts a job must not connect")
}

// The job's process is this test's next run(); the PID is this one's, so the job reads as running until it ends.
const jobLauncher = () => {
  const spawned: { argv: string[]; env: NodeJS.ProcessEnv }[] = []
  const spawnJob: SpawnJob = (argv, env) => {
    spawned.push({ argv, env })
    return process.pid
  }
  return { spawned, spawnJob }
}

const jobOf = async (profile: string, id: string) => {
  const shown = await wa([profile, "store", "jobs", "show", id, "--json"], never)
  expect(shown.code, shown.stderr).toBe(0)
  return JSON.parse(shown.stdout).item
}

// Each on an account of its own: a job still running on a chat refuses a second one there.
describe("messages sync --background", () => {
  it("starts the job without connecting; the job asks the phone, stores the page and closes the engine", async () => {
    const own = await ownAccount("bgsync", 6)
    const { spawned, spawnJob } = jobLauncher()
    const argv = ["bgsync", "messages", "sync", seed.busy, "--limit", "10", "--page-size", "5", "--pause", "1ms"]
    const started = await wa([...argv, "--no-catch-up", "--background", "--json"], never, undefined, { spawnJob })
    expect(started.code, started.stderr).toBe(0)
    const { job } = JSON.parse(started.stdout).item
    expect(spawned).toHaveLength(1)
    const [child] = spawned
    expect(child?.env.WA_PROFILE).toBe("bgsync")
    expect(child?.env.WA_BACKFILL_JOB).toBe(job)

    const engine = fakeEngine(own, { phone: onPhone })
    const ran = await wa(child?.argv ?? [], () => engine, undefined, { env: child?.env ?? {} })
    expect(ran.code, ran.stderr).toBe(0)
    expect(engine.olderAsked.map((asked) => asked.count)).toEqual([5, 5])
    expect(engine.closed).toBe(true)
    expect(await lookups(own.account.id).message(seed.busy, onPhone[9]?.id ?? "")).toMatchObject({ id: onPhone[9]?.id })
    expect(await jobOf("bgsync", job)).toMatchObject({ state: "done", fetched: 10 })
  })

  it("records the phone's silence as the job's failure, and still closes the engine", async () => {
    const own = await ownAccount("bgsilent", 7)
    const { spawned, spawnJob } = jobLauncher()
    const argv = ["bgsilent", "messages", "sync", seed.busy, "--pause", "1ms", "--no-catch-up", "--background"]
    const started = await wa([...argv, "--json"], never, undefined, { spawnJob })
    expect(started.code, started.stderr).toBe(0)
    const { job } = JSON.parse(started.stdout).item

    const engine = fakeEngine(own)
    const ran = await wa(spawned[0]?.argv ?? [], () => engine, undefined, { env: spawned[0]?.env ?? {} })
    expect(ran.code).not.toBe(0)
    expect(engine.olderAsked).toHaveLength(1)
    expect(engine.closed).toBe(true)
    expect(await jobOf("bgsilent", job)).toMatchObject({ state: "failed", error: { code: "timeout" } })
  })

  // serve offers no relay on Windows. A `--background` typed while serve runs is relayed too, and serve starts the
  // job from its own environment, which has no test seam; so the job here is started before serve.
  it.skipIf(process.platform === "win32")(
    "runs the job on serve's connection once serve holds the device, never on one of its own",
    async () => {
      const own = await ownAccount("bgserved", 10)
      const { spawned, spawnJob } = jobLauncher()
      const argv = ["bgserved", "messages", "sync", seed.busy, "--limit", "5", "--page-size", "5", "--pause", "1ms"]
      const started = await wa([...argv, "--no-catch-up", "--background", "--json"], never, undefined, { spawnJob })
      expect(started.code, started.stderr).toBe(0)
      const { job } = JSON.parse(started.stdout).item

      const lock = join(process.env.WA_STATE_DIR ?? "", "serve", "bgserved.lock")
      const controller = new AbortController()
      const served = fakeEngine(own, { phone: onPhone })
      const serving = wa(["bgserved", "serve", "--json"], () => served, controller.signal)
      await vi.waitFor(() => expect(JSON.parse(readFileSync(lock, "utf8")).relay).toBeDefined(), { timeout: 5000 })

      const ran = await wa(spawned[0]?.argv ?? [], never, undefined, { env: spawned[0]?.env ?? {} })
      expect(ran.code, ran.stderr).toBe(0)
      expect(served.olderAsked.map((asked) => asked.count)).toEqual([5])
      expect(served.closed).toBe(false)
      expect(await jobOf("bgserved", job)).toMatchObject({ state: "done", fetched: 5 })

      controller.abort()
      expect((await serving).code).toBe(0)
      expect(served.closed).toBe(true)
    },
  )

  it("refuses --all before starting a job: there is no chat list to walk", async () => {
    const { spawned, spawnJob } = jobLauncher()
    const result = await wa(["older", "messages", "sync", "--all", "--background", "--json"], never, undefined, {
      spawnJob,
    })
    expect(result.code).toBe(2)
    expect(JSON.parse(result.stderr).error.message).toContain("name one chat")
    expect(spawned).toEqual([])
  })
})

describe("store gaps repair --background", () => {
  const backgrounded = async (profile: string, n: number) => {
    const own = await ownAccount(profile, n)
    const key = { provider: "whatsapp", account: own.account.id }
    const at = (message?: { timestamp: string }) => Date.parse(message?.timestamp ?? "")
    const store = await opened
    await store.sync.markRange(key, seed.busy, at(oldest), at(inBusy.at(-1)))
    await store.sync.markRange(key, seed.busy, at(onPhone[30]), at(onPhone[20]))
    const { spawned, spawnJob } = jobLauncher()
    const argv = [profile, "store", "gaps", "repair", seed.busy, "--page-size", "10", "--pause", "1ms"]
    const started = await wa([...argv, "--no-catch-up", "--background", "--json"], never, undefined, { spawnJob })
    expect(started.code, started.stderr).toBe(0)
    return { own, job: JSON.parse(started.stdout).item.job, child: spawned[0] }
  }

  it("plans the gap from the store without connecting, and hands the job its bounds and the plan's fingerprint", async () => {
    const { job, child } = await backgrounded("bgplan", 8)
    expect(child?.env).toMatchObject({ WA_PROFILE: "bgplan", WA_BACKFILL_JOB: job })
    const argv = child?.argv ?? []
    const value = (option: string) => argv[argv.indexOf(option) + 1]
    expect(argv.slice(0, 4)).toEqual(["store", "gaps", "repair", seed.busy])
    expect(value("--page-size")).toBe("10")
    expect(value("--fingerprint")).toMatch(/\w/)
    for (const bound of ["--limit", "--max-gaps", "--repair-time"]) expect(value(bound)).toMatch(/^\d+\w*$/)
  })

  // cli-core 0.336.0 hands the job `--timeout 0`, which the job's own parser refuses, so the job never runs. This
  // passes once cli-core starts the job with a timeout it accepts; then drop `.fails`.
  it.fails("the job asks the phone for the gap and closes the engine", async () => {
    const { own, job, child } = await backgrounded("bggaps", 9)
    const engine = fakeEngine(own, { phone: onPhone })
    const ran = await wa(child?.argv ?? [], () => engine, undefined, { env: child?.env ?? {} })
    expect(ran.code, ran.stderr).toBe(0)
    expect(engine.olderAsked.map((asked) => asked.anchor.id)).toEqual([oldest?.id, onPhone[9]?.id, onPhone[19]?.id])
    expect(engine.closed).toBe(true)
    expect(await jobOf("bggaps", job)).toMatchObject({ state: "done" })
  })
})
