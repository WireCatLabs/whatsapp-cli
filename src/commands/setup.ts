import { accessSync, constants, existsSync, mkdirSync } from "node:fs"
import { CliError, indent, renderPretty, singleLine } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { installSkill, type SkillTarget } from "@wirecat/cli-base/skill"
import {
  AGENTS,
  type Agent,
  agentFor,
  asFirstWord,
  commandWords,
  environmentOf,
  logsInOrOut,
  type MessengerContext,
  messengerContext,
  printItem,
  REMOTE_WRITE,
  refuseCommandName,
  rootOf,
  runtime,
  screenFor,
  secretInputOf,
} from "@wirecat/cli-core/cli"
import { levelFor } from "@wirecat/cli-core/sends"
import { Command, Option } from "commander"
import { WA } from "../app.js"
import { type Environment, SKILL, WHATSAPP } from "../messenger.js"
import { pathsFor, privateStore } from "../paths.js"
import { startSession } from "../session.js"
import { installer, PACKAGE } from "../update.js"

type Options = {
  agent?: Agent
  method: "qr" | "phone"
}

const STEPS = 5
const chatCount = (count: number) => `${count} ${count === 1 ? "chat" : "chats"}`

export const setupCommand = () =>
  annotate(logsInOrOut(new Command("setup")), {
    effects: REMOTE_WRITE,
    lifetime: "interactive",
    mcp: false,
    examples: ["wa personal setup", "wa personal setup --agent codex", "wa personal setup --agent claude --json"],
  })
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
        "\nAgents: read `wa skill show` first. Without a terminal, setup prints the QR code as text:\n" +
        "  wa personal setup --agent codex --json\n" +
        "Run it in the background and paste each QR block into the chat, as for `session start qr`.\n" +
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
      new Option("--method <method>", "how to log in when there is no session").choices(["qr", "phone"]).default("qr"),
    )
    .action(async function (this: Command) {
      const context = messengerContext(this, WHATSAPP)
      refuseCommandName(context.profile, commandWords(rootOf(this)), "wa")
      const options = this.opts<Options>()
      if (context.settings.offline)
        throw new CliError("validation_error", "wa setup verifies WhatsApp — remove --offline")
      for (const permission of ["account.show", "chats.list"] as const) {
        if (levelFor(context.settings.permissions, permission).level === "deny")
          throw new CliError(
            "permission_error",
            `profile ${context.profile} denies ${permission} — setup cannot verify it`,
            { permission },
          )
      }
      const devicePath = privateStore(context.profile, context.env)
      if (!existsSync(devicePath) && !context.stdin.isTTY && options.method === "phone")
        throw new CliError(
          "validation_error",
          "wa setup --method phone needs a terminal to ask for the number — run it locally, or link by QR",
          { reason: "input.required" },
        )
      const environment = environmentOf(this)
      const { platform } = environment
      const prefix = `wa ${asFirstWord(context.profile)}`
      const command =
        installer(environmentOf<Environment>(this).update) === "npx"
          ? `npm${platform === "win32" ? ".cmd" : ""} exec --yes --package=${PACKAGE} -- ${prefix}`
          : prefix
      // The command's own signal, not a phase's: Ctrl+C during the history wait ends the wait, not setup.
      const signal = environment.commandSignal ?? new AbortController().signal
      const screen = screenFor(context, this.optsWithGlobals().quiet === true, STEPS)
      const linkContext: MessengerContext = { ...context, renderer: { ...context.renderer, note: screen.detail } }
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
      if (platform === "win32")
        screen.detail(
          "Windows: use wa.cmd or npm.cmd if PowerShell blocks scripts. Open a new terminal after installing Node.js.",
        )

      screen.step(2, "Link this device")
      const session = await startSession(this, linkContext, {
        signal,
        method: options.method,
        command: `${prefix}setup`,
        indent: screen.indent,
        stopEndsWait: true,
      })
      environment.endUntilStopped?.()
      const reused = session.alreadyLinked
      const history = session.received
      screen.detail(
        history
          ? `✓ linked; ${chatCount(history.chats)} and ${history.messages} messages kept from the phone`
          : "✓ existing device, no new link",
      )

      screen.step(3, "Account")
      const account = await context.withMessenger(async (adapter) => {
        signal.throwIfAborted()
        return adapter.me()
      })
      screen.detail(`✓ ${account.name === null ? "verified" : singleLine(account.name)}`)

      screen.step(4, "A few chats")
      // WhatsApp has no chat list to ask for: the store holds what the phone pushed and what serve received.
      const chats = await context.withStore((store, key) => store.forAccount(key).chats.chats({ limit: 5, offset: 0 }))
      screen.detail(`✓ ${chatCount(chats.items.length)} read from the local store`)
      if (chats.items.length === 0) screen.detail(`nothing kept yet — \`${command}server install\` starts receiving`)

      screen.step(5, "Agent")
      const agent = await agentFor(context, options.agent, screen.indent, { ...secretInputOf(this), signal })
      screen.detail(agent === "none" ? "✓ no agent skill installed" : `✓ ${agent}`)
      const targets: readonly SkillTarget[] =
        agent === "all" ? ["claude", "agents"] : [agent === "claude" ? "claude" : "agents"]
      signal.throwIfAborted()
      const written = agent === "none" ? [] : installSkill(WA, SKILL, { targets, env: context.env })
      const next = {
        instructions: `${command}skill show`,
        inbox: `${command}inbox --limit 5`,
        chats: `${command}chats list --limit 5`,
        receive: `${command}server install`,
        history_status: `${command}store status`,
        ...(agent === "none" ? { skill: `${command}skill install`, mcp: `${command}mcp config` } : {}),
      }
      const answer = {
        profile: context.profile,
        runtime: runtime(),
        paths,
        device: { path: devicePath, reused },
        account: { id: account.id, name: account.name },
        ...(history ? { history } : {}),
        chats: { checked: chats.items.length, has_more: chats.hasMore },
        agent: { name: agent, written },
        next,
      }
      if (context.format !== "pretty") printItem(context, answer)
      else {
        const rows = {
          "Try now": next.inbox,
          "Keep receiving": `${next.receive}  (a background server saves new messages)`,
          "Agent skill":
            agent === "none"
              ? `skipped — install later: ${next.skill}`
              : `installed for ${agent}; start a new agent session if it is not found`,
          "For an agent": next.instructions,
        }
        context.streams.data(
          `\n✓ WhatsApp is ready — profile ${context.profile}, ${chatCount(chats.items.length)} checked\n\n` +
            indent(renderPretty(rows, { color: context.color }), 2),
        )
      }
    })
