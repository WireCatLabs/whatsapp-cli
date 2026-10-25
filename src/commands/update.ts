import { environmentOf, outputFor, restartServers, upgradeCommand as sharedUpgradeCommand } from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { WA } from "../app.js"
import type { Environment } from "../messenger.js"
import { installer, latest, PACKAGE, runUpdate, waScript } from "../update.js"

export const upgradeCommand = (): Command =>
  sharedUpgradeCommand(WA, PACKAGE, (command) => {
    const context = environmentOf<Environment>(command)
    const environment = context.update ?? {}
    const env = context.env ?? process.env
    return {
      ...outputFor(command),
      installer: () => installer(environment),
      latest: () => latest(environment),
      install: (argv) => runUpdate(argv, environment),
      afterUpdate: () => restartServers(WA, waScript(), env, environment.spawn),
    }
  })
