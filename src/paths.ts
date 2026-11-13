import { realpathSync } from "node:fs"
import { userInfo } from "node:os"
import { join } from "node:path"
import { isMovedRun, type Paths, resolvePaths } from "@wirecat/cli-base"
import { WA } from "./app.js"

export const pathsFor = (env: NodeJS.ProcessEnv = process.env): Paths =>
  resolvePaths({ appName: WA.appName, prefix: WA.envPrefix, env })

/** The engine's device store: the linked device's keys, a credential as good as a password. One device per file. */
export const privateStore = (profile: string, env: NodeJS.ProcessEnv = process.env): string =>
  join(pathsFor(env).state, "profiles", profile, "private.db")

const accountHome = (): string | undefined => {
  try {
    return userInfo().homedir
  } catch {
    return undefined
  }
}

/**
 * **A run with moved folders whose device keys are the owner's own**: only the config or cache folder moved, so the
 * state folder, and the linked device in it, is the one the owner's own runs use. Such a run may use the device but
 * never unlink or delete it (WC-SECR-24), as max's `usesOwnersSignIn` keeps the owner's token.
 */
export const usesOwnersDevice = (profile: string, env: NodeJS.ProcessEnv): boolean => {
  const home = accountHome()
  if (home === undefined || !isMovedRun({ appName: WA.appName, prefix: WA.envPrefix, env })) return false
  const [run, owners] = [privateStore(profile, env), privateStore(profile, { HOME: home, USERPROFILE: home })]
  if (run === owners) return true
  try {
    return realpathSync.native(run) === realpathSync.native(owners)
  } catch {
    return false
  }
}
