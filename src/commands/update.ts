import {
  environmentOf,
  outputFor,
  servingProfiles,
  upgradeCommand as sharedUpgradeCommand,
  usableProfileName,
} from "@wirecat/cli-core/cli"
import { WA } from "../app.js"
import type { Environment } from "../messenger.js"
import { installer, latest, PACKAGE, restartServer, runUpdate, type UpdateEnvironment } from "../update.js"

export const upgradeCommand = () =>
  sharedUpgradeCommand(WA, PACKAGE, (command) => {
    const context = environmentOf<Environment>(command)
    const environment = context.update ?? {}
    const env = context.env ?? process.env
    return {
      ...outputFor(command),
      installer: () => installer(environment),
      latest: () => latest(environment),
      install: (argv) => runUpdate(argv, environment),
      afterUpdate: () => restartServers(env, environment),
    }
  })

/**
 * A running serve keeps the code it started with; the update replaced the files under it. Each is
 * restarted by the new wa — `server restart` refuses a serve started by hand, which is then named.
 */
const restartServers = (env: NodeJS.ProcessEnv, environment: UpdateEnvironment) => {
  const restarted: string[] = []
  const left: string[] = []
  for (const profile of servingProfiles(WA, env)) {
    try {
      usableProfileName(profile)
    } catch {
      continue
    }
    const code = restartServer(profile, env, environment)
    ;(code === 0 ? restarted : left).push(profile)
  }
  return { restarted, left }
}
