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

export interface DiscoveryEngine {
  folders(): Promise<v.InferOutput<typeof waLabel>[]>
  saveContact(jid: string, contactName: string, options?: { firstName?: string; phonebook?: boolean }): Promise<void>
  /** For live checks: whether `phone` (digits) is the linked account's number, and its last four digits. */
  ownNumber(phone: string): Promise<v.InferOutput<typeof waOwnNumber>>
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
  folders: () => request("folders", {}, v.array(waLabel)),
  inspect: (link) => request("inspect", { link }, waPreview),
  devices: () => request("devices", {}, v.array(waDevice)),
})
