import { singleLine } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import {
  asFirstWord,
  commandWords,
  logsInOrOut,
  messengerContext,
  printItem,
  REMOTE_WRITE,
  refuseCommandName,
  rootOf,
} from "@wirecat/cli-core/cli"
import { Argument, Command } from "commander"
import { WHATSAPP } from "../messenger.js"
import { endSession, type Received, startSession } from "../session.js"

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

export const AGENTS_LINK_BY_QR =
  "Agents: run `wa <profile> session start qr` in the background — it waits for the scan, and a shell tool\n" +
  "shows nothing until it exits. Read its output and paste the QR text block into the chat as a code block,\n" +
  "exactly as printed. WhatsApp renews the code after 60 seconds, then about every 20: paste each new block\n" +
  'at once and say the old one expired. With --json each code is also a stderr line {"event":"qr","qr":{...}}.\n' +
  "Linking is not offered over MCP; an agent with only MCP asks the person to run the command.\n"

export const sessionCommand = () => {
  // Linking waits for a person, and unlinking removes the owner's device: neither is an agent's call.
  const session = annotate(new Command("session"), { mcp: false }).description(
    "link this profile to WhatsApp as a device, or unlink it",
  )

  annotate(logsInOrOut(session.command("start")), {
    effects: REMOTE_WRITE,
    output: { entity: "session" },
    lifetime: "interactive",
    examples: ["wa personal session start", "wa personal session start phone"],
  })
    .description("link by QR code (default) or a pairing code, then keep the pushed history")
    .addArgument(new Argument("[method]", "how to link").choices(["qr", "phone"]).default("qr"))
    .addHelpText(
      "after",
      "\nFirst time? Use `wa personal setup` for linking, a check of five chats and an agent skill.\n" +
        "\nqr: scan the code in WhatsApp > Settings > Linked devices > Link a device.\n" +
        "phone: type your number here with + and the country code, then type the code WhatsApp shows here into\n" +
        "the phone.\n" +
        "\nRight after linking, the phone pushes your history once; this command keeps it in the local store\n" +
        "until the phone goes quiet. Then run `wa <profile> server install` to keep receiving.\n" +
        `\n${AGENTS_LINK_BY_QR}`,
    )
    .action(async function (this: Command, method: "qr" | "phone") {
      const context = messengerContext(this, WHATSAPP)
      refuseCommandName(context.profile, commandWords(rootOf(this)), "wa")
      const session = await startSession(this, context, {
        command: `wa ${asFirstWord(context.profile)}session start`,
        method,
        stopEndsWait: true,
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

  annotate(logsInOrOut(session.command("end")), {
    effects: REMOTE_WRITE,
    output: { entity: "session" },
    examples: ["wa personal session end"],
  })
    .description("unlink this device on WhatsApp's side and delete its keys here")
    .action(async function (this: Command) {
      const context = messengerContext(this, WHATSAPP)
      const { alreadyDropped, ...answer } = await endSession(context)
      if (alreadyDropped) context.renderer.note("WhatsApp had already dropped this device; deleted its keys here")
      printItem(context, answer)
    })

  return session
}
