// The Go engine ships as one npm package per platform, named by Node's process.platform and process.arch, so the
// CLI finds its own with require.resolve and npm installs only the package whose os and cpu match.
//
//   node scripts/engine-packages.mjs build [<os>-<arch> ...]   # all six when none is named → packages/engine-*/
//   node scripts/engine-packages.mjs check                     # optionalDependencies pin package.json's version
//   node scripts/engine-packages.mjs sync                      # rewrite those pins to it
//
// Plain Node with no dependencies: the release job runs it before anything is installed.
import { execFileSync } from "node:child_process"
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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
    files: ["bin", "LICENSE"],
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
    process.exit(1)
  }
  console.log(`engine packages ${manifest.version} — all ${pinned().length} optionalDependencies agree`)
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
  console.error("usage: node scripts/engine-packages.mjs build [<os>-<arch> ...] | check | sync")
  process.exit(2)
}
