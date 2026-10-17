import { execFileSync } from "node:child_process"
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { assertPrivate } from "./private-files.js"

it("detects a synthetic file made readable by other users", () => {
  const path = join(mkdtempSync(join(tmpdir(), "wa-permissions-")), "fixture")
  writeFileSync(path, "synthetic permission control", { mode: 0o600 })
  assertPrivate(path, 0o600)
  if (process.platform === "win32") {
    execFileSync("icacls.exe", [path, "/grant", "*S-1-1-0:R"], { stdio: "pipe", windowsHide: true })
  } else chmodSync(path, 0o644)
  expect(() => assertPrivate(path, 0o600)).toThrow()
})
