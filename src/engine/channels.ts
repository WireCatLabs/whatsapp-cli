import * as v from "valibot"
import { waChat, waMessage } from "./contract.js"
import type { EngineRequest } from "./groups.js"

/**
 * A WhatsApp channel (whatsmeow's newsletter). `chat.participants` is its follower count. `role` is the account's own
 * in it, `""` when WhatsApp did not say; only `owner` and `admin` may post.
 */
export const waChannel = v.strictObject({
  chat: waChat,
  description: v.nullable(v.string()),
  link: v.nullable(v.string()),
  role: v.picklist(["owner", "admin", "subscriber", "guest", ""]),
})

/**
 * A channel's posts read from WhatsApp's servers, oldest first or in any order. Each carries `serverId`, which the
 * next read counts back from. No posts and `more: false` is the channel's start.
 */
export const waChannelPage = v.strictObject({ messages: v.array(waMessage), more: v.boolean() })

export type WaChannel = v.InferOutput<typeof waChannel>
export type WaChannelPage = v.InferOutput<typeof waChannelPage>

/** The most posts one read asks for; unverified against WhatsApp, whatsmeow sets no limit. */
export const CHANNEL_PAGE_MAX = 50

/** The engine's channel requests. Following and unfollowing are seen by the channel's admins. */
export interface ChannelEngine {
  channel(jid: string): Promise<WaChannel>
  /** Posts sent before the one numbered `before` on WhatsApp's servers; without it, the newest. */
  channelMessages(jid: string, count: number, before?: number): Promise<WaChannelPage>
  /** By its link, `https://whatsapp.com/channel/<code>`. */
  followChannel(link: string): Promise<WaChannel>
  unfollowChannel(jid: string): Promise<void>
}

const nothing = v.nullable(v.unknown())

export const goChannels = (request: EngineRequest): ChannelEngine => ({
  channel: (jid) => request("channel", { jid }, waChannel),
  channelMessages: (jid, count, before) =>
    request("channelMessages", { jid, count, ...(before === undefined ? {} : { before }) }, waChannelPage),
  followChannel: (link) => request("followChannel", { link }, waChannel),
  unfollowChannel: async (jid) => {
    await request("unfollowChannel", { jid }, nothing)
  },
})
