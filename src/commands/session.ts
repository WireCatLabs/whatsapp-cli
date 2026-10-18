import { chmodSync, existsSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { CliError, indent, singleLine } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { qrPng, readSecret, terminalQr } from "@wirecat/cli-core"
import {
  asFirstWord,
  commandWords,
  environmentOf,
  inputPolicy,
  logsInOrOut,
  type MessengerAdapter,
  type MessengerContext,
  messengerContext,
  printItem,
  REMOTE_WRITE,
  refuseCommandName,
  rootOf,
  secretInputOf,
} from "@wirecat/cli-core/cli"
import { Argument, Command } from "commander"
import { type Environment, linkDevice, WHATSAPP } from "../messenger.js"
import { privateStore } from "../paths.js"

/** The phone pushes its history right after linking, once; how long to keep receiving it. */
export const HISTORY_WAIT = { firstMs: 120_000, quietMs: 45_000 }

export interface Received {
  chats: number
  messages: number
  people: number
}

/**
 * Saves what the phone pushes until it goes quiet or `signal` aborts. Live messages that arrive meanwhile are saved
 * too, through the same connection.
 */
const receiveHistory = async (adapter: MessengerAdapter, wait: typeof HISTORY_WAIT, signal?: AbortSignal) => {
  const received: Received = { chats: 0, messages: 0, people: 0 }
  const stop = new AbortController()
  const end = () => stop.abort()
  let timer = setTimeout(end, wait.firstMs)
  signal?.addEventListener("abort", end, { once: true })
  try {
    await Promise.all([
      adapter.feed?.((batch) => {
        received.chats += batch.chats?.length ?? 0
        received.messages += batch.messages?.length ?? 0
        received.people += batch.people?.length ?? 0
        clearTimeout(timer)
        timer = setTimeout(end, wait.quietMs)
      }, stop.signal),
      adapter.watch?.(() => {}, stop.signal),
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", end)
  }
  return received
}

const linkedText = (profile: string, account: { name: string | null }, got: Received | undefined) => {
  const word = asFirstWord(profile)
  const name = account.name === null ? "you" : singleLine(account.name)
  return [
    got
      ? `Linked as ${name} — profile ${profile}.`
      : `Already linked as ${name} — profile ${profile}; nothing was asked. ` +
        `\`wa ${word}session end\` first to link again.`,
    ...(got ? [`History: ${got.chats} chats, ${got.messages} messages kept from the phone.`] : []),
    `Next:    wa ${word}chats list · wa ${word}server install to keep receiving`,
  ].join("\n")
}

export interface StartSessionOptions {
  method: "qr" | "phone"
  qrFile?: string
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
  {
    method,
    qrFile,
    command: typed = "wa session start",
    signal,
    indent: pad = 0,
    stopEndsWait = false,
  }: StartSessionOptions,
): Promise<Session> => {
  const input = context.stdin
  const terminal = input.isTTY === true && !inputPolicy(input).noInput
  if (qrFile !== undefined && method !== "qr")
    throw new CliError("validation_error", "--qr-file is for a QR login", { param: "--qr-file" })
  const unanswerable = () =>
    new CliError(
      "validation_error",
      `${typed} shows a code to scan or type — run it in a terminal, or pass --qr-file`,
      {
        reason: "input.required",
      },
    )
  // A device that is linked already asks nothing, so only a profile without one is refused before the engine starts.
  if (!terminal && qrFile === undefined && !existsSync(privateStore(context.profile, context.env))) throw unanswerable()
  const qrPath = qrFile === undefined ? undefined : resolve(qrFile)
  const environment = environmentOf<Environment>(command)
  // A cut command never reaches its own finally in time; the image links the account while it is valid.
  if (qrPath) environment.trackCloseable?.({ close: async () => rmSync(qrPath, { force: true }) })

  try {
    const linked = await linkDevice(command, context, {
      method,
      beforeLink: () => {
        signal?.throwIfAborted()
        if (!terminal && qrFile === undefined) throw unanswerable()
      },
      phone: async () => {
        if (!terminal)
          throw new CliError("validation_error", `${typed} phone needs a terminal to ask for the number`, {
            reason: "input.required",
          })
        return readSecret(`${" ".repeat(pad)}phone number, international format: `, {
          ...secretInputOf(command),
          echo: true,
          ...(signal === undefined ? {} : { signal }),
        })
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
        context.renderer.note("scan in WhatsApp → Settings → Linked devices → Link a device")
        if (!qrPath) {
          context.streams.diagnostic(`\n${indent(terminalQr(code).text, pad + 2)}`)
          return
        }
        writeFileSync(qrPath, qrPng(code), { mode: 0o600 })
        chmodSync(qrPath, 0o600)
        context.renderer.note(`the QR code is in ${qrPath} — it is replaced when WhatsApp renews it`)
      },
    })
    if (qrPath) rmSync(qrPath, { force: true })
    signal?.throwIfAborted()

    const session: Session = { profile: context.profile, account: linked.account, alreadyLinked: linked.alreadyLinked }
    if (!linked.alreadyLinked) {
      context.renderer.note(
        "receiving history from the phone; keep WhatsApp open on it. Ctrl+C stops — `serve` picks up the rest.",
      )
      const stop = stopEndsWait ? environment.untilStopped?.() : environment.signal
      const ended = AbortSignal.any([signal, stop].filter((one) => one !== undefined))
      session.received = await context.withMessenger(
        (adapter) => receiveHistory(adapter, environment.historyWait ?? HISTORY_WAIT, ended),
        { listen: true },
      )
    }
    return session
  } finally {
    // The image links the account for as long as it is valid; it does not outlive the login.
    if (qrPath) rmSync(qrPath, { force: true })
  }
}

const end = async (command: Command) => {
  const context = messengerContext(command, WHATSAPP)
  const store = privateStore(context.profile, context.env)
  if (!existsSync(store)) {
    printItem(context, { profile: context.profile, ended: false })
    return
  }
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
    context.renderer.note("WhatsApp no longer knew this device; removing the keys here")
  }
  for (const suffix of ["", "-wal", "-shm", ".lock"]) rmSync(`${store}${suffix}`, { force: true })
  printItem(context, { profile: context.profile, ended: true })
}

export const sessionCommand = () => {
  // Linking waits for a person, and unlinking removes the owner's device: neither is an agent's call.
  const session = annotate(new Command("session"), { mcp: false }).description(
    "link this profile to WhatsApp as a device, or unlink it",
  )

  annotate(logsInOrOut(session.command("start")), {
    effects: REMOTE_WRITE,
    lifetime: "interactive",
    examples: ["wa personal session start", "wa personal session start phone"],
  })
    .description("link by QR code (default) or a pairing code, then keep the pushed history")
    .addArgument(new Argument("[method]", "how to link").choices(["qr", "phone"]).default("qr"))
    .option("--qr-file <png>", "write the QR code to this PNG instead of drawing it, for an agent to pass on")
    .addHelpText(
      "after",
      "\nFirst time? Use `wa personal setup` for linking, a check of five chats and an agent skill.\n" +
        "\nqr: scan the code in WhatsApp > Settings > Linked devices > Link a device.\n" +
        "phone: type your number here, then type the code WhatsApp shows here into the phone.\n" +
        "\nRight after linking, the phone pushes your history once; this command keeps it in the local store\n" +
        "until the phone goes quiet. Then run `wa <profile> server install` to keep receiving.\n" +
        "Agents: --qr-file writes the QR as a PNG (mode 600) and removes it after the login.\n",
    )
    .action(async function (this: Command, method: "qr" | "phone") {
      const context = messengerContext(this, WHATSAPP)
      refuseCommandName(context.profile, commandWords(rootOf(this)), "wa")
      const { qrFile } = this.opts<{ qrFile?: string }>()
      const session = await startSession(this, context, {
        command: `wa ${asFirstWord(context.profile)}session start`,
        method,
        stopEndsWait: true,
        ...(qrFile === undefined ? {} : { qrFile }),
      })
      if (context.format === "pretty")
        context.streams.data(linkedText(context.profile, session.account, session.received))
      else
        printItem(context, {
          profile: session.profile,
          account: session.account,
          already_linked: session.alreadyLinked,
          ...(session.received ? { received: session.received } : {}),
        })
    })

  annotate(logsInOrOut(session.command("end")), { effects: REMOTE_WRITE, examples: ["wa personal session end"] })
    .description("unlink this device on WhatsApp's side and delete its keys here")
    .action(async function (this: Command) {
      await end(this)
    })

  return session
}
