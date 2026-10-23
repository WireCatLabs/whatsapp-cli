import { existsSync, rmSync } from "node:fs"
import { CliError, indent } from "@wirecat/cli-base"
import { atTerminal, loginQr, readSecret } from "@wirecat/cli-core"
import {
  asFirstWord,
  environmentOf,
  type MessengerAdapter,
  type MessengerContext,
  secretInputOf,
} from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { type Environment, linkDevice } from "./messenger.js"
import { privateStore } from "./paths.js"

/**
 * Shown once, before the code that links the device. It ignores `--quiet` the way the QR code does: it belongs to
 * the prompt the person is answering, and after the link it is too late to read it.
 */
export const BAN_WARNING = [
  "Before you link: wa is not an official WhatsApp app, and WhatsApp may ban an account that uses one.",
  "It also bans accounts that send in bulk or write to people who do not know them.",
  "wa writes only when a command asks, sends at most 30 messages an hour by default, and holds every",
  "write when WhatsApp says to slow down or restricts the account. Never send in bulk or to strangers.",
].join("\n")

/** The phone pushes its history right after linking, once; how long to keep receiving it. */
export const HISTORY_WAIT: HistoryWait = { firstMs: 120_000, quietMs: 45_000, slowMs: 20_000 }

/** `slowMs`: with nothing pushed by then, say once that the wait goes on, so the silence does not read as a hang. */
export interface HistoryWait {
  firstMs: number
  quietMs: number
  slowMs?: number
}

export interface Received {
  chats: number
  messages: number
  people: number
}

/**
 * Saves what the phone pushes until it goes quiet or `signal` aborts. Live messages that arrive meanwhile are saved
 * too, through the same connection.
 */
export const receiveHistory = async (
  adapter: MessengerAdapter,
  wait: HistoryWait,
  onSlow: () => void,
  signal?: AbortSignal,
): Promise<Received> => {
  const received: Received = { chats: 0, messages: 0, people: 0 }
  const stop = new AbortController()
  const end = () => stop.abort()
  let timer = setTimeout(end, wait.firstMs)
  const slow = wait.slowMs === undefined ? undefined : setTimeout(onSlow, wait.slowMs)
  signal?.addEventListener("abort", end, { once: true })
  try {
    await Promise.all([
      adapter.feed?.((batch) => {
        received.chats += batch.chats?.length ?? 0
        received.messages += batch.messages?.length ?? 0
        received.people += batch.people?.length ?? 0
        clearTimeout(slow)
        clearTimeout(timer)
        timer = setTimeout(end, wait.quietMs)
      }, stop.signal),
      adapter.watch?.(() => {}, stop.signal),
    ])
  } finally {
    clearTimeout(slow)
    clearTimeout(timer)
    signal?.removeEventListener("abort", end)
  }
  return received
}

export interface StartSessionOptions {
  method: "qr" | "phone"
  /** The command as typed, for the messages that name it. */
  command?: string
  signal?: AbortSignal
  /** How far the questions and the QR code sit right, to line up under a setup step. */
  indent?: number
  /**
   * Ctrl+C, a cancel or --timeout ends the history wait alone, and the command answers with what was kept. A command
   * with steps after the wait calls `endUntilStopped()` when it returns, so those steps get a deadline again.
   */
  stopEndsWait?: boolean
}

export interface Session {
  profile: string
  account: { id: string; name: string | null }
  alreadyLinked: boolean
  /** Left out for a device linked before: nothing was pushed, so nothing was counted. */
  received?: Received
}

/** Links the profile's device unless it is linked already, then keeps the history the phone pushes once. */
export const startSession = async (
  command: Command,
  context: MessengerContext,
  { method, command: typed = "wa session start", signal, indent: pad = 0, stopEndsWait = false }: StartSessionOptions,
): Promise<Session> => {
  const input = context.stdin
  const terminal = atTerminal(input)
  const unanswerable = () =>
    new CliError("validation_error", `${typed} asks questions — run it in a terminal`, {
      reason: "input.required",
    })
  // A device that is linked already asks nothing, so only a profile without one is refused before the engine starts.
  if (!terminal && method === "phone" && !existsSync(privateStore(context.profile, context.env))) throw unanswerable()
  const qr = loginQr({
    diagnostic: context.streams.diagnostic,
    note: context.renderer.note,
    indent: pad,
    terminal,
    json: context.format !== "pretty",
  })
  const environment = environmentOf<Environment>(command)

  const linked = await linkDevice(command, context, {
    method,
    beforeLink: () => {
      signal?.throwIfAborted()
      if (!terminal && method === "phone") throw unanswerable()
      context.streams.diagnostic(indent(BAN_WARNING, pad))
    },
    phone: async () => {
      if (!terminal)
        throw new CliError("validation_error", `${typed} phone needs a terminal to ask for the number`, {
          reason: "input.required",
        })
      const number = await readSecret(`${" ".repeat(pad)}phone number, international format: `, {
        ...secretInputOf(command),
        echo: true,
        ...(signal === undefined ? {} : { signal }),
      })
      // WhatsApp reads the leading digits as the country code, so a number typed without one pairs someone else's.
      if (!number.trim().startsWith("+"))
        throw new CliError("validation_error", "write the phone number with + and the country code, such as +34", {
          param: "phone",
          reason: "input.invalid",
        })
      return number
    },
    onCode: ({ login, code }) => {
      if (login === "pair") {
        context.renderer.note(
          `pairing code: ${code}\n` +
            "On the phone: tap the WhatsApp notification, or Settings > Linked devices > Link a device >\n" +
            "Link with phone number instead, and type the code. It expires in about two minutes.",
        )
        return
      }
      qr.show(code, "scan in WhatsApp → Settings → Linked devices → Link a device")
    },
  })
  signal?.throwIfAborted()

  const session: Session = { profile: context.profile, account: linked.account, alreadyLinked: linked.alreadyLinked }
  if (!linked.alreadyLinked) {
    context.renderer.note(
      "receiving history from the phone; keep WhatsApp open on it. Ctrl+C stops — `serve` picks up the rest.",
    )
    const stop = stopEndsWait ? environment.untilStopped?.() : environment.signal
    const ended = AbortSignal.any([signal, stop].filter((one) => one !== undefined))
    session.received = await context.withMessenger(
      (adapter) =>
        receiveHistory(
          adapter,
          environment.historyWait ?? HISTORY_WAIT,
          () =>
            context.renderer.note(
              "still waiting for the phone's history — keep WhatsApp open on the phone; it can take a minute",
            ),
          ended,
        ),
      { listen: true },
    )
  }
  return session
}

export const endSession = async (
  context: Pick<MessengerContext, "profile" | "env" | "withMessenger">,
): Promise<{
  profile: string
  ended: boolean
  alreadyDropped?: boolean
}> => {
  const store = privateStore(context.profile, context.env)
  if (!existsSync(store)) {
    return { profile: context.profile, ended: false }
  }
  let dropped = false
  try {
    await context.withMessenger((adapter) => adapter.logout())
  } catch (error) {
    if (error instanceof CliError && error.details.reason === "device.in-use")
      throw new CliError(
        "provider_unavailable",
        `${error.message} — stop it first (\`wa ${asFirstWord(context.profile)}server stop\` for serve, or Ctrl+C ` +
          "where it runs), then end the session",
        { ...error.details, sent: false },
      )
    // The phone may have removed the device already; the keys here are then worth nothing, and still go.
    if (!(error instanceof CliError && error.code === "authentication_error")) throw error
    dropped = true
  }
  for (const suffix of ["", "-wal", "-shm", ".lock"]) rmSync(`${store}${suffix}`, { force: true })
  return { profile: context.profile, ended: true, ...(dropped ? { alreadyDropped: true } : {}) }
}
