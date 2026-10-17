import * as v from "valibot"
import { type WaContact, waChat, waContact } from "./contract.js"

const jid = v.pipe(v.string(), v.includes("@"))
const time = v.pipe(v.string(), v.isoTimestamp())

export const waMember = v.strictObject({
  jid,
  name: v.nullable(v.string()),
  role: v.picklist(["owner", "admin", "member"]),
})

/**
 * A group in WhatsApp's own terms. `addMode` is who may add members; `announce`, only admins send; `locked`, only
 * admins change the name and description; `ephemeral`, seconds until messages disappear, 0 for never. `link` is
 * `null` unless it was asked for and the account may see it.
 */
export const waGroup = v.strictObject({
  chat: waChat,
  description: v.nullable(v.string()),
  link: v.nullable(v.string()),
  addMode: v.picklist(["admin_add", "all_member_add", ""]),
  approval: v.boolean(),
  announce: v.boolean(),
  locked: v.boolean(),
  ephemeral: v.number(),
  members: v.array(waMember),
})

/** `notAdded`: who could not be added, by their privacy or the group's limits, in the form they were named. */
export const waCreated = v.strictObject({ group: waGroup, notAdded: v.array(jid) })
export const waJoined = v.strictObject({ group: v.nullable(waGroup), requested: v.boolean() })
export const waNotAdded = v.strictObject({ notAdded: v.array(jid) })
export const waJoinRequest = v.strictObject({ jid, name: v.nullable(v.string()), requestedAt: v.nullable(time) })

/** `photo` is `null` when their privacy hides it; `verified` is WhatsApp's badge on an official business. */
export const waProfile = v.strictObject({
  jid,
  name: v.nullable(v.string()),
  about: v.nullable(v.string()),
  business: v.boolean(),
  verified: v.boolean(),
  contact: v.boolean(),
  photo: v.nullable(v.boolean()),
})

export type WaMember = v.InferOutput<typeof waMember>
export type WaGroup = v.InferOutput<typeof waGroup>
export type WaCreated = v.InferOutput<typeof waCreated>
export type WaJoined = v.InferOutput<typeof waJoined>
export type WaJoinRequest = v.InferOutput<typeof waJoinRequest>
export type WaProfile = v.InferOutput<typeof waProfile>

/** What `updateGroup` changes; a field left out stays. */
export interface WaGroupChange {
  title?: string
  description?: string
  addMode?: "admin_add" | "all_member_add"
  approval?: boolean
}

export type WaParticipantAction = "add" | "remove" | "promote" | "demote"

/** The engine's group and people requests. Every write here is seen by other people. */
export interface GroupEngine {
  /** One group and its members; the invite link only with `withLink`, and only when the account may see it. */
  group(jid: string, options?: { withLink?: boolean }): Promise<WaGroup>
  /** The people are told they were added. */
  createGroup(title: string, people: string[]): Promise<WaCreated>
  /** By an invite link; `requested` when the group's admins approve who joins. */
  join(link: string): Promise<WaJoined>
  leave(jid: string): Promise<void>
  updateGroup(jid: string, change: WaGroupChange): Promise<WaGroup>
  /** A new invite link; the old one stops working. */
  resetInviteLink(jid: string): Promise<WaGroup>
  /** Adds, removes, promotes to admin or demotes; only `add` may leave some out. */
  participants(jid: string, action: WaParticipantAction, people: string[]): Promise<{ notAdded: string[] }>
  joinRequests(jid: string): Promise<WaJoinRequest[]>
  answerJoinRequest(jid: string, person: string, accept: boolean): Promise<void>
  /** Reading it tells them nothing. */
  profile(jid: string): Promise<WaProfile>
  block(jid: string, blocked: boolean): Promise<void>
  /** Whether one number has WhatsApp; nothing is sent to it. The engine takes one lookup every few seconds. */
  lookup(phone: string): Promise<WaContact>
  /** The phone's address book, as the engine's store holds it. */
  contacts(): Promise<WaContact[]>
}

export type EngineRequest = <T>(
  op: string,
  fields: Record<string, unknown>,
  schema: v.GenericSchema<unknown, T>,
) => Promise<T>

const nothing = v.nullable(v.unknown())

/** The group and people requests over the Go engine's JSON lines. */
export const goGroups = (request: EngineRequest): GroupEngine => ({
  group: (jid, { withLink = false } = {}) => request("group", { jid, ...(withLink ? { withLink } : {}) }, waGroup),
  createGroup: (title, people) => request("createGroup", { title, people }, waCreated),
  join: (link) => request("join", { link }, waJoined),
  leave: async (jid) => {
    await request("leave", { jid }, nothing)
  },
  updateGroup: (jid, change) => request("updateGroup", { jid, ...change }, waGroup),
  resetInviteLink: (jid) => request("resetLink", { jid }, waGroup),
  participants: (jid, action, people) => request("participants", { jid, action, people }, waNotAdded),
  joinRequests: (jid) => request("requests", { jid }, v.array(waJoinRequest)),
  answerJoinRequest: async (jid, person, accept) => {
    await request("answerRequest", { jid, people: [person], accept }, nothing)
  },
  profile: (jid) => request("profile", { jid }, waProfile),
  block: async (jid, blocked) => {
    await request("block", { jid, blocked }, nothing)
  },
  lookup: (phone) => request("lookup", { phone }, waContact),
  contacts: () => request("contacts", {}, v.array(waContact)),
})
