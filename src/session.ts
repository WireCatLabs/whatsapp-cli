import { existsSync, rmSync } from "node:fs"
import { CliError, indent } from "@wirecat/cli-base"
import { atTerminal, loginQr, readSecret } from "@wirecat/cli-core"
import {
  asFirstWord,
  environmentOf,
  type HistoryBatch,
  type MessengerAdapter,
  type MessengerContext,
  secretInputOf,
  signInSteps,
} from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { type Environment, linkDevice } from "./messenger.js"
import { privateStore } from "./paths.js"
import { phoneSyncDone } from "./phone-sync.js"

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

const PAIR_WHERE =
  "WhatsApp on the phone: tap its notification, or Settings → Linked devices → Link a device → Link with phone number instead"

/**
 * The phone pushes its history right after linking, once, and says when it is done (its sync progress reaches 100).
 * `firstMs` and `quietMs` only matter when it never says so, and a big account can pause for minutes between chunks
 * while the phone prepares the next: 45 s cut such a link short, and the phone then reported the link as failed. Five
 * minutes is a guess, about seven times the old limit; it only has to end the command when the phone has gone away.
 */
export const HISTORY_WAIT: HistoryWait = { firstMs: 300_000, quietMs: 300_000, slowMs: 20_000 }

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
 * Saves what the phone pushes until it says its history is complete, or goes quiet for `wait.quietMs`, or `signal`
 * aborts. `onUnconfirmed` runs when the wait ended on the quiet timer: the phone may not be finished. Live messages
 * that arrive meanwhile are saved too, through the same connection.
 */
export const receiveHistory = async (
  adapter: MessengerAdapter,
  wait: HistoryWait,
  onSlow: () => void,
  signal?: AbortSignal,
  onUnconfirmed: () => void = () => {},
): Promise<Received> => {
  const received: Received = { chats: 0, messages: 0, people: 0 }
  const writes: Promise<void>[] = []
  const stop = new AbortController()
  let confirmed = false
  let timedOut = false
  const end = () => stop.abort()
  const giveUp = () => {
    timedOut = true
    end()
  }
  let timer = setTimeout(giveUp, wait.firstMs)
  const slow = wait.slowMs === undefined ? undefined : setTimeout(onSlow, wait.slowMs)
  signal?.addEventListener("abort", end, { once: true })
  try {
    await Promise.all([
      adapter.feed?.((batch: HistoryBatch, saved?: Promise<boolean>) => {
        // Counted once the store has it: a store that cannot write keeps nothing, and the link must not say kept.
        const count = (stored: boolean) => {
          if (!stored) return
          received.chats += batch.chats?.length ?? 0
          received.messages += batch.messages?.length ?? 0
          received.people += batch.people?.length ?? 0
        }
        if (saved) writes.push(saved.then(count))
        else count(true)
        clearTimeout(slow)
        clearTimeout(timer)
        if (phoneSyncDone(batch)) {
          confirmed = true
          end()
        } else timer = setTimeout(giveUp, wait.quietMs)
      }, stop.signal),
      adapter.watch?.(() => {}, stop.signal),
    ])
  } finally {
    clearTimeout(slow)
    clearTimeout(timer)
    signal?.removeEventListener("abort", end)
  }
  await Promise.all(writes)
  if (timedOut && !confirmed) onUnconfirmed()
  return received
}

export interface StartSessionOptions {
  method: "qr" | "phone"
  /** The command as typed, for the messages that name it. */
  command?: string
  signal?: AbortSignal
  /** How far the questions and the QR code sit right, to line up under a setup step. */
  indent?: number
  /** `--answer-stdin`: the phone number is a `needs` line, answered on stdin by the window that started the link. */
  answers?: boolean
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
  {
    method,
    command: typed = "wa session start",
    signal,
    indent: pad = 0,
    stopEndsWait = false,
    answers = false,
  }: StartSessionOptions,
): Promise<Session> => {
  const input = context.stdin
  const terminal = atTerminal(input)
  const steps = signInSteps({
    diagnostic: context.streams.diagnostic,
    json: context.format !== "pretty",
    answers,
    input,
  })
  const noAnswers = !terminal && !answers
  const unanswerable = () =>
    new CliError("validation_error", `${typed} asks questions — run it in a terminal`, {
      reason: "input.required",
    })
  // A device that is linked already asks nothing, so only a profile without one is refused before the engine starts.
  if (noAnswers && method === "phone" && !existsSync(privateStore(context.profile, context.env))) throw unanswerable()
  const qr = loginQr({
    diagnostic: context.streams.diagnostic,
    note: context.renderer.note,
    indent: pad,
    terminal,
    json: context.format !== "pretty",
  })
  const environment = environmentOf<Environment>(command)
  const typedNumber = () => {
    if (!terminal)
      throw new CliError("validation_error", `${typed} phone needs a terminal to ask for the number`, {
        reason: "input.required",
      })
    return readSecret(`${" ".repeat(pad)}phone number, international format: `, {
      ...secretInputOf(command),
      echo: true,
      ...(signal === undefined ? {} : { signal }),
    })
  }

  const linked = await linkDevice(command, context, {
    method,
    beforeLink: () => {
      signal?.throwIfAborted()
      if (noAnswers && method === "phone") throw unanswerable()
      context.streams.diagnostic(indent(BAN_WARNING, pad))
    },
    phone: async () => {
      const number = answers
        ? await steps.ask(
            {
              field: "phone",
              secret: false,
              prompt: "phone number, international format",
              hint: "with + and the country code, such as +34",
            },
            signal,
          )
        : await typedNumber()
      // WhatsApp reads the leading digits as the country code, so a number typed without one pairs someone else's.
      if (!number.trim().startsWith("+"))
        throw new CliError("validation_error", "write the phone number with + and the country code, such as +34", {
          param: "phone",
          reason: "input.invalid",
        })
      return number
    },
    onCode: ({ login, code, expires }) => {
      if (login === "pair") {
        if (steps.json) steps.pairingCode(code, PAIR_WHERE)
        else
          context.renderer.note(
            `pairing code: ${code}\n` +
              "On the phone: tap the WhatsApp notification, or Settings > Linked devices > Link a device >\n" +
              "Link with phone number instead, and type the code. It expires in about two minutes.",
          )
        return
      }
      qr.show(
        code,
        "scan in WhatsApp → Settings → Linked devices → Link a device",
        expires === undefined ? undefined : new Date(expires),
      )
    },
  })
  signal?.throwIfAborted()

  const session: Session = { profile: context.profile, account: linked.account, alreadyLinked: linked.alreadyLinked }
  if (!linked.alreadyLinked) {
    const say = (step: "history" | "waiting", message: string) =>
      steps.json ? steps.progress(step, message) : context.renderer.note(message)
    say(
      "history",
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
            say(
              "waiting",
              "still waiting for the phone's history — keep WhatsApp open on the phone; it can take a minute",
            ),
          ended,
          () =>
            say(
              "waiting",
              "the phone did not say its history is complete; wa stopped waiting. Keep WhatsApp open on the phone " +
                "until it finishes linking — `serve` picks up whatever it sends later.",
            ),
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
