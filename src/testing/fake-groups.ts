import type { Seed } from "@wirecat/cli-core/testing"
import * as v from "valibot"
import { EngineError, type WaChat } from "../engine/contract.js"
import {
  type GroupEngine,
  type WaGroup,
  type WaGroupChange,
  type WaParticipantAction,
  waGroup,
} from "../engine/groups.js"

export interface GroupAction {
  op: "createGroup" | "join" | "leave" | "updateGroup" | "resetLink" | WaParticipantAction | "answerRequest" | "block"
  jid?: string
  people?: string[]
  change?: WaGroupChange
  accept?: boolean
  blocked?: boolean
}

export interface FakeGroups extends GroupEngine {
  /** Every group or people write, in order. */
  groupActions: GroupAction[]
}

const LINK = "https://chat.whatsapp.com/FAKE0000000000000000AA"

/** Who asks to join every group: a person the seed does not know. */
export const REQUESTER = "100000000000099@lid"

/**
 * The engine's group and people requests over cli-core's seed. The account owns every group; each answer is checked
 * against the contract, as the Go engine's is by the client.
 */
export const fakeGroups = (seed: Seed, chats: WaChat[]): FakeGroups => {
  const groupActions: GroupAction[] = []
  const changed = new Map<string, WaGroupChange>()

  const groupOf = (jid: string, withLink = false): WaGroup => {
    const chat = chats.find((one) => one.jid === jid && one.kind === "group")
    if (!chat) throw new EngineError("not_found", "WhatsApp has no such chat")
    const change = changed.get(jid) ?? {}
    const members = (seed.members[jid] ?? []).map((member) => ({
      jid: member.id,
      name: member.name,
      role: member.id === seed.account?.id ? ("owner" as const) : ("member" as const),
    }))
    return v.parse(waGroup, {
      chat: { ...chat, name: change.title ?? chat.name },
      description: change.description ?? null,
      link: withLink ? LINK : null,
      addMode: change.addMode ?? "all_member_add",
      approval: change.approval ?? false,
      announce: change.announce ?? false,
      locked: change.locked ?? false,
      ephemeral: change.ephemeral ?? 0,
      members,
    })
  }

  const person = (jid: string) => {
    const found = seed.people.find((one) => one.id === jid)
    if (!found) throw new EngineError("not_found", "WhatsApp has no such person")
    return found
  }

  return {
    groupActions,
    group: async (jid, { withLink = false } = {}) => groupOf(jid, withLink),
    createGroup: async (title, people) => {
      groupActions.push({ op: "createGroup", people })
      const jid = "120363999999999999@g.us"
      chats.push({
        jid,
        name: title,
        kind: "group",
        unread: null,
        lastMessageAt: null,
        participants: people.length + 1,
      })
      return { group: groupOf(jid), notAdded: [] }
    },
    join: async (link) => {
      groupActions.push({ op: "join" })
      if (link.includes("APPROVAL")) return { group: null, requested: true }
      return { group: groupOf(seed.busy), requested: false }
    },
    leave: async (jid) => {
      groupActions.push({ op: "leave", jid })
    },
    updateGroup: async (jid, change) => {
      groupActions.push({ op: "updateGroup", jid, change })
      changed.set(jid, { ...changed.get(jid), ...change })
      return groupOf(jid, true)
    },
    resetInviteLink: async (jid) => {
      groupActions.push({ op: "resetLink", jid })
      return groupOf(jid, true)
    },
    participants: async (jid, action, people) => {
      groupActions.push({ op: action, jid, people })
      return { notAdded: [] }
    },
    joinRequests: async () => [
      { jid: REQUESTER, name: "Synthetic Requester", requestedAt: "2026-09-01T10:00:00.000Z" },
    ],
    answerJoinRequest: async (jid, requester, accept) => {
      groupActions.push({ op: "answerRequest", jid, people: [requester], accept })
    },
    profile: async (jid) => {
      const found = person(jid)
      return {
        jid,
        name: found.name,
        about: found.description,
        business: false,
        verified: false,
        contact: true,
        photo: true,
      }
    },
    block: async (jid, blocked) => {
      groupActions.push({ op: "block", jid, blocked })
    },
    lookup: async () => {
      const first = seed.people[0]
      if (!first) throw new EngineError("not_found", "nobody on WhatsApp has that number")
      return { jid: first.id, name: first.name }
    },
    contacts: async () => seed.people.map((one) => ({ jid: one.id, name: one.name })),
  }
}
