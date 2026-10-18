import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { engineEvent, waHistory } from "./contract.js"

const rekey = { from: "70000000009@s.whatsapp.net", to: "100000000000001@lid" }

describe("the re-key on the wire", () => {
  it("reads a re-key event and a history push that carries re-keys", () => {
    expect(v.parse(engineEvent, { event: "rekey", ...rekey })).toEqual({ event: "rekey", ...rekey })
    const push = { kind: "recent", chats: [], contacts: [], messages: [], votes: [], rekeys: [rekey] }
    expect(v.parse(waHistory, push).rekeys).toEqual([rekey])
  })

  it("refuses a re-key that is not two JIDs", () => {
    expect(v.safeParse(engineEvent, { event: "rekey", from: "70000000009", to: rekey.to }).success).toBe(false)
    expect(v.safeParse(engineEvent, { event: "rekey", ...rekey, chat: rekey.to }).success).toBe(false)
  })
})
