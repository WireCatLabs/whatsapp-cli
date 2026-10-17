import { homedir, tmpdir } from "node:os"
import { resolvePaths } from "@wirecat/cli-base"
import { storePath } from "@wirecat/cli-core/store"
import { describe, expect, it } from "vitest"
import { pathsFor, privateStore } from "../paths.js"

describe("the test sandbox", () => {
  it("keeps every directory a test can write out of the owner's home", () => {
    const written = [
      ...Object.values(pathsFor()),
      resolvePaths({ appName: "WireCat", prefix: "WIRECAT" }).state,
      storePath(),
      privateStore("default"),
      tmpdir(),
    ]

    for (const path of written) expect(path.startsWith(homedir()), path).toBe(false)
  })
})
