#!/usr/bin/env node
import { enableCompileCache } from "node:module"
import { errorObjectOf, exitCodeOfError, renderError } from "@wirecat/cli-base"

// Compiling the module files is most of a start; later runs reuse what this one compiled.
enableCompileCache()
// Loaded after the cache is on: the app identity already pulls in cli-core.
const [{ startCli }, { WA }] = await Promise.all([import("@wirecat/cli-core/cli"), import("../app.js")])
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
