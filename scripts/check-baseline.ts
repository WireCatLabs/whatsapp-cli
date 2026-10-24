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

export const checkBaseline = (base: string): string[] => {
  if (!/^[a-f0-9]{40}$/.test(base)) throw new Error("pass the full base commit SHA")
  const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8" })
  const previous = new Set(git(["ls-tree", "-r", "--name-only", base, "--", "lint/baseline/"]).trim().split("\n"))
  if (!existsSync("lint/baseline")) return []
  return readdirSync("lint/baseline")
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => {
      const path = join("lint/baseline", name)
      const before = previous.has(path) ? entries(git(["show", `${base}:${path}`])) : []
      return additions(before, entries(readFileSync(path, "utf8"))).map((entry) => `${name}: ${entry}`)
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
