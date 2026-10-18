/**
 * Everything about a release that a program can decide, one line each, and exit 1 if any failed.
 * `bin/release` runs the full check; release CI uses --artifact-only after full validation. The judgement half —
 * changelog wording, docs against the diff, live checks — is the release skill,
 * `.claude/skills/release/SKILL.md`.
 *
 *   pnpm release:check
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  changelogProblems,
  command,
  docsProblems,
  notOnNpm,
  packageVersion,
  packContents,
  releaseCheck,
} from "@wirecat/cli-base/release"
import { CHANGELOG, docsRules, engineOutOfPackage, PACKED, PACKED_SAID } from "./release/checks.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const version = packageVersion(root)

const failed = releaseCheck(
  [
    { name: "version not on npm", run: notOnNpm(root, "@wirecat/whatsapp-cli", version) },
    { name: "version in step", run: command(root, "pnpm", "version:check") },
    {
      name: "changelog",
      run: () =>
        changelogProblems(readFileSync(join(root, "CHANGELOG.md"), "utf8"), { ...CHANGELOG, version, release: true }),
    },
    { name: "docs", run: () => docsProblems(root, docsRules(root)) },
    { name: "lint", run: command(root, "pnpm", "lint") },
    { name: "typecheck", run: command(root, "pnpm", "typecheck") },
    { name: "test", run: command(root, "pnpm", "test") },
    { name: "bun", run: command(root, "pnpm", "smoke:bun") },
    { name: "generated files", run: command(root, "pnpm", "generate") },
    { name: "command lint", run: command(root, "pnpm", "lint:commands") },
    {
      name: "test matrix",
      run: command(
        root,
        "pnpm",
        "exec",
        "cli-dev",
        "test-matrix",
        "--program",
        "dist/program.js",
        "--untested",
        "scripts/test-matrix-untested.ts",
        "--name",
        "wa",
        "--check",
      ),
    },
    { name: "tree unchanged", run: command(root, "git", "diff", "--exit-code", "--stat") },
    { name: "package contents", run: packContents(root, PACKED, PACKED_SAID) },
    { name: "no engine in the CLI package", run: engineOutOfPackage(root) },
    ...(process.env.SECURITY_SECRETS_CHECKED === "1" && process.env.CI
      ? []
      : [
          {
            name: "secrets",
            run: command(root, "pnpm", "secrets:scan"),
          },
        ]),
  ].filter(
    (check) =>
      !process.argv.includes("--artifact-only") ||
      ["changelog", "web client version", "package contents", "no engine in the CLI package"].includes(check.name),
  ),
  { version, log: console.log },
)
process.exit(failed === 0 ? 0 : 1)
