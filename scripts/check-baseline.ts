import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export const additions = (before: readonly string[], after: readonly string[]): string[] => {
  const remaining = new Map<string, number>()
  for (const entry of before) remaining.set(entry, (remaining.get(entry) ?? 0) + 1)
  return after.filter((entry) => {
    const count = remaining.get(entry) ?? 0
    if (count === 0) return true
    remaining.set(entry, count - 1)
    return false
  })
}

const entries = (text: string): string[] => {
  const parsed: unknown = JSON.parse(text)
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error("a command-lint baseline must be an array of strings")
  }
  return parsed
}

// cli-base 0.98.0 refuses an override for a word a cli-core command brings: it waits in the baseline until cli-core
// or the vocabulary catches up, so such an entry may be added.
const WORD_RULES = new Set(["unknown-verb", "unknown-resource", "option-role", "flag-synonym", "flag-two-meanings"])

export const sharedWord = (file: string, entry: string, shared: ReadonlySet<string>): boolean =>
  WORD_RULES.has(file.replace(/\.json$/, "")) && shared.has(entry.split(" --")[0] ?? entry)

const sharedCommands = (): Set<string> => {
  const parity = "node_modules/@wirecat/cli-core/parity.json"
  if (!existsSync(parity)) return new Set()
  return new Set(Object.keys((JSON.parse(readFileSync(parity, "utf8")) as { commands: object }).commands))
}

export const checkBaseline = (base: string): string[] => {
  if (!/^[a-f0-9]{40}$/.test(base)) throw new Error("pass the full base commit SHA")
  const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8" })
  const previous = new Set(git(["ls-tree", "-r", "--name-only", base, "--", "lint/baseline/"]).trim().split("\n"))
  if (!existsSync("lint/baseline")) return []
  const shared = sharedCommands()
  return readdirSync("lint/baseline")
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => {
      const path = join("lint/baseline", name)
      const before = previous.has(path) ? entries(git(["show", `${base}:${path}`])) : []
      return additions(before, entries(readFileSync(path, "utf8")))
        .filter((entry) => !sharedWord(name, entry, shared))
        .map((entry) => `${name}: ${entry}`)
    })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const added = checkBaseline(process.argv[2] ?? "")
  if (added.length > 0) {
    process.stderr.write(
      `Command-lint baseline may only shrink. Fix these or add a dated reason in lint/overrides.json:\n${added.join("\n")}\n`,
    )
    process.exitCode = 1
  }
}
