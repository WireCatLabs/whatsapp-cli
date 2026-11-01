import { accessSync, closeSync, constants, existsSync, openSync, readSync, statSync } from "node:fs"
import { dirname } from "node:path"
import { engineBinary } from "./engine-binary.js"
import { privateStore } from "./paths.js"
import { installer, type UpdateEnvironment } from "./update.js"

const octal = (mode: number) => `0${mode.toString(8)}`

/** Whether the engine binary is there to start — never started here. */
export const engineState = (
  env: NodeJS.ProcessEnv,
  update: UpdateEnvironment = {},
): {
  path: string
  found: boolean
  hint?: string
} => {
  const path = engineBinary(env)
  try {
    accessSync(path, constants.X_OK)
    return { path, found: true }
  } catch {
    const hint =
      installer(update) === "checkout"
        ? "build it with `pnpm engine:build`"
        : "reinstall wa, or set WA_ENGINE to the engine's path"
    return { path, found: false, hint }
  }
}

/** The device keys' file modes, from `stat` alone: the keys are a credential and are never opened here. */
export const deviceModes = (
  storePath: string,
  platform: NodeJS.Platform = process.platform,
):
  | { checked: false; reason: string }
  | { checked: true; ok: boolean; problems: { path: string; mode: string; want: string; fix: string }[] } => {
  if (platform === "win32") return { checked: false, reason: "Windows has no Unix file modes" }
  const wanted: [string, number][] = [
    ...[storePath, `${storePath}-wal`, `${storePath}-shm`].map((path): [string, number] => [path, 0o600]),
    [dirname(storePath), 0o700],
  ]
  const problems = wanted.flatMap(([path, want]) => {
    if (!existsSync(path)) return []
    const mode = statSync(path).mode & 0o777
    if ((mode & 0o077) === 0) return []
    return [
      {
        path,
        mode: octal(mode),
        want: octal(want),
        fix: `chmod ${want.toString(8)} '${path.replaceAll("'", `'\\''`)}'`,
      },
    ]
  })
  return { checked: true, ok: problems.length === 0, problems }
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM"
  }
}

/**
 * Who last held the device's lock, from the name the engine writes into it. The engine never clears that name, so
 * the holder counts as running only while a process with its pid is.
 */
export const lockState = (
  lockPath: string,
): { path: string; holder: string | null; pid: number | null; running: boolean } => {
  if (!existsSync(lockPath)) return { path: lockPath, holder: null, pid: null, running: false }
  const buffer = Buffer.alloc(200)
  const fd = openSync(lockPath, "r")
  let read: number
  try {
    read = readSync(fd, buffer, 0, buffer.length, 0)
  } finally {
    closeSync(fd)
  }
  const holder = buffer.subarray(0, read).toString("utf8").split("\n")[0]?.trim() || null
  const pid = Number(/\(pid (\d+)\)$/.exec(holder ?? "")?.[1]) || null
  return { path: lockPath, holder, pid, running: pid !== null && alive(pid) }
}

/** `doctor`'s WhatsApp block: the engine, the device keys and the lock, read from disk without starting anything. */
/** WhatsApp drops a linked device whose phone has been away about two weeks; mautrix-whatsapp warns at 12 days. */
export const PHONE_AWAY_WARN_DAYS = 12

const DAY_MS = 24 * 60 * 60 * 1000

/** When the engine last saw the phone online, from the stamp beside the keys (`engine/cmd/wa-engine/phoneseen.go`). */
export const phoneState = (
  storePath: string,
  now = Date.now(),
): { last_seen: string | null; days_away: number | null; warning?: string } => {
  const stamp = `${storePath}.phone-seen`
  if (!existsSync(stamp)) return { last_seen: null, days_away: null }
  const seen = statSync(stamp).mtimeMs
  const days = Math.floor((now - seen) / DAY_MS)
  return {
    last_seen: new Date(seen).toISOString(),
    days_away: days,
    ...(days >= PHONE_AWAY_WARN_DAYS
      ? {
          warning: `the phone has not been online for ${days} days; open WhatsApp on it before WhatsApp unlinks this device`,
        }
      : {}),
  }
}

export const diagnoseWhatsApp = (
  profile: string,
  env: NodeJS.ProcessEnv,
  update?: UpdateEnvironment,
): {
  engine: ReturnType<typeof engineState>
  device: { path: string; exists: boolean; files: ReturnType<typeof deviceModes> }
  lock: ReturnType<typeof lockState>
  phone: ReturnType<typeof phoneState>
} => {
  const store = privateStore(profile, env)
  return {
    engine: engineState(env, update),
    device: { path: store, exists: existsSync(store), files: deviceModes(store) },
    lock: lockState(`${store}.lock`),
    phone: phoneState(store),
  }
}
