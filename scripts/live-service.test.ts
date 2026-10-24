import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = fileURLToPath(new URL("..", import.meta.url))
const helper = readFileSync(join(root, "bin/lib/live.sh"), "utf8")
const lifecycle = helper.slice(helper.indexOf("\nfind_serve() {") + 1)

// Every process and manager operation is a shell function; synthetic PIDs never reach the operating system.
const run = (
  mode = "managed",
  commands = "find_serve receiver --managed && stop_serve receiver && restore_serve receiver",
) => {
  const dir = mkdtempSync(join(tmpdir(), "wa-service-offline-"))
  try {
    const result = spawnSync(
      "sh",
      [
        "-c",
        `
set -eu
main=/fixture/wa
wa=/fixture/wa/bin/wa
mode=$1
default_profile=receiver
running=yes
current_pid=101
stopped=no
started=""
lock_of() { [ "$running" = yes ] && echo 'serve (pid 101)|102|true' || echo '||false'; }
remaining_lock=no
lock_held() {
  if [ "$mode" = one-shot-closing ] && [ "$running" = no ] && [ "$remaining_lock" = yes ]; then
    remaining_lock=no; return 0
  fi
  [ "$running" = yes ]
}
serve_running() { [ "$running" = yes ]; }
ps() {
  case "$*" in
    '-ww -o args= -p 102')
      if [ "$mode" = wrong-store ]; then own=another; else own=receiver; fi
      echo "/fixture/wa/engine/bin/wa-engine --store /fixture/wa/.wa/state/profiles/$own/private.db --holder serve" ;;
    '-o ppid= -p 102') echo 101 ;;
    '-ww -o args= -p 101')
      case "$mode" in
        direct | explicit-service) echo 'node /fixture/wa/dist/bin/wa.js receiver serve' ;;
        wrong-program) echo 'node /elsewhere/dist/bin/wa.js serve' ;;
        *) echo 'node /fixture/wa/dist/bin/wa.js serve' ;;
      esac ;;
    *) return 1 ;;
  esac
}
cat() {
  [ "$1" = /proc/101/cgroup ] || return 1
  if [ "$mode" = direct ] || [ "$mode" = unmanaged ]; then echo '0::/user.slice/app.scope'
  else echo '0::/user.slice/user@1000.service/app.slice/fixture.service'; fi
}
readlink() { return 1; }

sleep() { [ "$mode" != one-shot-closing ] || echo ACTION:wait; }
kill() {
  if [ "$1" = -0 ]; then [ "$running" = yes ]; return; fi
  echo 'unexpected kill' >&2; return 1
}
systemctl() {
  case "$*" in
    *--property=MainPID*)
      if [ "$mode" = wrong-manager ]; then echo 999; else echo "$current_pid"; fi ;;
    *--property=Environment*)
      case "$mode" in
        wrong-environment) echo 'WA_PROFILE=another WA_CONFIG_DIR=/fixture/wa/.wa/config WA_STATE_DIR=/fixture/wa/.wa/state' ;;
        wrong-path) echo 'WA_PROFILE=receiver WA_CONFIG_DIR=/elsewhere WA_STATE_DIR=/fixture/wa/.wa/state' ;;
        quoted-environment) echo 'OTHER=" WA_PROFILE=receiver " WA_CONFIG_DIR=/fixture/wa/.wa/config WA_STATE_DIR=/fixture/wa/.wa/state' ;;
        *) echo "WA_PROFILE=$default_profile WA_CONFIG_DIR=/fixture/wa/.wa/config WA_STATE_DIR=/fixture/wa/.wa/state" ;;
      esac ;;
    *--property=Transient*)
      if [ "$mode" = transient ]; then echo yes; else echo no; fi ;;
    *--property=ActiveState*) [ "$running" = yes ] && echo active || echo inactive ;;
    '--user --no-block stop -- fixture.service') echo ACTION:stop; running=no ;;
    '--user --no-block start -- fixture.service')
      echo ACTION:start
      [ "$mode" != start-failed ] || return 1
      running=yes; current_pid=103 ;;
    *) echo 'unexpected manager call' >&2; return 1 ;;
  esac
}
${lifecycle}
${commands}
echo "STATE:$running:$stopped:$started"
`,
        "fixture",
        mode,
      ],
      { encoding: "utf8", timeout: 5000, cwd: dir },
    )
    if (result.error) throw result.error
    return result
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe("owner-run managed serve lifecycle", () => {
  it.each(["managed", "explicit-service"])("pauses and restores a verified persistent user service: %s", (mode) => {
    const result = run(mode)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("ACTION:stop")
    expect(result.stdout).toContain("ACTION:start")
    expect(result.stdout).toContain("STATE:yes:no:103")
  })

  it.each([
    "wrong-store",
    "wrong-program",
    "wrong-manager",
    "transient",
    "unmanaged",
    "wrong-environment",
    "wrong-path",
    "quoted-environment",
  ])("refuses %s before any mutation", (mode) => {
    const result = run(mode, "find_serve receiver --managed || exit 1")
    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain("ACTION:")
  })

  it("keeps explicit-profile direct launches available", () => {
    const result = run("direct", 'find_serve receiver; test -z "$serve_unit"')
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).not.toContain("ACTION:")
  })

  it("does not enable managed default-profile launches for other live scripts", () => {
    const result = run("managed", "find_serve receiver || exit 1")
    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain("ACTION:")
  })

  it("rechecks the service PID before stopping it", () => {
    const result = run("managed", "find_serve receiver --managed; mode=wrong-manager; stop_serve receiver || exit 1")
    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain("ACTION:")
  })

  it("rechecks the unit environment before stopping an implicit-profile service", () => {
    const result = run(
      "managed",
      "find_serve receiver --managed; default_profile=another; stop_serve receiver || exit 1",
    )
    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain("ACTION:")
  })

  it("waits for a closing one-shot before asking the service to start", () => {
    const result = run(
      "one-shot-closing",
      "find_serve receiver --managed; stop_serve receiver; remaining_lock=yes; restore_serve receiver",
    )
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout.indexOf("ACTION:wait")).toBeGreaterThan(-1)
    expect(result.stdout.indexOf("ACTION:start")).toBeGreaterThan(result.stdout.indexOf("ACTION:wait"))
  })

  it("does not replace a failed service start with an unmanaged process", () => {
    const result = run(
      "start-failed",
      "find_serve receiver --managed; stop_serve receiver; restore_serve receiver || exit 1",
    )
    expect(result.status).not.toBe(0)
    expect(result.stdout.match(/ACTION:start/g)).toHaveLength(1)
    expect(result.stderr).not.toContain("unexpected")
  })
})
