import { chmodSync, existsSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { CliError, indent, type Renderer, type RenderFormat } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { qrPng, readSecret, terminalQr } from "@wirecat/cli-core"
import {
  asFirstWord,
  environmentOf,
  inputPolicy,
  itemOf,
  jsonlRecords,
  type MessengerAdapter,
  type MessengerContext,
  messengerContext,
  REMOTE_WRITE,
  sealed,
} from "@wirecat/cli-core/cli"
import { Argument, Command } from "commander"
import { type Environment, linkDevice, WHATSAPP } from "../messenger.js"
import { privateStore } from "../paths.js"

/** The phone pushes its history right after linking, once; how long to keep receiving it. */
export const HISTORY_WAIT = { firstMs: 120_000, quietMs: 45_000 }

interface Received {
  chats: number
  messages: number
  people: number
}

const printItem = ({ renderer, format }: { renderer: Renderer; format: RenderFormat }, item: unknown): void => {
  if (format === "json") renderer.result(sealed(itemOf(item)))
  else if (format === "jsonl") renderer.stream(jsonlRecords(itemOf(item)))
  else renderer.result(item)
}

/**
 * Saves what the phone pushes until it goes quiet, Ctrl+C, or the caller's signal. Live messages that arrive
 * meanwhile are saved too, through the same connection.
 */
const receiveHistory = async (adapter: MessengerAdapter, wait: typeof HISTORY_WAIT, signal?: AbortSignal) => {
  const received: Received = { chats: 0, messages: 0, people: 0 }
  const stop = new AbortController()
  const end = () => stop.abort()
  let timer = setTimeout(end, wait.firstMs)
  signal?.addEventListener("abort", end, { once: true })
  process.once("SIGINT", end)
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
    process.off("SIGINT", end)
    signal?.removeEventListener("abort", end)
  }
  return received
}

const linkedText = (profile: string, account: { name: string | null }, alreadyLinked: boolean, got: Received) => {
  const word = asFirstWord(profile)
  return [
    alreadyLinked
      ? `Already linked as ${account.name ?? "you"} — profile ${profile}; nothing was asked. ` +
        `\`wa ${word}session end\` first to link again.`
      : `Linked as ${account.name ?? "you"} — profile ${profile}.`,
    ...(alreadyLinked ? [] : [`History: ${got.chats} chats, ${got.messages} messages kept from the phone.`]),
    `Next:    wa ${word}chats list · wa ${word}server install to keep receiving`,
  ].join("\n")
}

const start = async (command: Command, method: "qr" | "phone", qrFile: string | undefined) => {
  const context: MessengerContext = messengerContext(command, WHATSAPP)
  const typed = `wa ${asFirstWord(context.profile)}session start`
  const input = context.stdin
  const terminal = input.isTTY === true && !inputPolicy(input).noInput
  if (qrFile !== undefined && method !== "qr") throw new CliError("validation_error", "--qr-file is for a QR login")
  if (!terminal && qrFile === undefined)
    throw new CliError(
      "validation_error",
      `${typed} shows a code to scan or type — run it in a terminal, or pass --qr-file`,
    )
  const qrPath = qrFile === undefined ? undefined : resolve(qrFile)
  const environment = environmentOf<Environment>(command)

  try {
    const linked = await linkDevice(command, context, {
      method,
      phone: async () => {
        if (!terminal) throw new CliError("validation_error", `${typed} phone needs a terminal to ask for the number`)
        return readSecret("phone number, international format: ", { input, echo: true })
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
          context.streams.diagnostic(`\n${indent(terminalQr(code).text, 2)}`)
          return
        }
        writeFileSync(qrPath, qrPng(code), { mode: 0o600 })
        chmodSync(qrPath, 0o600)
        context.renderer.note(`the QR code is in ${qrPath} — it is replaced when WhatsApp renews it`)
      },
    })
    if (qrPath) rmSync(qrPath, { force: true })

    let received: Received = { chats: 0, messages: 0, people: 0 }
    if (!linked.alreadyLinked) {
      context.renderer.note(
        "receiving history from the phone; keep WhatsApp open on it. Ctrl+C stops — `serve` picks up the rest.",
      )
      received = await context.withMessenger(
        (adapter) => receiveHistory(adapter, environment.historyWait ?? HISTORY_WAIT, environment.signal),
        { listen: true },
      )
    }
    if (context.format === "pretty")
      context.streams.data(linkedText(context.profile, linked.account, linked.alreadyLinked, received))
    else
      printItem(context, {
        profile: context.profile,
        account: linked.account,
        already_linked: linked.alreadyLinked,
        received,
      })
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
    // The phone may have removed the device already; the keys here are then worth nothing, and still go.
    if (!(error instanceof CliError && error.code === "authentication_error")) throw error
    context.renderer.note("WhatsApp no longer knew this device; removing the keys here")
  }
  for (const suffix of ["", "-wal", "-shm", ".lock"]) rmSync(`${store}${suffix}`, { force: true })
  printItem(context, { profile: context.profile, ended: true })
}

export const sessionCommand = () => {
  const session = new Command("session").description("link this profile to WhatsApp as a device, or unlink it")

  annotate(session.command("start"), {
    effects: REMOTE_WRITE,
    lifetime: "interactive",
    examples: ["wa personal session start", "wa personal session start phone"],
  })
    .description("link by QR code (default) or a pairing code, then keep the pushed history")
    .addArgument(new Argument("[method]", "how to link").choices(["qr", "phone"]).default("qr"))
    .option("--qr-file <png>", "write the QR code to this PNG instead of drawing it, for an agent to pass on")
    .addHelpText(
      "after",
      "\nqr: scan the code in WhatsApp > Settings > Linked devices > Link a device.\n" +
        "phone: type your number here, then type the code WhatsApp shows here into the phone.\n" +
        "\nRight after linking, the phone pushes your history once; this command keeps it in the local store\n" +
        "until the phone goes quiet. Then run `wa <profile> server install` to keep receiving.\n" +
        "Agents: --qr-file writes the QR as a PNG (mode 600) and removes it after the login.\n",
    )
    .action(async function (this: Command, method: "qr" | "phone") {
      await start(this, method, this.opts<{ qrFile?: string }>().qrFile)
    })

  annotate(session.command("end"), { effects: REMOTE_WRITE, examples: ["wa personal session end"] })
    .description("unlink this device on WhatsApp's side and delete its keys here")
    .action(async function (this: Command) {
      await end(this)
    })

  return session
}
