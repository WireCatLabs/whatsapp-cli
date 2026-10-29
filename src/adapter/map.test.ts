import { describe, expect, it } from "vitest"
import { toSharedContact } from "./map.js"

describe("a shared contact card", () => {
  it("takes the name parts and the first number, whatever the property group or parameters", () => {
    const vcard =
      "BEGIN:VCARD\r\nN:Lee;Ann;;;\r\nFN:Ann Lee\r\nitem1.TEL;type=CELL;waid=0:+00 000 000 0001\r\nTEL:+00 000 000 0002\r\nEND:VCARD"
    expect(toSharedContact({ name: "x", vcard })).toEqual({
      name: "Ann Lee",
      firstName: "Ann",
      lastName: "Lee",
      phone: "+00 000 000 0001",
    })
  })

  it("keeps the message's name when the card has none and no number", () => {
    expect(toSharedContact({ name: "Ann", vcard: "BEGIN:VCARD\nEND:VCARD" })).toEqual({ name: "Ann" })
  })
})
