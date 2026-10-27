/**
 * The second runtime, actually executed against the built command, as tg-cli's and max-cli's `scripts/smoke.ts`.
 * Bun cannot run the Vitest suite, and the store picks a different SQLite module under each runtime, so a type
 * check proves nothing about it.
 *
 *   pnpm build && pnpm smoke:bun
 */
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const runtime = typeof (globalThis as { Bun?: unknown }).Bun === "undefined" ? "node" : "bun"
const failures: string[] = []
const check = (what: string, condition: boolean) => {
  if (!condition) failures.push(what)
}

// Every command below gets directories of its own: they also move the keyring entry, so nothing
// here can read the owner's linked device or message store.
const isolated = mkdtempSync(join(tmpdir(), "wa-smoke-"))
const wa = (...args: string[]) =>
  spawnSync(process.execPath, ["dist/bin/wa.js", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      WA_CONFIG_DIR: join(isolated, "config"),
      WA_STATE_DIR: join(isolated, "state"),
      WA_CACHE_DIR: join(isolated, "cache"),
      MESSAGING_STORE: join(isolated, "messages.db"),
      WA_NO_UPDATE_CHECK: "1",
      WA_PROFILE: "",
    },
  })

const version = wa("--version")
check("--version exits cleanly", version.status === 0)
check("--version prints a version on stdout", /^\d+\.\d+\.\d+$/.test(version.stdout.trim()))
check("--version says nothing on stderr", version.stderr === "")

check("--help names the command", wa("--help").stdout.includes("Usage: wa"))

const bad = wa("--nonsense")
check("an unknown option fails", bad.status !== 0)
check("an unknown option keeps stdout clean", bad.stdout === "")
check("an unknown option explains itself on stderr", bad.stderr.includes("unknown option"))

const skill = wa("skill", "show")
check("skill show prints the SKILL.md the package ships", skill.status === 0 && skill.stdout.startsWith("---"))

const doctor = wa("doctor", "--json")
check("doctor answers one JSON value with no login", doctor.stdout !== "" && JSON.parse(doctor.stdout) !== null)

// Every failure is kept as a run, so the unknown option above left one: the run directory and its
// atomic writes work under this runtime.
const runs = wa("runs", "list", "--json")
const [kept] =
  runs.status === 0 ? (JSON.parse(runs.stdout) as { items: { run_id: string; error_code?: string }[] }).items : []
check("runs list finds the failure that was kept", kept?.error_code === "validation_error")
check(
  "runs show answers with that run",
  JSON.parse(wa("runs", "show", kept?.run_id ?? "", "--json").stdout || "{}").item?.run_id === kept?.run_id,
)
check("doctor exits cleanly with no login", doctor.status === 0)

const offline = wa("chats", "list", "--offline", "--json")
check("an offline read with nothing recorded fails", offline.status !== 0)
check("and keeps stdout clean", offline.stdout === "")

// The published bin is a loader for dist/bundle/ (cli-dev bundle, WC-LAY-10): these load from the bundle.
const loader = readFileSync("dist/bin/wa.js", "utf8")
check("the bin starts the bundle", loader.includes('import("../bundle/wa.js")'))
const preloaded = [...loader.matchAll(/"\.\.\/bundle\/([^"]+)"/g)].map(([, chunk]) => chunk ?? "")
check(
  "a server preloads only chunks the bundle has",
  preloaded.length > 1 && preloaded.every((chunk) => existsSync(join("dist/bundle", chunk))),
)
const recorded = spawnSync(process.execPath, ["dist/bin/wa.js", "--version"], {
  encoding: "utf8",
  env: { ...process.env, WA_TEST_ARGV_LOG: join(isolated, "argv.jsonl") },
})
check("the loader's --version is the bundle's", recorded.stdout === version.stdout)
check("skill show finds cli-core's skills from the bundle", wa("skill", "show", "follow-ups").stdout.startsWith("---"))
// A profile takes a read as far as the store: its SQLite loads from cli-core's own dependencies.
wa("smoke", "config", "set", "limit", "20")
const stored = wa("smoke", "chats", "list", "--offline", "--json")
check("the store opens and has nothing recorded", stored.stderr.includes('"reason":"item.not-found"'))
check("doctor finds the document readers", wa("doctor", "--json").stdout.includes('"unpdf":"built in"'))

rmSync(isolated, { recursive: true, force: true })

if (failures.length > 0) {
  console.error(`wa smoke FAILED under ${runtime}:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`wa smoke passed under ${runtime}`)
