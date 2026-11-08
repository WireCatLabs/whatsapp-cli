import * as v from "valibot"
import type { EngineRequest } from "./groups.js"

export const waPreview = v.strictObject({
  jid: v.string(),
  kind: v.picklist(["group", "newsletter"]),
  name: v.nullable(v.string()),
  description: v.nullable(v.string()),
  participants: v.nullable(v.number()),
  member: v.nullable(v.boolean()),
  approval: v.boolean(),
})

export const waDevice = v.strictObject({ id: v.number(), current: v.boolean() })

const waLabel = v.strictObject({ id: v.string(), name: v.string(), type: v.number(), chats: v.array(v.string()) })

const waOwnNumber = v.strictObject({ matches: v.boolean(), ends: v.string() })

/** `unchecked` for `lid_contact`, which the engine's store does not keep. */
const waOwnContact = v.strictObject({ readBack: v.picklist(["yes", "no", "unchecked"]) })

export interface DiscoveryEngine {
  folders(): Promise<v.InferOutput<typeof waLabel>[]>
  saveContact(jid: string, contactName: string, options?: { firstName?: string; phonebook?: boolean }): Promise<void>
  /** For live checks: whether `phone` (digits) is the linked account's number, and its last four digits. */
  ownNumber(phone: string): Promise<v.InferOutput<typeof waOwnNumber>>
  /**
   * For bin/fix-own-contact-name only: names one of the linked account's own contact entries, which `saveContact`
   * refuses: keyed by its phone id (`pn`), by its LID (`lid`), or the LID-only entry (`lid_contact`). No command calls
   * it (a test holds that).
   */
  saveOwnContact(key: "pn" | "lid" | "lid_contact", contactName: string): Promise<v.InferOutput<typeof waOwnContact>>
  commentGroup(jid: string): Promise<boolean>
  inspect(link: string): Promise<v.InferOutput<typeof waPreview>>
  devices(): Promise<v.InferOutput<typeof waDevice>[]>
}

export const goDiscovery = (request: EngineRequest): DiscoveryEngine => ({
  commentGroup: (jid) => request("commentGroup", { jid }, v.boolean()),
  saveContact: async (jid, contactName, options = {}) => {
    await request("saveContact", { jid, contactName, ...options }, v.nullable(v.unknown()))
  },
  ownNumber: (phone) => request("ownNumber", { phone }, waOwnNumber),
  saveOwnContact: (key, contactName) => request("saveOwnContact", { key, contactName }, waOwnContact),
  folders: () => request("folders", {}, v.array(waLabel)),
  inspect: (link) => request("inspect", { link }, waPreview),
  devices: () => request("devices", {}, v.array(waDevice)),
})
