import { describe, expect, it } from "vitest"
import { additions, sharedWord } from "./check-baseline.ts"

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

  it("lets a word of a cli-core command into the baseline, and nothing else", () => {
    const shared = new Set(["images read"])
    expect(sharedWord("unknown-verb.json", "images read", shared)).toBe(true)
    expect(sharedWord("option-role.json", "images read --attachment", shared)).toBe(true)
    expect(sharedWord("unknown-verb.json", "bot templates read", shared)).toBe(false)
    expect(sharedWord("command-help-too-long.json", "images read", shared)).toBe(false)
  })
})
