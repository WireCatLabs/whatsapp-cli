import { CliError } from "@wirecat/cli-base"
import type { Chat, GroupCard, Message, Page } from "@wirecat/cli-core"
import type { StoredMessages } from "@wirecat/cli-core/cli"
import { CHANNEL_PAGE_MAX, type WaChannel } from "../engine/channels.js"
import type { WhatsAppEngine } from "../engine/contract.js"
import type { GroupAdapter } from "./groups.js"
import { toChat, toMessage } from "./map.js"

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
