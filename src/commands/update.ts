import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { environmentOf, outputFor, restartServers, upgradeCommand as sharedUpgradeCommand } from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { WA } from "../app.js"
import { enginePackage } from "../engine-binary.js"
import type { Environment } from "../messenger.js"
import { installer, latest, PACKAGE, runUpdate, waScript } from "../update.js"

/**
 * Whether the version just installed has its engine. A package manager skips an optional dependency it cannot fetch
 * without a word, and right after a release the registry may not serve the engine yet: a serve restarted then dies.
 * The script's link points at the new version once the install is done.
 */
export const engineInstalled = (script: string | undefined = process.argv[1]): boolean => {
  try {
    createRequire(realpathSync(script ?? "")).resolve(`${enginePackage()}/package.json`)
    return true
  } catch {
    return false
  }
}

export const upgradeCommand = (): Command =>
  sharedUpgradeCommand(WA, PACKAGE, (command) => {
    const context = environmentOf<Environment>(command)
    const environment = context.update ?? {}
    const env = context.env ?? process.env
    const output = outputFor(command)
    return {
      ...output,
      installer: () => installer(environment),
      latest: () => latest(environment),
      install: (argv) => runUpdate(argv, environment),
      afterUpdate: async () => {
        if (!(context.engineInstalled ?? engineInstalled)()) {
          output.renderer.warn(
            `the new version's engine (${enginePackage()}) did not install, so no serve was restarted — run ` +
              "`wa upgrade` again in a minute, or reinstall @wirecat/whatsapp-cli with the same package manager",
          )
          return { restarted: [], left: [] }
        }
        return restartServers(WA, waScript(), env, environment.spawn)
      },
    }
  })
