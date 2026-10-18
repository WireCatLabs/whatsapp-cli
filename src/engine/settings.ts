import * as v from "valibot"
import { keyFields, type WaAccount, type WaAnchor, type WaKey, waAccount } from "./contract.js"
import type { EngineRequest } from "./groups.js"

/** The account's own name, "about" line and photo; a field left out stays. */
export interface WaProfileChange {
  pushName?: string
  about?: string
  /** The new photo's absolute path: a square JPEG of 190 to 720 pixels a side, checked before anything changes. */
  path?: string
}

/** The engine's writes to the account's synced settings, which WhatsApp syncs to the account's other devices. */
export interface SettingsEngine {
  /** `until`: `forever`, an ISO 8601 time, or `null` to unmute. Nobody in the chat is told. */
  mute(jid: string, until: string | null): Promise<void>
  /**
   * The name goes to the owner's devices as a setting, then the about and the photo to WhatsApp; answers the account
   * as it now is.
   */
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
  /** Moves `last`'s chat into the archive, which unpins it, or back out; bounded by `last` as `deleteChat` is. */
  archiveChat(last: WaAnchor, archived: boolean): Promise<void>
  /** Pins the chat at the top of the account's chat list, or unpins it. Not a message pin. */
  pinChat(jid: string, pinned: boolean): Promise<void>
  /** Marks `last`'s chat unread on the account's devices; no receipt is sent or taken back. */
  markChatUnread(last: WaAnchor): Promise<void>
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
  archiveChat: async (last, archived) => {
    await request(
      archived ? "archiveChat" : "unarchiveChat",
      { ...keyFields(last), timestamp: last.timestamp },
      nothing,
    )
  },
  pinChat: async (jid, pinned) => {
    await request(pinned ? "pinChat" : "unpinChat", { jid }, nothing)
  },
  markChatUnread: async (last) => {
    await request("markChatUnread", { ...keyFields(last), timestamp: last.timestamp }, nothing)
  },
})
