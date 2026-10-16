import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { docsProblems } from "@wirecat/cli-base/release"
import { describe, expect, it } from "vitest"
import { docsRules } from "./checks.ts"

describe("docsRules", () => {
  it("passes over links out of the repository and the generated page, and holds user pages", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-"))
    mkdirSync(join(root, "docs"))
    writeFileSync(join(root, "docs", "commands.md"), "# Commands\n\n~~old~~ CLI-1\n")
    writeFileSync(join(root, "docs", "usage.md"), "# Usage\n\n~~was~~ now (NEED-3)\n")
    writeFileSync(join(root, "README.md"), "[out](../cli-messaging/README.md) [gone](docs/b.md)\n")

    expect(docsProblems(root, docsRules(root)).map((problem) => problem.replaceAll("\\", "/"))).toEqual([
      "README.md:1: link to docs/b.md — no such file",
      "docs/usage.md:3: struck-out text on a user page",
      "docs/usage.md:3: internal id NEED-3 on a user page",
    ])
  })
})
