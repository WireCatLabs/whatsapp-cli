import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const [tarball, engineTarball] = process.argv.slice(2)
if (!tarball || !engineTarball) throw new Error("Provide the packed npm tarball and this system's engine tarball")
const sandbox = mkdtempSync(join(tmpdir(), "wa-npm-install-"))
const home = join(sandbox, "home")
const prefix = join(sandbox, "prefix with spaces")
const env = { ...process.env, HOME: home, USERPROFILE: home, WA_INSTALL_AGENT: "all", WA_NO_UPDATE_CHECK: "1" }
delete env.WA_ENGINE
execFileSync(
  "npm",
  [
    "install",
    "--global",
    "--prefix",
    prefix,
    "--allow-scripts=@wirecat/whatsapp-cli",
    "--foreground-scripts",
    resolve(tarball),
    // Together, because the engine of an unreleased version is not on npm yet.
    resolve(engineTarball),
  ],
  { env, stdio: "pipe" },
)
for (const directory of [".agents", ".claude"]) {
  assert.ok(readFileSync(join(home, directory, "skills/whatsapp-cli/SKILL.md"), "utf8").includes("name: whatsapp-cli"))
}
const installed = join(prefix, "bin/wa")
const version = execFileSync(installed, ["--version"], { env, encoding: "utf8" }).trim()
assert.equal(version, JSON.parse(readFileSync("package.json", "utf8")).version)
const goEngine = pathToFileURL(join(prefix, "lib/node_modules/@wirecat/whatsapp-cli/dist/engine/go-engine.js")).href
const engine = execFileSync(
  process.execPath,
  ["--input-type=module", "-e", `import(${JSON.stringify(goEngine)}).then((m) => console.log(m.engineBinary()))`],
  { env, encoding: "utf8" },
).trim()
assert.ok(engine.includes(join("node_modules", "@wirecat", "whatsapp-engine-")), engine)
assert.equal(execFileSync(engine, ["--version"], { env, encoding: "utf8" }).trim(), version)
for (const args of [
  ["--help"],
  ["setup", "--help"],
  ["skill", "show"],
  ["skill", "install", "--for", "all", "--json"],
]) {
  execFileSync(installed, args, { env, stdio: "pipe" })
}
console.log(
  `PASS: ${process.platform}, packed ${version}, real global install, engine ${version} resolved and run, both skill roots and CLI/help/skill commands`,
)
