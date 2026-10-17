/**
 * whatsapp-cli's side of the release checks: its changelog headings, its pages and what its package may
 * ship. The checks themselves are `@wirecat/cli-base/release`; `scripts/release-check.ts` and
 * `cli-dev docs-check --rules scripts/release/checks.ts` run them.
 */
import { join, sep } from "node:path"
import { type ChangelogRules, type DocsRules, JOURNAL_IDS, markdownFiles } from "@wirecat/cli-base/release"

const IDS = [...JOURNAL_IDS, "OPS", "CLI"]

export const CHANGELOG: ChangelogRules = {
  headings: ["Added", "Changed — may break callers", "Fixed", "Security", "Removed"],
  unreleased: "Unreleased",
  ids: IDS,
}

// The agent skill ships because `wa skill show` reads it from the package.
export const PACKED = ["dist/", "install/", "package.json", "README.md", "LICENSE", "skills/whatsapp-cli/SKILL.md"]
export const PACKED_SAID = "dist/, the Windows installer, package.json, README.md, LICENSE and the agent skill"

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
