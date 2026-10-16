import { join } from "node:path"
import { type Paths, resolvePaths } from "@wirecat/cli-base"
import { WA } from "./app.js"

export const pathsFor = (env: NodeJS.ProcessEnv = process.env): Paths =>
  resolvePaths({ appName: WA.appName, prefix: WA.envPrefix, env })

/** The engine's device store: the linked device's keys, a credential as good as a password. One device per file. */
export const sessionFile = (profile: string, env: NodeJS.ProcessEnv = process.env): string =>
  join(pathsFor(env).state, "profiles", profile, "session.db")
