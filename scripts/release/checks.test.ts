import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { docsProblems } from "@wirecat/cli-base/release"
import { describe, expect, it } from "vitest"
import { docsRules, engineInPackage, engineOutOfPackage, inProcessEngine } from "./checks.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

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

describe("the engine stays a separate program", () => {
  it("refuses Go code and the engine binary anywhere in the CLI package, and passes dist/engine/", () => {
    const paths = ["dist/engine/go-engine.js", "dist/bin/wa-engine", "dist/x/main.go", "engine/go.mod", "LICENSE"]

    expect(engineInPackage(paths)).toEqual([
      "npm pack: dist/bin/wa-engine would ship — the GPL-3.0 engine belongs in the engine packages only",
      "npm pack: dist/x/main.go would ship — the GPL-3.0 engine belongs in the engine packages only",
      "npm pack: engine/go.mod would ship — the GPL-3.0 engine belongs in the engine packages only",
    ])
  })

  // cli-base's release run() spawns "npm" without a shell, which Windows cannot start (spawnSync npm ENOENT); the fix
  // belongs in cli-base. The release checks run on Linux only.
  it.skipIf(process.platform === "win32")("leaves the engine out of what npm would pack for the CLI", () => {
    expect(engineOutOfPackage(repo)()).toEqual([])
  })

  it("finds nothing in src/ that loads native or wasm code into the CLI's process", () => {
    expect(inProcessEngine(repo)).toEqual([])
  })

  it("names a source file that loads native code in-process", () => {
    const root = mkdtempSync(join(tmpdir(), "src-"))
    mkdirSync(join(root, "src"))
    writeFileSync(join(root, "src", "native.ts"), 'process.dlopen(module, "wa-engine.node")\n')

    expect(inProcessEngine(root)).toHaveLength(2)
  })
})
