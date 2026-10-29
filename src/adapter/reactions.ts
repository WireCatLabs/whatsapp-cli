import { CliError } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import type { MessageReactions, StoredMessages } from "@wirecat/cli-core/cli"
import { isChannel } from "./channels.js"

/**
 * WhatsApp has no request for who reacted: the list is what the store received, from the history push and from `serve`
 * and `watch`. A reaction sent with `reactions add` is not in it. The cursor is how many reactors the last page held.
 */
export type ReactionAdapter = Required<Pick<MessageReactions, "reactors">>

export const reactionAdapter = ({
  stored,
  held,
}: {
  stored: StoredMessages
  held: (chatId: string, messageId: string) => Promise<Message>
}): ReactionAdapter => ({
  reactors: async (chatId, messageId, { limit, emoji, cursor }) => {
    if (isChannel(chatId))
      throw new CliError("permission_error", "a channel does not show who reacted to its posts", {
        reason: "reactions.broadcast",
      })
    await held(chatId, messageId)
    const skip = cursor === undefined ? 0 : Number(cursor)
    if (!Number.isInteger(skip) || skip < 0)
      throw new CliError("validation_error", "that cursor is not one this list gave")
    const all = (await stored.reactors(chatId, messageId)).filter(
      (reactor) => emoji === undefined || reactor.reaction === emoji,
    )
    const items = all.slice(skip, skip + limit)
    const end = skip + items.length
    return { items, hasMore: end < all.length, ...(end < all.length ? { cursor: String(end) } : {}) }
  },
})
