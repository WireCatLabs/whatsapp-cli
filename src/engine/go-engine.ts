import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"
import * as v from "valibot"
import {
  EngineError,
  engineError,
  engineEvent,
  hello,
  type LoginCode,
  loginCode,
  PROTOCOL,
  type WaAccount,
  type WhatsAppEngine,
  waAccount,
  waChat,
  waChatCard,
  waMessage,
} from "./contract.js"
import { eventHub } from "./events.js"

export interface GoEngineOptions {
  /** The profile's `private.db`. */
  storePath: string
  /** Who holds the connection — `serve`, `messages send` — named to anyone the lock refuses. */
  holder: string
  /** Allows an empty store: this run links a new device. */
  link?: boolean
  env?: NodeJS.ProcessEnv
  /** The engine's own diagnostics, fixed wording only. */
  warn?: (line: string) => void
  /** Tests run a stand-in: the program, and the arguments before the engine's own. */
  command?: { file: string; args: string[] }
}

const HELLO_WAIT_MS = 15_000
const CLOSE_WAIT_MS = 5_000

const STOPPED = () => new EngineError("provider_unavailable", "the WhatsApp engine stopped unexpectedly")

/** `WA_ENGINE`, else the binary `pnpm engine:build` writes beside the sources. */
export const engineBinary = (env: NodeJS.ProcessEnv = process.env): string =>
  env.WA_ENGINE ||
  fileURLToPath(new URL(`../../engine/bin/wa-engine${process.platform === "win32" ? ".exe" : ""}`, import.meta.url))

const missing = () =>
  new EngineError(
    "provider_unavailable",
    "the WhatsApp engine is not installed — build it with `pnpm engine:build`, or set WA_ENGINE to its path",
  )

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

/**
 * Runs the Go engine as a child process and speaks JSON lines with it. It starts the engine and waits for its hello;
 * a refusal there (the lock is held, the profile is not linked) rejects with the engine's own code and wording.
 */
export const startGoEngine = async (options: GoEngineOptions): Promise<WhatsAppEngine> => {
  const env = options.env ?? process.env
  const command = options.command ?? { file: engineBinary(env), args: [] }
  const args = [
    ...command.args,
    "--store",
    options.storePath,
    "--holder",
    options.holder,
    ...(options.link ? ["--link"] : []),
  ]
  const child = spawn(command.file, args, { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true })
  const hub = eventHub()
  const pending = new Map<number, Pending>()
  let nextId = 1
  let self: string | null = null
  let closing = false
  let exited = false
  let onCode: ((code: LoginCode) => void) | undefined
  let greet: { resolve: () => void; reject: (error: Error) => void } | undefined
  // A binary that never started fires "error" and no "exit".
  const exit = new Promise<void>((resolve) => {
    child.once("exit", () => resolve())
    child.once("error", () => resolve())
  })

  const failAll = (error: Error) => {
    greet?.reject(error)
    for (const waiting of pending.values()) waiting.reject(error)
    pending.clear()
  }

  child.once("error", (error: NodeJS.ErrnoException) => {
    exited = true
    failAll(error.code === "ENOENT" || error.code === "EACCES" ? missing() : STOPPED())
  })
  child.once("exit", () => {
    exited = true
    failAll(STOPPED())
    if (!closing) hub.emit({ event: "connection", state: "stopped" })
  })
  child.stdin?.on("error", () => {})
  createInterface({ input: child.stderr as NodeJS.ReadableStream }).on("line", (line) => options.warn?.(line))

  const onLine = (line: string) => {
    let value: Record<string, unknown>
    try {
      value = JSON.parse(line)
    } catch {
      return
    }
    if ("hello" in value) {
      const said = v.parse(hello, value.hello)
      if (said.protocol !== PROTOCOL) {
        greet?.reject(
          new EngineError(
            "provider_unavailable",
            `the WhatsApp engine speaks protocol ${said.protocol}, this wa needs ${PROTOCOL} — reinstall wa`,
          ),
        )
        return
      }
      self = said.self
      greet?.resolve()
    } else if ("refused" in value) {
      const refused = v.parse(engineError, value.refused)
      greet?.reject(new EngineError(refused.code, refused.message))
    } else if ("login" in value) {
      onCode?.(v.parse(loginCode, value))
    } else if ("event" in value) {
      const event = v.safeParse(engineEvent, value)
      if (event.success) hub.emit(event.output)
      else options.warn?.("the WhatsApp engine sent an event this wa cannot read; it was skipped")
    } else if (typeof value.id === "number") {
      const waiting = pending.get(value.id)
      pending.delete(value.id)
      if (!waiting) return
      if ("error" in value) {
        const refused = v.parse(engineError, value.error)
        waiting.reject(new EngineError(refused.code, refused.message))
      } else waiting.resolve(value.ok)
    }
  }
  createInterface({ input: child.stdout as NodeJS.ReadableStream }).on("line", onLine)

  const request = <T>(op: string, fields: Record<string, unknown>, schema: v.GenericSchema<unknown, T>): Promise<T> => {
    if (exited) return Promise.reject(STOPPED())
    const id = nextId++
    const answer = new Promise<unknown>((resolve, reject) => pending.set(id, { resolve, reject }))
    child.stdin?.write(`${JSON.stringify({ id, op, ...fields })}\n`)
    return answer.then((value) => v.parse(schema, value))
  }

  const close = async () => {
    if (closing) return exit
    closing = true
    if (!exited) {
      const asked = request("close", {}, v.unknown()).catch(() => {})
      child.stdin?.end()
      await Promise.race([asked.then(() => exit), delay(CLOSE_WAIT_MS)])
      if (!exited) child.kill("SIGKILL")
    }
    await exit
  }

  try {
    await new Promise<void>((resolve, reject) => {
      greet = { resolve, reject }
      setTimeout(
        () => reject(new EngineError("timeout", "the WhatsApp engine did not start in time")),
        HELLO_WAIT_MS,
      ).unref()
    })
  } catch (error) {
    await close()
    throw error
  } finally {
    greet = undefined
  }

  let connecting: Promise<unknown> | undefined
  const nothing = v.nullable(v.unknown())

  return {
    self: () => self,
    ready: async (signal) => {
      connecting ??= request("connect", {}, nothing)
      await Promise.race([connecting, aborted(signal)])
    },
    me: () => request("me", {}, waAccount),
    directory: () => request("directory", {}, v.array(waChat)),
    chat: (jid) => request("chat", { jid }, waChatCard),
    send: ({ chat, text, id, replyTo }) =>
      request("send", { chat, text, sendId: id, ...(replyTo === undefined ? {} : { replyTo }) }, waMessage),
    link: async (linking, show): Promise<WaAccount> => {
      onCode = show
      try {
        const account = await request("link", { ...linking }, waAccount)
        self = account.jid
        return account
      } finally {
        onCode = undefined
      }
    },
    logout: async () => {
      await request("logout", {}, nothing)
      self = null
    },
    listen: (kinds, onEvent) => hub.listen(kinds, onEvent),
    close,
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms).unref())

const aborted = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) resolve()
    signal.addEventListener("abort", () => resolve(), { once: true })
  })
