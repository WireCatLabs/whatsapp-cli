/**
 * Writes `docs/commands.md` from the command tree itself, with cli-base's `commandsPage` — the same
 * generator max-cli uses, so the two pages read alike.
 *
 *   pnpm generate
 *
 * Nobody writes that page by hand: a reference that can be forgotten lies with the confidence of a
 * real one. CI regenerates it and fails when the committed page differs.
 *
 * It imports from `dist/` because Node's type stripping will not resolve a `.js` specifier to a
 * `.ts` file, so `pnpm generate` builds first.
 */
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { COMMANDS_PAGE_LABELS, commandsPage, describeOptions, describeProgram } from "@wirecat/cli-base/commands"
import { createProgram } from "../dist/program.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const program = createProgram()

const page = commandsPage({
  cli: "wa",
  commands: describeProgram(program),
  options: describeOptions(program),
  labels: COMMANDS_PAGE_LABELS.en,
  text: {
    banner: "<!-- Generated from the command tree by scripts/commands.ts. Do not edit; run `pnpm generate`. -->",
    title: "Commands",
    intro: `Every command, option and exit code. This page is **generated from the program itself**, so it
cannot describe a version that does not exist.

For the same list as JSON, run \`wa commands --json\`.

How a command line is built:

\`\`\`sh
wa [profile] [options] <resource> <verb> [arguments]
\`\`\`

**The first word is the profile** when it is not a command: \`wa work chats list\` lists the chats of
profile \`work\`. \`WA_PROFILE\` does the same for a whole shell session; no setting in the config file
picks one. **No profile is assumed**, not even the only one: without either, a command
that uses an account stops with exit 2 and lists the profiles on this computer. Commands that use no
account (\`--help\`, \`--version\`, \`commands\`, \`skill show\`, \`account list\`, \`config show\`) run
without one.`,
    globalHeading: "Options for every command",
    globalIntro: "",
    mutates: "**Changes something in WhatsApp.**",
    mutatesLocal: "**Changes something on this computer only.**",
    exitHeading: "Exit codes",
    exitIntro: "Branch on the code, not on the text: the text can change, the code does not.",
    outro: `\`0\` and only \`0\` means the operation was done. \`14\` (\`outcome_unknown\`) means a message **may**
have gone: repeat it only with the same \`--operation-id\`, which WhatsApp uses to drop a second copy.`,
  },
})

writeFileSync(join(root, "docs/commands.md"), page)
console.log("generated docs/commands.md from the command tree")
