import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

const root = fileURLToPath(new URL("..", import.meta.url))
const helper = readFileSync(join(root, "bin/lib/live.sh"), "utf8")
const parsing = helper.slice(helper.indexOf("\njson() {") + 1, helper.indexOf("# The device lock"))
const A = "100000000000001@lid"
const B = "100000000000002@lid"

const temporaryDirectories: string[] = []
afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// The copied runner sees only a synthetic CLI and lifecycle helpers; no real account, store or PID is reachable.
const run = (mode = "normal", args = ["receiver", "--sender-profile", "sender"], input = "\n") => {
  const dir = mkdtempSync(join(tmpdir(), "wa-oneshot-offline-"))
  temporaryDirectories.push(dir)
  const bin = join(dir, "bin")
  mkdirSync(join(bin, "lib"), { recursive: true })
  writeFileSync(join(dir, "package.json"), '{"type":"module"}')
  const state = join(dir, "state.json")
  writeFileSync(state, JSON.stringify({ running: true, pending: [], rows: [], actions: [] }))
  copyFileSync(join(root, "bin/live-oneshot-drop"), join(bin, "live-oneshot-drop"))
  copyFileSync(join(root, "scripts/fixtures/oneshot-cli.mjs"), join(bin, "wa"))
  writeFileSync(join(bin, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o700 })
  writeFileSync(
    join(bin, "lib/live.sh"),
    `
root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
main=$root
wa="$root/bin/wa"
die() { echo "$*" >&2; exit 1; }
wa_json() { node "$wa" "$@"; }
attempt() { out=$(node "$wa" "$@" 2>"$errs") && rc=0 || rc=$?; }
error_code() { json 'd.error.code' <"$errs"; }
${parsing}
serve_running() { node "$wa" __running; }
lock_of() { node "$wa" __lock; }
find_serve() { serve=101; engine=102; serve_err=/dev/null; case "$WA_ONESHOT_FIXTURE_MODE" in managed-*) serve_unit=fixture.service ;; esac; }
stop_serve() { stopped=yes; node "$wa" __stop; }
restore_serve() { [ "$stopped" = yes ] || return 0; node "$wa" __restore; stopped=no; started=103; }
hold_signals() { :; }
on_signals() { :; }
confirm() {
  case "$1" in
    "Step 2:"*) node "$wa" __phone "$marker" ;;
    "Step 5:"*) node "$wa" __phone "$control" ;;
  esac
  read -r unused || exit 130
}
`,
  )
  const result = spawnSync("sh", [join(bin, "live-oneshot-drop"), ...args], {
    encoding: "utf8",
    input,
    timeout: 15_000,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      WA_ONESHOT_FIXTURE_STATE: state,
      WA_ONESHOT_FIXTURE_MODE: mode,
    },
  })
  if (result.error) throw result.error
  const saved: {
    running: boolean
    rows: { account: string; chat: string; text: string }[]
    actions: {
      action: string
      profile?: string
      target?: string
      confirmed?: boolean
      account?: string
      chat?: string
    }[]
  } = JSON.parse(readFileSync(state, "utf8"))
  return { ...result, saved }
}

describe.skipIf(process.platform === "win32")("owner-run automatic one-shot regression", () => {
  it("sends twice from the explicit sender and proves receiver persistence before restarting serve", () => {
    const result = run()
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("PASS: the one-shot saved")
    expect(result.stdout).not.toMatch(/10000000000000[12]@lid|synthetic-message-|wacheck\d|wacontrol\d/)
    expect(result.saved.actions.filter((one) => ["stop", "send", "doctor", "restore"].includes(one.action))).toEqual([
      { action: "stop" },
      { action: "send", profile: "sender", target: A, confirmed: true },
      { action: "doctor", profile: "receiver" },
      { action: "restore" },
      { action: "send", profile: "sender", target: A, confirmed: true },
    ])
    for (const read of result.saved.actions.filter((one) => ["search", "list"].includes(one.action)))
      expect(read).toMatchObject({ account: A, chat: B })
    expect(result.saved.running).toBe(true)
  })

  it("does not mistake the sender's saved rows for delivery to the receiver", () => {
    const result = run("drop-marker")
    expect(result.saved.rows.filter((one) => one.account === B)).toHaveLength(2)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("FAIL: the marker was lost")
    expect(result.saved.running).toBe(true)
  })

  it.each(["receiver-restarted", "lock-unreadable", "send-preview"])(
    "refuses an uncertain connection or send: %s",
    (mode) => {
      const result = run(mode)
      expect(result.status).toBe(2)
      expect(result.saved.running).toBe(true)
      expect(result.stdout).not.toContain("PASS:")
    },
  )

  it("fails if a saved marker disappears after restart", () => {
    const result = run("lost-after-restart")
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("FAIL:")
    expect(result.saved.running).toBe(true)
  })

  it("does not count delivery after restart as proof of one-shot preservation", () => {
    const result = run("late-marker")
    expect(result.status).toBe(2)
    expect(result.stdout).toContain("INCONCLUSIVE:")
    expect(result.stdout).not.toContain("PASS:")
  })

  it.each(["managed-send-refused", "managed-receiver-restarted"])(
    "restores through the manager on early exit: %s",
    (mode) => {
      const result = run(mode)
      expect(result.status).toBe(2)
      expect(result.saved.running).toBe(true)
      expect(result.saved.actions.filter((one) => one.action === "restore")).toHaveLength(1)
    },
  )

  it.each(["send-refused", "doctor-failed"])("restores serve and refuses a pass after %s", (mode) => {
    const result = run(mode)
    expect(result.status).toBe(2)
    expect(result.saved.running).toBe(true)
    expect(result.saved.actions.filter((one) => one.action === "restore")).toHaveLength(1)
    expect(result.stdout).not.toContain("PASS:")
  })

  it.each([
    ["receiver", "--sender-profile", "receiver"],
    ["receiver", "--sender-profile", "same"],
    ["receiver", "--sender-profile", "missing"],
    ["receiver", "--sender-profile"],
  ])("refuses invalid profile selections before stopping or sending: %j", (...args) => {
    const result = run("normal", args)
    expect(result.status).not.toBe(0)
    expect(result.saved.actions).toEqual([])
    expect(result.saved.running).toBe(true)
  })

  it("keeps manual own-chat mode and sends nothing through the CLI", () => {
    const result = run("normal", ["receiver"], "\n\n\n")
    expect(result.status, result.stderr).toBe(0)
    expect(result.saved.actions.filter((one) => one.action === "send")).toEqual([])
    expect(result.saved.actions.filter((one) => one.action === "phone")).toHaveLength(2)
    for (const read of result.saved.actions.filter((one) => ["search", "list"].includes(one.action)))
      expect(read).toMatchObject({ account: A, chat: A })
  })

  it("leaves serve untouched when the initial confirmation or baseline read fails", () => {
    for (const result of [run("normal", undefined, ""), run("read-failed")]) {
      expect(result.status).not.toBe(0)
      expect(result.saved.actions.filter((one) => ["stop", "send", "doctor", "restore"].includes(one.action))).toEqual(
        [],
      )
      expect(result.saved.running).toBe(true)
    }
  })
})
