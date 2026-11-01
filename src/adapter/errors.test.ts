import { describe, expect, it } from "vitest"
import { EngineError } from "../engine/contract.js"
import { fromEngine } from "./errors.js"

describe("ban end display", () => {
  it.each([
    ["Europe/Madrid", "2026-10-22 14:00:00"],
    ["Asia/Vladivostok", "2026-10-22 22:00:00"],
  ])("names %s while keeping the stored end in UTC", (zone, shown) => {
    const end = "2026-10-22T12:00:00.000Z"
    const error = fromEngine(new EngineError("permission_error", "Restricted", "account.banned", end), 0, zone)
    expect(error.message).toContain(`${shown} (${zone})`)
    expect(error.details.standing).toMatchObject({ until: end })
  })
})

describe("new-contacts restriction", () => {
  it("names when it ends and holds no other write", () => {
    const end = "2026-10-22T12:00:00.000Z"
    const error = fromEngine(
      new EngineError("permission_error", "Restricted", "account.reachout-restricted", end),
      0,
      "Europe/Madrid",
    )
    expect(error.message).toContain("until 2026-10-22 14:00:00 (Europe/Madrid)")
    expect(error.details).toMatchObject({ reason: "account.reachout-restricted", until: end })
    expect(error.details.standing).toBeUndefined()
  })
})
