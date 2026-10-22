import { describe, expect, it } from "vitest"
import { additions } from "./check-baseline.ts"

describe("baseline changes", () => {
  it("allows removals and reordering", () => {
    expect(additions(["messages send", "chats show", "account list"], ["account list", "messages send"])).toEqual([])
  })

  it("refuses replacing a violation even if the total shrinks", () => {
    expect(additions(["messages send", "chats show"], ["account list"])).toEqual(["account list"])
  })

  it("refuses new and duplicate entries", () => {
    expect(additions([], ["messages send"])).toEqual(["messages send"])
    expect(additions(["messages send"], ["messages send", "messages send"])).toEqual(["messages send"])
  })
})
