import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { installSkill } from "@wirecat/cli-base/skill"
import { VERSION } from "../version.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

export const completeGlobalInstall = ({
  env = process.env,
  platform = process.platform,
  packageRoot = root,
  repair = (prefix: string) => {
    const child = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        Buffer.from(
          "& $env:WA_INSTALL_SCRIPT -RepairOnly -Prefix $env:WA_INSTALL_PREFIX -NodeDirectory $env:WA_INSTALL_NODE -Json",
          "utf16le",
        ).toString("base64"),
      ],
      {
        encoding: "utf8",
        env: {
          ...env,
          WA_INSTALL_SCRIPT: resolve(packageRoot, "install/windows.ps1"),
          WA_INSTALL_PREFIX: prefix,
          WA_INSTALL_NODE: dirname(process.execPath),
        },
      },
    )
    if (child.error || child.status !== 0)
      throw new Error("Windows PATH setup failed; run the Windows installer from the installation guide")
  },
  note = (message: string) => process.stderr.write(`${message}\n`),
} = {}): void => {
  if (env.npm_config_global !== "true") return
  if (platform === "win32") {
    const prefix = env.npm_config_prefix
    if (!prefix) throw new Error("npm did not provide its global prefix; use the Windows installer")
    repair(prefix)
    note("wa: Windows user PATH updated; new terminals can run wa directly.")
  }
  if (env.WA_INSTALL_AGENT === "none") {
    note("wa: agent skill skipped by WA_INSTALL_AGENT=none; install with wa skill install --for all.")
  } else {
    const agent = env.WA_INSTALL_AGENT ?? "all"
    if (!["all", "codex", "cursor", "claude", "gemini"].includes(agent))
      throw new Error("WA_INSTALL_AGENT must be all, codex, cursor, claude, gemini or none")
    const targets =
      agent === "all"
        ? (["claude", "agents"] as const)
        : agent === "claude"
          ? (["claude"] as const)
          : (["agents"] as const)
    installSkill(
      { command: "wa", appName: "whatsapp-cli", version: VERSION },
      pathToFileURL(join(packageRoot, "skills/whatsapp-cli/SKILL.md")),
      { env, targets },
    )
    note("wa: agent skill installed. Agent: read wa skill show before login; verify the installed skill is loaded.")
  }
  note("wa: link an account: wa personal session start (any profile name in place of personal).")
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    completeGlobalInstall()
  } catch (error) {
    process.stderr.write(`wa installation incomplete: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
