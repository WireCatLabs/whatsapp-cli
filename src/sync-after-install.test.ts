import { captureStreams } from "@wirecat/cli-base"
import { contractSeed, syncAfterInstallCases } from "@wirecat/cli-core/testing"
import { beforeAll, describe, expect, it } from "vitest"
import type { WaMessage, WhatsAppEngine } from "./engine/contract.js"
import { run } from "./program.js"
import { fakeEngine, whatsAppIds } from "./testing/fake-engine.js"

const seed = contractSeed({ ids: whatsAppIds })
const oldest = seed.messages.find((message) => message.chatId === seed.busy)
const onPhone: WaMessage[] = [
  {
    id: "3EB0000000000000000P00",
    chat: seed.busy,
    sender: seed.person,
    senderName: null,
    fromMe: false,
    timestamp: new Date(Date.parse(oldest?.timestamp ?? "") - 3_600_000).toISOString(),
    editedAt: null,
    text: "synthetic older text",
    replyTo: null,
  },
]

const wa = async (argv: string[], engine: () => WhatsAppEngine, env?: NodeJS.ProcessEnv, signal?: AbortSignal) => {
  const streams = captureStreams()
  const code = await run(argv, {
    streams,
    tty: false,
    engine,
    ...(signal ? { signal } : {}),
    ...(env ? { env: { ...process.env, ...env } } : {}),
  })
  return { code, err: streams.stderr.join("") }
}

// The phone's first history push fills the store; a sync asks only for what is older.
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
  expect((await wa(["fresh", "watch", "--jsonl"], filling, undefined, controller.signal)).code).toBe(0)
})

describe("sync runs right after install, whatever the shared WireCat config holds", () => {
  for (const one of syncAfterInstallCases({
    sync: ["fresh", "messages", "sync", seed.busy, "--limit", "50", "--pause", "1ms", "--no-catch-up"],
    run: (argv, env) => wa(argv, () => fakeEngine(seed, { phone: onPhone }), env),
  }))
    it(one.name, () => one.run())
})
