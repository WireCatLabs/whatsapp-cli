import * as v from "valibot"
import { keyFields, type WaAccount, type WaAnchor, type WaKey, waAccount } from "./contract.js"
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
  /**
   * Deletes `last`'s chat from the account's devices, up to `last`, the chat's newest stored message: WhatsApp needs
   * it to know what the deletion covers. The photos and files the phone saved from it stay. Nobody else is told.
   */
  deleteChat(last: WaAnchor): Promise<void>
  /** Deletes every message of `last`'s chat up to `last`, starred ones too, and keeps the chat; as `deleteChat`. */
  clearChat(last: WaAnchor): Promise<void>
  /**
   * Deletes `message` from the account's devices alone; the others in the chat keep it. WhatsApp names the message by
   * its key and the time it was sent, both from the store. The photos and files the phone saved from it stay.
   */
  deleteForMe(message: WaAnchor): Promise<void>
  /** Stars `message`, or takes the star off, on the account's devices alone; nobody in the chat is told. */
  star(message: WaKey, starred: boolean): Promise<void>
}

const nothing = v.nullable(v.unknown())

export const goSettings = (request: EngineRequest): SettingsEngine => ({
  mute: async (jid, until) => {
    await request("mute", { jid, until }, nothing)
  },
  updateProfile: (change) => request("updateProfile", { ...change }, waAccount),
  deleteChat: async (last) => {
    await request("deleteChat", { ...keyFields(last), timestamp: last.timestamp }, nothing)
  },
  clearChat: async (last) => {
    await request("clearChat", { ...keyFields(last), timestamp: last.timestamp }, nothing)
  },
  deleteForMe: async (message) => {
    await request("deleteForMe", { ...keyFields(message), timestamp: message.timestamp }, nothing)
  },
  star: async (message, starred) => {
    await request("star", { ...keyFields(message), starred }, nothing)
  },
})
