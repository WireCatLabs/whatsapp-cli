import { accessSync, constants, existsSync, mkdirSync } from "node:fs"
import { CliError, indent, renderPretty } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { installSkill, type SkillTarget } from "@wirecat/cli-base/skill"
import { readSecret } from "@wirecat/cli-core"
import {
  asFirstWord,
  type Closeable,
  commandWords,
  environmentOf,
  inputPolicy,
  type MessengerContext,
  messengerContext,
  REMOTE_WRITE,
  refuseCommandName,
  rootOf,
  runtime,
  withDeadline,
} from "@wirecat/cli-core/cli"
import { levelFor } from "@wirecat/cli-core/sends"
import { Command, Option } from "commander"
import { WA } from "../app.js"
import { type Environment, SKILL, WHATSAPP } from "../messenger.js"
import { pathsFor, privateStore } from "../paths.js"
import { installer, PACKAGE } from "../update.js"
import { printItem } from "./answer.js"
import { startSession } from "./session.js"

const AGENTS = ["none", "codex", "cursor", "claude", "gemini", "all"] as const
type Agent = (typeof AGENTS)[number]

type Options = {
  agent?: Agent
  method: "qr" | "phone"
  qrFile?: string
}

const STEPS = 5
const chatCount = (count: number) => `${count} ${count === 1 ? "chat" : "chats"}`
const DETAIL = 6

/**
 * A person sees each step as a heading with its details indented under it. `--quiet` hides both, as it
 * hides notes; a machine mode keeps the plain notes it always had, since stderr there is a log.
 */
const screenFor = (context: MessengerContext, quiet: boolean) => {
  const person = context.format === "pretty"
  const say = (text: string) => {
    if (!quiet) context.streams.diagnostic(text)
  }
  return {
    step: (index: number, title: string) =>
      person ? say(`\n[${index}/${STEPS}] ${title}`) : context.renderer.note(`${index}/${STEPS} — ${title}`),
    detail: (text: string) => (person ? say(indent(text, DETAIL)) : context.renderer.note(text)),
    title: (text: string) => (person ? say(text) : context.renderer.note(text)),
    indent: person ? DETAIL : 0,
  }
}

const agentFor = async (
  context: MessengerContext,
  given: Agent | undefined,
  pad: number,
  signal?: AbortSignal,
): Promise<Agent> => {
  if (given) return given
  if (context.format !== "pretty" || !context.stdin.isTTY || inputPolicy(context.stdin).noInput) return "none"
  const answer =
    (
      await readSecret(`${" ".repeat(pad)}Agent [codex/cursor/claude/gemini/all/none] (none): `, {
        input: context.stdin,
        echo: true,
        ...(signal === undefined ? {} : { signal }),
      })
    )
      .trim()
      .toLowerCase() || "none"
  if (!AGENTS.includes(answer as Agent))
    throw new CliError("validation_error", `unknown agent — choose ${AGENTS.join(", ")} with --agent`)
  return answer as Agent
}

export const setupCommand = () =>
  annotate(new Command("setup"), { effects: REMOTE_WRITE, lifetime: "interactive" })
    .description("set up WhatsApp and connect your agent")
    .configureHelp({ showGlobalOptions: true })
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  wa personal setup                Guided setup of profile personal in your local terminal\n" +
        "  wa personal setup --agent codex  Install the skill for Codex\n" +
        "  wa work setup --agent claude     Set up a separate work profile\n" +
        "  wa personal setup --method phone Link with a pairing code instead of QR\n" +
        "\nThe first word names the profile; every later command names it too.\n" +
        "\nAllow about 5 minutes: the phone pushes your recent history once, right after linking.\n" +
        "Scan the QR in WhatsApp: Settings > Linked devices > Link a device.\n" +
        "Type your phone number only in the terminal.\n" +
        "\nAgents: read `wa skill show` first. Without a terminal, an agent can use:\n" +
        "  wa personal setup --qr-file login.png --agent codex --json\n" +
        "and pass the image on to be scanned. The QR image is removed when linking ends.\n" +
        "Machine mode skips agent installation unless --agent is given.\n" +
        "A device linked before is checked without linking again.\n" +
        "\nSetup reads five chats from the local store. To keep receiving messages:\n" +
        "  wa personal server install\n",
    )
    .addOption(
      new Option("--agent <agent>", "install the skill for this agent; asks at a terminal, otherwise none").choices(
        AGENTS,
      ),
    )
    .addOption(
      new Option("--method <method>", "how to link when the profile has no device")
        .choices(["qr", "phone"])
        .default("qr"),
    )
    .option("--qr-file <png>", "write a temporary QR image for an agent to pass on; works without a terminal")
    .action(async function (this: Command) {
      const context = messengerContext(this, WHATSAPP)
      refuseCommandName(context.profile, commandWords(rootOf(this)), "wa")
      const options = this.opts<Options>()
      if (context.settings.offline)
        throw new CliError("validation_error", "wa setup verifies WhatsApp — remove --offline")
      if (options.qrFile && options.method !== "qr")
        throw new CliError("validation_error", "--qr-file is for a QR login")
      for (const permission of ["account.show", "chats.list"] as const) {
        if (levelFor(context.settings.permissions, permission).level === "deny")
          throw new CliError(
            "permission_error",
            `profile ${context.profile} denies ${permission} — setup cannot verify it`,
            { permission },
          )
      }
      const devicePath = privateStore(context.profile, context.env)
      if (!existsSync(devicePath) && !context.stdin.isTTY && !options.qrFile)
        throw new CliError(
          "validation_error",
          "wa setup needs a terminal to link a device — run it locally, or pass --qr-file for an agent",
        )
      const prefix = `wa ${asFirstWord(context.profile)}`
      const command =
        installer(environmentOf<Environment>(this).update) === "npx"
          ? `npm${process.platform === "win32" ? ".cmd" : ""} exec --yes --package=${PACKAGE} -- ${prefix}`
          : prefix
      const cancellation = new AbortController()
      const closeables: Closeable[] = [
        {
          close: async () => {
            cancellation.abort()
          },
        },
      ]
      const track = (closeable: Closeable) => {
        closeables.push(closeable)
      }
      const screen = screenFor(context, this.optsWithGlobals().quiet === true)
      const linkContext: MessengerContext = { ...context, renderer: { ...context.renderer, note: screen.detail } }
      const answer = await withDeadline(context.settings.commandTimeoutMs, closeables, async () => {
        screen.title(
          `WhatsApp setup — profile ${context.profile}. Allow about 5 minutes; the phone sends recent history once.`,
        )
        screen.step(1, "This computer")
        const paths = pathsFor(context.env)
        for (const path of [paths.config, paths.state, paths.cache]) {
          mkdirSync(path, { recursive: true })
          accessSync(path, constants.W_OK)
        }
        screen.detail("✓ local directories ready")
        if (process.platform === "win32")
          screen.detail(
            "Windows: use wa.cmd or npm.cmd if PowerShell blocks scripts. Open a new terminal after installing Node.js.",
          )

        screen.step(2, existsSync(devicePath) ? "Link" : "Link: scan the QR code or type the pairing code")
        const session = await startSession(this, linkContext, {
          signal: cancellation.signal,
          method: options.method,
          ...(options.qrFile === undefined ? {} : { qrFile: options.qrFile }),
          command: `${prefix}setup`,
          indent: screen.indent,
          track,
        })
        const reused = session.alreadyLinked
        screen.detail(
          reused
            ? "✓ existing device, no new link"
            : `✓ linked; ${chatCount(session.received.chats)} and ${session.received.messages} messages kept from the phone`,
        )

        screen.step(3, "Account")
        const account = await context.withMessenger(async (adapter) => {
          track(adapter)
          cancellation.signal.throwIfAborted()
          return adapter.me()
        })
        screen.detail(`✓ ${account.name ?? "verified"}`)

        screen.step(4, "A few chats")
        // WhatsApp has no chat list to ask for: the store holds what the phone pushed and what serve received.
        const chats = await context.withStore((store, key) => store.chats.chats(key, { limit: 5, offset: 0 }))
        screen.detail(`✓ ${chatCount(chats.items.length)} read from the local store`)
        if (chats.items.length === 0) screen.detail(`nothing kept yet — \`${command}server install\` starts receiving`)

        screen.step(5, "Agent")
        const agent = await agentFor(context, options.agent, screen.indent, cancellation.signal)
        screen.detail(agent === "none" ? "✓ no agent skill installed" : `✓ ${agent}`)
        const targets: readonly SkillTarget[] =
          agent === "all" ? ["claude", "agents"] : [agent === "claude" ? "claude" : "agents"]
        cancellation.signal.throwIfAborted()
        const written = agent === "none" ? [] : installSkill(WA, SKILL, { targets, env: context.env })
        const next = {
          instructions: `${command}skill show`,
          inbox: `${command}inbox --limit 5`,
          chats: `${command}chats list --limit 5`,
          receive: `${command}server install`,
          history_status: `${command}store status`,
          ...(agent === "none" ? { skill: `${command}skill install`, mcp: `${command}mcp config` } : {}),
        }
        return {
          profile: context.profile,
          runtime: runtime(),
          paths,
          device: { path: devicePath, reused },
          account: { id: account.id, name: account.name },
          history: session.received,
          chats: { checked: chats.items.length, has_more: chats.hasMore },
          agent: { name: agent, written },
          next,
        }
      })
      const { agent, next, chats } = answer
      if (context.format !== "pretty") printItem(context, answer)
      else {
        const rows = {
          "Try now": next.inbox,
          "Keep receiving": `${next.receive}  (a background server saves new messages)`,
          "Agent skill":
            agent.name === "none"
              ? `skipped — install later: ${next.skill}`
              : `installed for ${agent.name}; start a new agent session if it is not found`,
          "For an agent": next.instructions,
        }
        context.streams.data(
          `\n✓ WhatsApp is ready — profile ${context.profile}, ${chatCount(chats.checked)} checked\n\n` +
            indent(renderPretty(rows, { color: context.color }), 2),
        )
      }
    })
