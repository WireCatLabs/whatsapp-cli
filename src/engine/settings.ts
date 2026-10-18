import * as v from "valibot"
import type { EngineRequest } from "./groups.js"

/** The engine's writes to the account's synced settings, which WhatsApp syncs to the account's other devices. */
export interface SettingsEngine {
  /** `until`: `forever`, an ISO 8601 time, or `null` to unmute. Nobody in the chat is told. */
  mute(jid: string, until: string | null): Promise<void>
}

const nothing = v.nullable(v.unknown())

export const goSettings = (request: EngineRequest): SettingsEngine => ({
  mute: async (jid, until) => {
    await request("mute", { jid, until }, nothing)
  },
})
