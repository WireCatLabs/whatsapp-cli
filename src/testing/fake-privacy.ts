import * as v from "valibot"
import { EngineError } from "../engine/contract.js"
import { type PrivacyEngine, type WaPrivacy, type WaPrivacyChange, waPrivacy } from "../engine/privacy.js"

export interface FakePrivacy extends PrivacyEngine {
  /** Every privacy change sent, in order. */
  privacyChanges: WaPrivacyChange[]
}

/** Where a test starts unless it hands in other settings: everyone may add, see and call the account. */
export const DEFAULT_PRIVACY: WaPrivacy = { groupadd: "all", last: "all", online: "all", calladd: "all" }

/** The engine's privacy requests in memory, each answer checked against the contract as the Go engine's is. */
export const fakePrivacy = (start: WaPrivacy = DEFAULT_PRIVACY): FakePrivacy => {
  const now = { ...start }
  const privacyChanges: WaPrivacyChange[] = []
  return {
    privacyChanges,
    privacy: async () => v.parse(waPrivacy, now),
    setPrivacy: async (changes) => {
      if (changes.length === 0) throw new EngineError("validation_error", "no privacy setting to change")
      for (const change of changes) {
        privacyChanges.push(change)
        now[change.name] = change.value
      }
      return v.parse(waPrivacy, now)
    },
  }
}
