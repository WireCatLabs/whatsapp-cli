import * as v from "valibot"
import { type WaAccount, waAccount } from "./contract.js"
import type { EngineRequest } from "./groups.js"

/** The account's own name and "about" line; a field left out stays. */
export interface WaProfileChange {
  pushName?: string
  about?: string
}

/** The engine's writes to the account's synced settings, which WhatsApp syncs to the account's other devices. */
export interface SettingsEngine {
  /** `until`: `forever`, an ISO 8601 time, or `null` to unmute. Nobody in the chat is told. */
  mute(jid: string, until: string | null): Promise<void>
  /** The name goes to the owner's devices as a setting, the about to WhatsApp; answers the account as it now is. */
  updateProfile(change: WaProfileChange): Promise<WaAccount>
}

const nothing = v.nullable(v.unknown())

export const goSettings = (request: EngineRequest): SettingsEngine => ({
  mute: async (jid, until) => {
    await request("mute", { jid, until }, nothing)
  },
  updateProfile: (change) => request("updateProfile", { ...change }, waAccount),
})
