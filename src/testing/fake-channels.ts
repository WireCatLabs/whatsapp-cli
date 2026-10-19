import * as v from "valibot"
import { type ChannelEngine, type WaChannel, waChannel } from "../engine/channels.js"
import { EngineError, type WaChat, type WaMessage } from "../engine/contract.js"

export const CHANNEL = "120363000000000001@newsletter"
export const CHANNEL_INVITE = "https://whatsapp.com/channel/FAKE0000000000000000AA"

const CHANNEL_CHAT: WaChat = {
  jid: CHANNEL,
  name: "Synthetic news",
  kind: "newsletter",
  participants: 42,
}

/** What WhatsApp's servers hold of the channel: one post an hour, numbered from 1, the newest last. */
export const CHANNEL_POSTS: WaMessage[] = Array.from({ length: 60 }, (_, n) => ({
  id: `3EB00000000000000C${String(n + 1).padStart(4, "0")}`,
  chat: CHANNEL,
  sender: CHANNEL,
  senderName: CHANNEL_CHAT.name ?? null,
  fromMe: false,
  timestamp: new Date(Date.parse("2026-09-01T00:00:00.000Z") + n * 3_600_000).toISOString(),
  editedAt: null,
  text: "synthetic post",
  replyTo: null,
  serverId: n + 1,
}))

export interface ChannelAction {
  op: "followChannel" | "unfollowChannel"
  jid?: string
}

export interface FakeChannels extends ChannelEngine {
  channelActions: ChannelAction[]
  /** Each read of a channel's posts, by the count and server id it was asked with. */
  channelReads: { count: number; before?: number }[]
  /** The channels the account follows, as the directory names them. */
  followed: () => WaChat[]
}

/** One channel on WhatsApp's servers; the account follows it when `role` is given. Answers are checked against the contract. */
export const fakeChannels = (role?: WaChannel["role"]): FakeChannels => {
  const channelActions: ChannelAction[] = []
  const channelReads: FakeChannels["channelReads"] = []
  let following = role !== undefined
  let viewer: WaChannel["role"] = role ?? "guest"

  const card = (): WaChannel =>
    v.parse(waChannel, { chat: CHANNEL_CHAT, description: "synthetic description", link: CHANNEL_INVITE, role: viewer })

  const known = (jid: string) => {
    if (jid !== CHANNEL) throw new EngineError("not_found", "WhatsApp has no such channel")
  }

  return {
    channelActions,
    channelReads,
    followed: () => (following ? [CHANNEL_CHAT] : []),
    channel: async (jid) => {
      known(jid)
      return card()
    },
    channelMessages: async (jid, count, before) => {
      known(jid)
      channelReads.push({ count, ...(before === undefined ? {} : { before }) })
      const older = CHANNEL_POSTS.filter((post) => before === undefined || (post.serverId ?? 0) < before)
      const messages = older.slice(-count)
      return { messages, more: messages.length > 0 }
    },
    followChannel: async (link) => {
      if (link.trim() !== CHANNEL_INVITE) throw new EngineError("not_found", "WhatsApp has no channel by that link")
      channelActions.push({ op: "followChannel" })
      following = true
      if (viewer === "guest") viewer = "subscriber"
      return card()
    },
    unfollowChannel: async (jid) => {
      known(jid)
      channelActions.push({ op: "unfollowChannel", jid })
      following = false
    },
  }
}
