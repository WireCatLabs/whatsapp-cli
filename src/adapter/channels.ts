import { CliError } from "@wirecat/cli-base"
import type { Chat, GroupCard, Message, Page } from "@wirecat/cli-core"
import type { MessageEditing, StoredMessages } from "@wirecat/cli-core/cli"
import { CHANNEL_PAGE_MAX, type WaChannel } from "../engine/channels.js"
import type { WhatsAppEngine } from "../engine/contract.js"
import type { GroupAdapter } from "./groups.js"
import { toChat, toMessage } from "./map.js"
import type { PollAdapter } from "./polls.js"

/** WhatsApp channels are whatsmeow's newsletters, and their ids end so. */
export const isChannel = (id: string) => id.endsWith("@newsletter")

export const CHANNEL_LINK = /^\s*(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]+/i

/** A channel as `chats join` answers it: only its admins post, and WhatsApp has none of a group's other switches. */
export const toChannelCard = (channel: WaChannel): GroupCard => ({
  ...toChat(channel.chat),
  description: channel.description,
  link: channel.link,
  settings: {
    allCanPin: null,
    onlyAdminsAdd: null,
    onlyAdminsCall: null,
    onlyOwnerEditsInfo: null,
    membersSeeLink: null,
    joinApproval: null,
    onlyAdminsSend: true,
    onlyAdminsEditInfo: null,
    disappearingSeconds: null,
  },
})

const serverIdOf = (message: Message | undefined): number | undefined => {
  const id = message?.providerMetadata?.serverId
  return typeof id === "number" ? id : undefined
}

/**
 * A channel's posts live on WhatsApp's servers, so `messages sync` reads them there: the newest first, then back
 * from the server id of the stored post the last page reached. Nothing stored is needed to start.
 */
export const channelHistory = async (
  engine: WhatsAppEngine,
  stored: StoredMessages,
  chatId: string,
  { limit, before }: { limit: number; before?: string },
): Promise<Page<Message>> => {
  let from: number | undefined
  if (before !== undefined) {
    const anchor = await stored.anchor(chatId, before)
    from = serverIdOf(anchor)
    if (from === undefined)
      throw new CliError(
        "not_found",
        "no stored post of this channel has a server id to count back from, so WhatsApp cannot be asked for older ones",
      )
  }
  const page = await engine.channelMessages(chatId, Math.min(limit, CHANNEL_PAGE_MAX), from)
  const items = page.messages.map(toMessage).sort((one, other) => one.timestamp.localeCompare(other.timestamp))
  return { items, hasMore: page.more }
}

/**
 * Only a channel's owner and admins post, and WhatsApp says the account's role only when asked, so a post asks first.
 * The role is asked before anything is uploaded. One file per post: whatsmeow's newsletter send has no album handling.
 */
export const refuseChannelPost = async (
  engine: WhatsAppEngine,
  translated: <T>(work: Promise<T>) => Promise<T>,
  chatId: string,
  { files, reply }: { files: number; reply: boolean },
): Promise<void> => {
  if (files > 1) throw new CliError("validation_error", "wa posts one file at a time to a WhatsApp channel")
  if (reply) throw new CliError("validation_error", "a WhatsApp channel post cannot be a reply")
  const { role } = await translated(engine.channel(chatId))
  if (role !== "owner" && role !== "admin")
    throw new CliError("permission_error", "only a channel's owner and admins may post in it")
}

export interface ChannelDeps {
  engine: WhatsAppEngine
  resolve: (reference: string) => Promise<Chat>
  translated: <T>(work: Promise<T>) => Promise<T>
  groups: Pick<GroupAdapter, "join" | "leave">
}

/** `chats join` and `chats leave` follow and unfollow a channel; a group's link or id goes on to the group's. */
export const channelAdapter = ({
  engine,
  resolve,
  translated,
  groups,
}: ChannelDeps): Pick<GroupAdapter, "join" | "leave"> => ({
  join: async (link) =>
    CHANNEL_LINK.test(link) ? toChannelCard(await translated(engine.followChannel(link))) : groups.join(link),

  leave: async (chat) => {
    const { id } = await resolve(chat)
    if (!isChannel(id)) return groups.leave(chat)
    await translated(engine.unfollowChannel(id))
    return { chatId: id }
  },
})

type ChannelWrites = Pick<MessageEditing, "edit" | "delete" | "forward"> & Pick<PollAdapter, "createPoll" | "vote">

const NOT_IN_CHANNELS = () =>
  new CliError("validation_error", "wa does not do that in a WhatsApp channel yet; it posts text and single files only")

/**
 * The writes wa has not built for a channel are refused before anything is sent: whatsmeow would send each of them
 * to a channel as a post, and WhatsApp addresses a post's edit, deletion and votes by its server id.
 */
export const channelWrites = ({ edit, delete: remove, forward, createPoll, vote }: ChannelWrites): ChannelWrites => ({
  edit: async (chatId, ...rest) => {
    if (isChannel(chatId)) throw NOT_IN_CHANNELS()
    return edit(chatId, ...rest)
  },
  delete: async (chatId, ...rest) => {
    if (isChannel(chatId)) throw NOT_IN_CHANNELS()
    return remove(chatId, ...rest)
  },
  forward: async (fromChatId, messageId, toChatId, options) => {
    if (isChannel(toChatId)) throw NOT_IN_CHANNELS()
    return forward(fromChatId, messageId, toChatId, options)
  },
  createPoll: async (chatId, ...rest) => {
    if (isChannel(chatId)) throw NOT_IN_CHANNELS()
    return createPoll(chatId, ...rest)
  },
  vote: async (chatId, ...rest) => {
    if (isChannel(chatId)) throw NOT_IN_CHANNELS()
    return vote(chatId, ...rest)
  },
})
