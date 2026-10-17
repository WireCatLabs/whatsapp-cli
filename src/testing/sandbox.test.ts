import { homedir, tmpdir } from "node:os"
import { resolvePaths } from "@wirecat/cli-base"
import { storePath } from "@wirecat/cli-core/store"
import { describe, expect, it } from "vitest"
import { pathsFor, privateStore } from "../paths.js"

describe("the test sandbox", () => {
  // Windows keeps its temporary directory under the home folder, so "outside home" cannot be the test there.
  it("keeps every directory a test can write inside its own temporary root", () => {
    const root = tmpdir()
    const written = [
      ...Object.values(pathsFor()),
      resolvePaths({ appName: "WireCat", prefix: "WIRECAT" }).state,
      storePath(),
      privateStore("default"),
    ]

    expect(root).not.toBe(homedir())
    expect(root).toMatch(/wa-test-/)
    for (const path of written) expect(path.startsWith(root), path).toBe(true)
  })
})
