/**
 * whatsapp-cli's side of the release checks: its changelog headings, its pages and what its package may
 * ship. The checks themselves are `@wirecat/cli-base/release`; `scripts/release-check.ts` and
 * `cli-dev docs-check --rules scripts/release/checks.ts` run them.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { type ChangelogRules, type DocsRules, JOURNAL_IDS, markdownFiles, run } from "@wirecat/cli-base/release"

const IDS = [...JOURNAL_IDS, "OPS", "CLI"]

export const CHANGELOG: ChangelogRules = {
  headings: ["Added", "Changed — may break callers", "Fixed", "Security", "Removed"],
  unreleased: "Unreleased",
  ids: IDS,
}

// The agent skill ships because `wa skill show` reads it from the package.
export const PACKED = ["dist/", "install/", "package.json", "README.md", "LICENSE", "skills/whatsapp-cli/SKILL.md"]
export const PACKED_SAID = "dist/, the Windows installer, package.json, README.md, LICENSE and the agent skill"

// PACKED lets all of dist/ through, so this names what must never be in the CLI package, wherever it lands: the
// engine is GPL-3.0 and ships only in @wirecat/whatsapp-engine-*, which the CLI runs as a child process.
const ENGINE_FILE = /^engine\/|(^|\/)(go\.(mod|sum)|[^/]+\.go|wa-engine(\.exe)?)$/

export const engineInPackage = (paths: string[]): string[] =>
  paths
    .filter((path) => ENGINE_FILE.test(path))
    .map((path) => `npm pack: ${path} would ship — the GPL-3.0 engine belongs in the engine packages only`)

export const engineOutOfPackage = (root: string) => (): string[] => {
  const { ok, output } = run(root, "npm", ["pack", "--dry-run", "--json", "--ignore-scripts", "--no-update-notifier"])
  if (!ok) return [output.trim()]
  const [packed] = JSON.parse(output.slice(output.indexOf("["))) as [{ files?: { path: string }[] }?]
  return engineInPackage((packed?.files ?? []).map(({ path }) => path))
}

// Linking the engine into the Node process would make the CLI one program with GPL-3.0 code. Resolving the engine
// package's package.json to find the binary's path (src/engine-binary.ts) loads nothing, so it is allowed.
const IN_PROCESS = [
  /\bdlopen\b/,
  /\bWebAssembly\b/,
  /\.wasm\b/,
  /["'](koffi|ffi-napi|ffi-rs|node-ffi|bun:ffi)["']/,
  /\.node["']/,
  /(import|require)\s*\(?\s*["'`]@wirecat\/whatsapp-engine-/,
]

export const inProcessEngine = (root: string): string[] => {
  const src = join(root, "src")
  return readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .flatMap((name) => {
      const text = readFileSync(join(src, name), "utf8")
      return IN_PROCESS.filter((pattern) => pattern.test(text)).map(
        (pattern) => `${relative(root, join(src, name))}: ${pattern} — the engine runs only as a child process`,
      )
    })
}

const GENERATED = new Set(["docs/commands.md"])

export const docsRules = (root: string): DocsRules => ({
  files: [
    ...["README.md", "CHANGELOG.md", "AGENTS.md", "CLAUDE.md", "skills/whatsapp-cli/SKILL.md"].map((name) =>
      join(root, name),
    ),
    ...markdownFiles(join(root, "docs")),
  ],
  ids: IDS,
  userPage: (name) => {
    const portable = name.replaceAll("\\", "/")
    return portable === "README.md" || (/^docs\/[^/]+\.md$/.test(portable) && !GENERATED.has(portable))
  },
  // cli-core and max-cli are sibling checkouts on the owner's machine, not in CI.
  skipLink: (_, destination) => !destination.startsWith(root + sep) && destination !== root,
})
