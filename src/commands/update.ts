import { annotate } from "@wirecat/cli-base/commands"
import { environmentOf, outputFor, restartServers, upgradeCommand as sharedUpgradeCommand } from "@wirecat/cli-core/cli"
import { WA } from "../app.js"
import type { Environment } from "../messenger.js"
import { installer, latest, PACKAGE, runUpdate, waScript } from "../update.js"

export const upgradeCommand = () =>
  annotate(
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
    }),
    { examples: ["wa upgrade --check", "wa upgrade"] },
  )
