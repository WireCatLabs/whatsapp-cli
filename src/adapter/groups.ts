import { open } from "node:fs/promises"
import { CliError, isCliError } from "@wirecat/cli-base"
import type { AdminRight, Chat, GroupCard, GroupMember, ProfileFacts } from "@wirecat/cli-core"
import type { MessengerAdapter } from "@wirecat/cli-core/cli"
import type { UploadSource } from "@wirecat/cli-core/sends"
import type { WhatsAppEngine } from "../engine/contract.js"
import type { WaGroup, WaGroupChange } from "../engine/groups.js"
import { toChat, toMember } from "./map.js"

/** Group moderation and admin, join requests, profiles, blocking, number lookup and the account's health. */
export type GroupAdapter = Required<
  Pick<
    MessengerAdapter,
    | "members"
    | "admins"
    | "people"
    | "createGroup"
    | "join"
    | "leave"
    | "group"
    | "updateGroup"
    | "resetInviteLink"
    | "addMembers"
    | "removeMembers"
    | "addAdmin"
    | "removeAdmin"
    | "joinRequests"
    | "answerJoinRequest"
    | "profile"
    | "block"
    | "unblock"
    | "lookup"
    | "addressBook"
    | "health"
  >
>

/** What a WhatsApp admin may do. WhatsApp has one kind of admin, with all of these at once. */
export const ADMIN_RIGHTS = [
  "members",
  "admins",
  "info",
  "pin",
  "link",
  "post",
  "delete",
] as const satisfies AdminRight[]

/** The switches of cli-core's `chats update` that WhatsApp has. */
export const GROUP_SETTINGS = [
  "onlyAdminsAdd",
  "joinApproval",
  "onlyAdminsSend",
  "onlyAdminsEditInfo",
  "disappearingSeconds",
] as const

/** The timers WhatsApp's apps offer, in seconds; its server refuses any other in a group. */
const DISAPPEARING_SECONDS = [0, 86_400, 604_800, 7_776_000]

/** WhatsApp refuses a longer group name; the engine's `groupNameLimit`. */
const GROUP_NAME_LIMIT = 25

const isPerson = (id: string) => id.endsWith("@lid") || id.endsWith("@s.whatsapp.net")

/** A group as `chats update` and `chats create` answer it. */
export const toGroupCard = (group: WaGroup): GroupCard => {
  const chat = toChat(group.chat)
  return {
    ...chat,
    description: group.description,
    link: group.link,
    settings: {
      allCanPin: null,
      onlyAdminsAdd: group.addMode === "" ? null : group.addMode === "admin_add",
      onlyAdminsCall: null,
      onlyOwnerEditsInfo: null,
      membersSeeLink: null,
      joinApproval: group.approval,
      onlyAdminsSend: group.announce,
      onlyAdminsEditInfo: group.locked,
      disappearingSeconds: group.ephemeral,
    },
  }
}

const toGroupMember = ({ jid, name, role }: WaGroup["members"][number]): GroupMember => ({
  id: jid,
  name,
  username: null,
  role,
})

export interface GroupDeps {
  engine: WhatsAppEngine
  resolve: (reference: string) => Promise<Chat>
  translated: <T>(work: Promise<T>) => Promise<T>
  /** Whether the owner has written to this person; from cli-core's store. */
  wroteTo: (personId: string) => Promise<boolean>
  /** An upload as a file the engine can read. */
  onDisk: <T>(source: UploadSource, work: (path: string) => Promise<T>) => Promise<T>
}

// A JPEG starts with a start-of-image marker and then another marker; the file's name says nothing.
export const isJpeg = async (source: UploadSource): Promise<boolean> => {
  const head = Buffer.alloc(3)
  if (source.kind === "bytes") head.set(source.bytes.subarray(0, 3))
  else {
    const file = await open(source.path)
    try {
      await file.read(head, 0, 3, 0)
    } finally {
      await file.close()
    }
  }
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
}

export const groupAdapter = ({ engine, resolve, translated, wroteTo, onDisk }: GroupDeps): GroupAdapter => {
  const groupId = async (reference: string): Promise<string> => {
    const { id } = await resolve(reference)
    if (!id.endsWith("@g.us")) throw new CliError("validation_error", "that chat is not a WhatsApp group")
    return id
  }

  const personId = async (reference: string): Promise<string> => {
    const { id } = await resolve(reference)
    if (!isPerson(id)) throw new CliError("validation_error", "that is a chat, not a person")
    return id
  }

  // WhatsApp bans accounts that add strangers to groups, so only someone in the address book or written to before.
  const refuseStrangers = async (people: string[]) => {
    const book = new Set((await translated(engine.contacts())).map((contact) => contact.jid))
    for (const person of people) {
      if (book.has(person) || (await wroteTo(person))) continue
      throw new CliError(
        "permission_error",
        "wa adds only people in your address book or that you have written to — WhatsApp bans accounts that add strangers",
      )
    }
  }

  return {
    members: async (chat, { limit, offset }) => {
      const group = await translated(engine.group(await groupId(chat)))
      const end = limit === undefined ? group.members.length : offset + limit
      return {
        chatId: group.chat.jid,
        items: group.members.slice(offset, end).map(toGroupMember),
        hasMore: group.members.length > end,
        participantsCount: group.members.length,
      }
    },

    admins: async (chat) => {
      const group = await translated(engine.group(await groupId(chat)))
      return group.members.filter((member) => member.role !== "member").map((member) => member.jid)
    },

    people: async (references) => {
      const chats = await translated(engine.directory())
      return references.map((reference) => {
        const typed = reference.trim()
        if (typed.includes("@")) {
          if (!isPerson(typed)) throw new CliError("validation_error", "that is a chat, not a person")
          return typed
        }
        const wanted = typed.toLowerCase()
        const people = chats.filter((chat) => chat.kind === "dm" && isPerson(chat.jid) && chat.name !== null)
        const exact = people.filter((chat) => chat.name?.toLowerCase() === wanted)
        const found = exact.length > 0 ? exact : people.filter((chat) => chat.name?.toLowerCase().includes(wanted))
        if (found.length === 1 && found[0]) return found[0].jid
        if (found.length > 1)
          throw new CliError(
            "validation_error",
            `${found.length} people match that name — name one by their id (…@lid)`,
          )
        throw new CliError("not_found", "nobody by that name in your WhatsApp contacts; name them by their id (…@lid)")
      })
    },

    createGroup: async (title, people, { channel }) => {
      if (channel) throw new CliError("validation_error", "wa makes groups only; WhatsApp channels are made in the app")
      await refuseStrangers(people)
      const { group, notAdded } = await translated(engine.createGroup(title, people))
      const card = toGroupCard(group)
      return notAdded.length === 0 ? card : { ...card, providerMetadata: { ...card.providerMetadata, notAdded } }
    },

    join: async (link) => {
      const joined = await translated(engine.join(link))
      return joined.group ? toGroupCard(joined.group) : { requested: true as const }
    },

    leave: async (chat) => {
      const chatId = await groupId(chat)
      await translated(engine.leave(chatId))
      return { chatId }
    },

    group: async (chat) => toGroupCard(await translated(engine.group(await groupId(chat), { withLink: true }))),

    updateGroup: async (chatId, { title, description, settings = {}, photo }) => {
      if (photo !== undefined && !(await isJpeg(photo.source)))
        throw new CliError("validation_error", `${photo.name} is not a JPEG — WhatsApp takes a group photo only as one`)
      const missing = Object.keys(settings).filter((key) => !(GROUP_SETTINGS as readonly string[]).includes(key))
      if (missing.length > 0)
        throw new CliError("validation_error", `WhatsApp has no group setting ${missing.join(", ")}`)
      const { onlyAdminsAdd, joinApproval, onlyAdminsSend, onlyAdminsEditInfo, disappearingSeconds } = settings
      if (typeof disappearingSeconds === "number" && !DISAPPEARING_SECONDS.includes(disappearingSeconds))
        throw new CliError("validation_error", "WhatsApp makes messages disappear after 24h, 7d or 90d; off keeps them")
      const change: WaGroupChange = {
        ...(title === undefined ? {} : { title }),
        ...(description === undefined ? {} : { description }),
        ...(typeof onlyAdminsAdd === "boolean" ? { addMode: onlyAdminsAdd ? "admin_add" : "all_member_add" } : {}),
        ...(typeof joinApproval === "boolean" ? { approval: joinApproval } : {}),
        ...(typeof onlyAdminsSend === "boolean" ? { announce: onlyAdminsSend } : {}),
        ...(typeof onlyAdminsEditInfo === "boolean" ? { locked: onlyAdminsEditInfo } : {}),
        ...(typeof disappearingSeconds === "number" ? { ephemeral: disappearingSeconds } : {}),
      }
      // The engine checks the name too, but only after the photo is set: a refusal then would hide that it changed.
      if (title !== undefined && [...title].length > GROUP_NAME_LIMIT)
        throw new CliError("validation_error", "WhatsApp takes a group name of 1 to 25 characters")
      const jid = await groupId(chatId)
      // The photo goes first: the engine refuses one WhatsApp would not take, and then nothing else has changed.
      const pictured =
        photo === undefined
          ? undefined
          : await translated(onDisk(photo.source, (path) => engine.setGroupPhoto(jid, path)))
      if (pictured === undefined) return toGroupCard(await translated(engine.updateGroup(jid, change)))
      if (Object.keys(change).length === 0) return toGroupCard(pictured)
      try {
        return toGroupCard(await translated(engine.updateGroup(jid, change)))
      } catch (error) {
        if (!isCliError(error)) throw error
        throw new CliError(
          error.code,
          `the photo was set, the rest of the change was not: ${error.message}`,
          error.details,
        )
      }
    },

    resetInviteLink: async (chatId) => toGroupCard(await translated(engine.resetInviteLink(await groupId(chatId)))),

    addMembers: async (chatId, people, { history }) => {
      if (history)
        throw new CliError("validation_error", "WhatsApp does not show people added the messages from before")
      await refuseStrangers(people)
      return translated(engine.participants(await groupId(chatId), "add", people))
    },

    removeMembers: async (chatId, people) => {
      await translated(engine.participants(await groupId(chatId), "remove", people))
    },

    addAdmin: async (chatId, person) => {
      await translated(engine.participants(await groupId(chatId), "promote", [person]))
    },

    removeAdmin: async (chatId, person) => {
      await translated(engine.participants(await groupId(chatId), "demote", [person]))
    },

    joinRequests: async (chatId, { limit, search, link }) => {
      if (link !== undefined)
        throw new CliError("validation_error", "a WhatsApp group has one invite link; leave out --link")
      const wanted = search?.toLowerCase()
      const found = (await translated(engine.joinRequests(await groupId(chatId))))
        .filter((one) => wanted === undefined || (one.name?.toLowerCase().includes(wanted) ?? false))
        .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""))
      return {
        items: found.slice(0, limit).map((one) => ({
          person: { id: one.jid, name: one.name, username: null },
          requestedAt: one.requestedAt,
        })),
        hasMore: found.length > limit,
        total: found.length,
      }
    },

    answerJoinRequest: async (chatId, person, accept) => {
      await translated(engine.answerJoinRequest(await groupId(chatId), person, accept))
      return { already: false }
    },

    profile: async (reference): Promise<ProfileFacts> => {
      const found = await translated(engine.profile(await personId(reference)))
      return {
        id: found.jid,
        name: found.name,
        usernames: [],
        bio: found.about,
        flags: found.verified ? { verified: true } : {},
        contact: found.contact,
        ...(found.photo === null ? {} : { hasPhoto: found.photo }),
        chats: [],
      }
    },

    block: async (person) => {
      await translated(engine.block(person, true))
    },

    unblock: async (person) => {
      await translated(engine.block(person, false))
    },

    lookup: async (phone) => toMember(await translated(engine.lookup(phone))),

    addressBook: async () => (await translated(engine.contacts())).map(toMember),

    // Connecting is the check: WhatsApp refuses a banned account's connection, and the engine answers with the ban,
    // whose `standing` holds the profile's writes. A connection lifts that hold (`doctor --online`, WC-PERM-18).
    health: async () => {
      await translated(engine.ready(new AbortController().signal))
      return { standingChecked: true }
    },
  }
}
