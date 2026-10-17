import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..")
const script = join(repo, "scripts", "engine-packages.mjs")

describe("engine package README", () => {
  it("points the source at the commit being built, which exists before the release tag does", () => {
    const readme = execFileSync(process.execPath, [script, "readme", "linux-x64"], { encoding: "utf8" })
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim()

    expect(readme).toMatch(/<https:\/\/github\.com\/WireCatLabs\/whatsapp-cli\/tree\/[0-9a-f]{40}>/)
    expect(readme).toContain(`/tree/${head}>`)
  })
})
