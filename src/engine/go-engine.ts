import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import * as v from "valibot"
import { engineBinary, enginePackage } from "../engine-binary.js"
import {
  EngineError,
  engineError,
  engineEvent,
  hello,
  keyFields,
  type LoginCode,
  loginCode,
  PROTOCOL,
  type WaAccount,
  type WaQuote,
  type WhatsAppEngine,
  waAccount,
  waChat,
  waChatCard,
  waMessage,
  waOlder,
} from "./contract.js"
import { eventHub } from "./events.js"
import { goGroups } from "./groups.js"
import { goPrivacy } from "./privacy.js"
import { goSettings } from "./settings.js"

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

const STOPPED = () =>
  new EngineError("provider_unavailable", "the WhatsApp engine stopped unexpectedly", "engine.stopped")

/** Requests that change something on WhatsApp: cut by the engine's end, they may have gone out. */
const WRITES = new Set([
  "send",
  "sendMedia",
  "sendAlbum",
  "forward",
  "edit",
  "revoke",
  "react",
  "read",
  "createPoll",
  "vote",
  "pin",
  "unpin",
  "createGroup",
  "join",
  "leave",
  "updateGroup",
  "setGroupPhoto",
  "resetLink",
  "participants",
  "answerRequest",
  "block",
  "setPrivacy",
  "mute",
  "updateProfile",
  "deleteChat",
  "clearChat",
  "deleteForMe",
  "star",
  "logout",
])

const CUT = () =>
  new EngineError(
    "outcome_unknown",
    "the WhatsApp engine stopped before WhatsApp confirmed the change; it may have gone through — check first",
    "engine.stopped-mid-write",
  )

const missing = () =>
  new EngineError(
    "provider_unavailable",
    `the WhatsApp engine is not installed — ${enginePackage()} is missing: reinstall @wirecat/whatsapp-cli ` +
      "without --omit=optional, or set WA_ENGINE to the engine's path",
  )

interface Pending {
  op: string
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
    child.once("close", () => resolve())
    child.once("error", () => resolve())
  })

  const failAll = (error: () => Error) => {
    greet?.reject(error())
    for (const waiting of pending.values()) waiting.reject(WRITES.has(waiting.op) ? CUT() : error())
    pending.clear()
  }

  child.once("error", (error: NodeJS.ErrnoException) => {
    exited = true
    failAll(error.code === "ENOENT" || error.code === "EACCES" ? missing : STOPPED)
  })
  // "close", not "exit": an answer the engine wrote just before it ended is still in the pipe at "exit".
  child.once("close", () => {
    exited = true
    failAll(STOPPED)
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
      greet?.reject(new EngineError(refused.code, refused.message, refused.reason, refused.until))
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
        waiting.reject(new EngineError(refused.code, refused.message, refused.reason, refused.until))
      } else waiting.resolve(value.ok)
    }
  }
  createInterface({ input: child.stdout as NodeJS.ReadableStream }).on("line", onLine)

  const request = <T>(op: string, fields: Record<string, unknown>, schema: v.GenericSchema<unknown, T>): Promise<T> => {
    if (exited) return Promise.reject(STOPPED())
    const id = nextId++
    const answer = new Promise<unknown>((resolve, reject) => pending.set(id, { op, resolve, reject }))
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
    send: ({ chat, text, id, replyTo, quoted }) =>
      request("send", { chat, text, sendId: id, ...replyFields(replyTo, quoted) }, waMessage),
    edit: (key, text) => request("edit", { ...keyFields(key), text }, waMessage),
    revoke: async (key) => {
      await request("revoke", keyFields(key), nothing)
    },
    react: async (key, emoji) => {
      await request("react", { ...keyFields(key), emoji }, nothing)
    },
    markRead: async (key) => {
      await request("read", keyFields(key), nothing)
    },
    sendMedia: ({ chat, text, id, replyTo, quoted, file }) =>
      request("sendMedia", { chat, text, sendId: id, file, ...replyFields(replyTo, quoted) }, waMessage),
    sendAlbum: ({ chat, text, id, replyTo, quoted, files }) =>
      request("sendAlbum", { chat, text, sendId: id, files, ...replyFields(replyTo, quoted) }, waMessage),
    download: async (attachment, path) => {
      await request("download", { attachment, path }, nothing)
    },
    forward: ({ chat, id, text, attachment }) =>
      request("forward", { chat, sendId: id, text, ...(attachment ? { attachment } : {}) }, waMessage),
    older: (anchor, count) => request("older", { ...keyFields(anchor), timestamp: anchor.timestamp, count }, waOlder),
    createPoll: ({ chat, id, question, answers, multiple }) =>
      request("createPoll", { chat, sendId: id, question, answers, ...(multiple ? { multiple } : {}) }, waMessage),
    vote: async (key, answers) => {
      await request("vote", { ...keyFields(key), answers }, nothing)
    },
    pin: async (key, duration) => {
      await request("pin", { ...keyFields(key), ...(duration === undefined ? {} : { duration }) }, nothing)
    },
    unpin: async (key) => {
      await request("unpin", keyFields(key), nothing)
    },
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
    ...goGroups(request),
    ...goPrivacy(request),
    ...goSettings(request),
  }
}

const replyFields = (replyTo: string | undefined, quoted: WaQuote | undefined) => ({
  ...(replyTo === undefined ? {} : { replyTo }),
  ...(quoted === undefined
    ? {}
    : {
        quote: {
          fromMe: quoted.fromMe,
          text: quoted.text,
          ...(quoted.sender === null ? {} : { sender: quoted.sender }),
        },
      }),
})

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms).unref())

const aborted = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) resolve()
    signal.addEventListener("abort", () => resolve(), { once: true })
  })
