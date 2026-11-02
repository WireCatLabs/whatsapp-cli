#!/usr/bin/env node
import { enableCompileCache } from "node:module"
import { errorObjectOf, exitCodeOfError, renderError } from "@wirecat/cli-base"
import { wcatStart } from "@wirecat/cli-base/wcat/start"
import { WA } from "../identity.js"

// Compiling the module files is most of a start; later runs reuse what this one compiled.
enableCompileCache()
const wcat = await wcatStart({
  command: WA.command,
  version: WA.version,
  description: WA.description,
  docs: "https://github.com/WireCatLabs/whatsapp-cli#readme",
})
if (wcat.code !== undefined) {
  process.exitCode = wcat.code
} else {
  const { startCli } = await import("@wirecat/cli-core/cli/start")
  await startCli({
    app: WA,
    sqlite: true,
    // A static import would load the whole program, and its SQLite, before ensureSqlite could swap it.
    run: async ({ args }) => (await import("../program.js")).run(args),
    fail: (error, { tty }) => {
      const object = errorObjectOf(error)
      process.stderr.write(`${renderError(object, { cli: WA.command, interactive: tty })}\n`)
      return exitCodeOfError(object)
    },
  })
}
