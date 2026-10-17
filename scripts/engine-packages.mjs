// The Go engine ships as one npm package per platform, named by Node's process.platform and process.arch, so the
// CLI finds its own with require.resolve and npm installs only the package whose os and cpu match.
//
//   node scripts/engine-packages.mjs build [<os>-<arch> ...]   # all six when none is named → packages/engine-*/
//   node scripts/engine-packages.mjs check                     # optionalDependencies pin package.json's version,
//                                                              # and the notices match engine/go.mod
//   node scripts/engine-packages.mjs sync                      # rewrite those pins to it
//   node scripts/engine-packages.mjs notices                   # regenerate engine/THIRD_PARTY_NOTICES (needs Go)
//
// Plain Node with no dependencies: the release job runs it before anything is installed.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const manifestPath = join(root, "package.json")
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

/** Node's name for each target, then Go's. */
const TARGETS = {
  "darwin-arm64": ["darwin", "arm64"],
  "darwin-x64": ["darwin", "amd64"],
  "linux-arm64": ["linux", "arm64"],
  "linux-x64": ["linux", "amd64"],
  "win32-arm64": ["windows", "arm64"],
  "win32-x64": ["windows", "amd64"],
}

const packageName = (target) => `@wirecat/whatsapp-engine-${target}`
const packageDir = (target) => join(root, "packages", `engine-${target}`)

const engineDir = join(root, "engine")
const noticesPath = join(engineDir, "THIRD_PARTY_NOTICES")
const goModHash = () =>
  createHash("sha256")
    .update(readFileSync(join(engineDir, "go.mod")))
    .digest("hex")
const stamp = () => `Generated from engine/go.mod sha256 ${goModHash()}`

const go = (args, env = {}) =>
  execFileSync("go", args, { cwd: engineDir, env: { ...process.env, ...env }, encoding: "utf8" })

const LICENCE_FILE = /^(licen[cs]e|copying|notice|patents)/i

const licenceTexts = (dir) =>
  readdirSync(dir)
    .filter((name) => LICENCE_FILE.test(name))
    .sort()
    .map((name) => `--- ${name}\n\n${readFileSync(join(dir, name), "utf8").trimEnd()}\n`)

// Each target links a slightly different set (go-strftime only on Windows), so the notices cover their union.
const linkedModules = () => {
  const modules = new Set()
  for (const [goos, goarch] of Object.values(TARGETS)) {
    const listed = go(
      [
        "list",
        "-deps",
        "-f",
        "{{with .Module}}{{if not .Main}}{{.Path}}@{{.Version}}{{end}}{{end}}",
        "./cmd/wa-engine",
      ],
      { GOOS: goos, GOARCH: goarch, CGO_ENABLED: "0" },
    )
    for (const line of listed.split("\n")) if (line) modules.add(line)
  }
  return [...modules].sort()
}

// The module proxy writes a capital letter as "!" and the letter in lower case.
const proxyEscape = (text) => text.replace(/[A-Z]/g, (letter) => `!${letter.toLowerCase()}`)

const COPYLEFT = [
  ["Mozilla Public License Version 2.0", "the Mozilla Public License 2.0"],
  ["GNU GENERAL PUBLIC LICENSE", "the GNU General Public License"],
]

const notices = () => {
  const copyleft = []
  const sections = linkedModules().map((module) => {
    const { Path, Version, Dir, Origin } = JSON.parse(go(["mod", "download", "-json", module]))
    const texts = licenceTexts(Dir)
    for (const [marker, licence] of COPYLEFT) {
      if (texts.some((text) => text.includes(marker))) copyleft.push(`${Path} (${licence})`)
    }
    const proxy = `https://proxy.golang.org/${proxyEscape(Path)}/@v/${proxyEscape(Version)}.zip`
    const origin = Origin?.URL && Origin.Hash ? `${Origin.URL} at commit ${Origin.Hash}, and ` : ""
    return [`${Path} ${Version}`, `Source: ${origin}${proxy}`, "", ...texts].join("\n")
  })
  const goroot = go(["env", "GOROOT"]).trim()
  const goVersion = go(["env", "GOVERSION"]).trim()
  const standard = [`The Go standard library and runtime, ${goVersion}`, "Source: https://go.dev/dl/", ""]
  sections.push([...standard, ...licenceTexts(goroot)].join("\n"))
  const header = [
    "Third-party material in the wa engine",
    "",
    "bin/wa-engine is built from whatsapp-cli's engine/ (Apache-2.0, see LICENSE) and statically links the Go",
    "modules below and the Go standard library, all unmodified. Each module's licence files follow as they ship",
    "in that module at the version listed, with where its source is. Under a copyleft licence:",
    "",
    ...copyleft.map((line) => `  ${line}`),
    "",
    `${stamp()}; regenerate with \`node scripts/engine-packages.mjs notices\`.`,
  ].join("\n")
  writeFileSync(noticesPath, [header, ...sections].join(`\n${"=".repeat(80)}\n\n`))
  console.log(`${noticesPath} — ${sections.length} components`)
}

const noticesCurrent = () => {
  try {
    return readFileSync(noticesPath, "utf8").includes(stamp())
  } catch {
    return false
  }
}

const build = (target) => {
  const [goos, goarch] = TARGETS[target] ?? []
  if (!goos) throw new Error(`unknown target ${target} — one of ${Object.keys(TARGETS).join(", ")}`)
  const [os, cpu] = target.split("-")
  const dir = packageDir(target)
  const binary = join(dir, "bin", `wa-engine${goos === "windows" ? ".exe" : ""}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dirname(binary), { recursive: true })
  execFileSync(
    "go",
    ["build", "-trimpath", "-ldflags", `-s -w -X main.version=${manifest.version}`, "-o", binary, "./cmd/wa-engine"],
    // Without cgo the binary is static: it runs on glibc and musl alike, and every target builds on one runner.
    {
      cwd: join(root, "engine"),
      env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: "0" },
      stdio: "inherit",
    },
  )
  chmodSync(binary, 0o755)
  copyFileSync(join(root, "LICENSE"), join(dir, "LICENSE"))
  copyFileSync(noticesPath, join(dir, "THIRD_PARTY_NOTICES"))
  const engine = {
    name: packageName(target),
    version: manifest.version,
    description: `The WhatsApp engine of ${manifest.name} for ${target}`,
    license: manifest.license,
    author: manifest.author,
    // npm provenance refuses a package whose repository is not the one that built it.
    repository: manifest.repository,
    os: [os],
    cpu: [cpu],
    files: ["bin", "LICENSE", "THIRD_PARTY_NOTICES"],
    publishConfig: { access: "public" },
  }
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(engine, null, 2)}\n`)
  console.log(`${engine.name}@${engine.version} → ${dir}`)
}

const pinned = () =>
  Object.keys(TARGETS).map((target) => [packageName(target), manifest.optionalDependencies?.[packageName(target)]])

const [command, ...args] = process.argv.slice(2)
if (command === "build") {
  for (const target of args.length ? args : Object.keys(TARGETS)) build(target)
} else if (command === "check") {
  const stale = pinned().filter(([, version]) => version !== manifest.version)
  for (const [name, version] of stale) console.error(`${name} is ${version ?? "missing"}, not ${manifest.version}`)
  if (stale.length) {
    console.error("run `pnpm version:sync`")
  }
  if (!noticesCurrent()) {
    console.error(
      "engine/THIRD_PARTY_NOTICES does not match engine/go.mod — run `node scripts/engine-packages.mjs notices`",
    )
  }
  if (stale.length || !noticesCurrent()) process.exit(1)
  console.log(
    `engine packages ${manifest.version} — all ${pinned().length} optionalDependencies agree, notices current`,
  )
} else if (command === "notices") {
  notices()
} else if (command === "sync") {
  // In place, so the rest of package.json keeps its bytes; the pins are added by hand once, with the targets.
  let text = readFileSync(manifestPath, "utf8")
  for (const [name, version] of pinned()) {
    if (version === undefined) throw new Error(`${name} is not in optionalDependencies — add it by hand`)
    text = text.replace(`"${name}": "${version}"`, `"${name}": "${manifest.version}"`)
  }
  writeFileSync(manifestPath, text)
  console.log(`engine packages pinned to ${manifest.version}`)
} else {
  console.error("usage: node scripts/engine-packages.mjs build [<os>-<arch> ...] | check | sync | notices")
  process.exit(2)
}
