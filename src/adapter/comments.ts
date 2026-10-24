import { CliError } from "@wirecat/cli-base"
import type { MessengerAdapter, StoredMessages } from "@wirecat/cli-core/cli"
import type { WhatsAppEngine } from "../engine/contract.js"

export type CommentAdapter = Required<Pick<MessengerAdapter, "discussionOf" | "comments">>

export const commentAdapter = (
  engine: WhatsAppEngine,
  stored: StoredMessages,
  translated: <T>(work: Promise<T>) => Promise<T>,
): CommentAdapter => ({
  discussionOf: async (chat, post) => {
    await translated(engine.commentGroup(chat))
    return { chatId: chat, messageId: post }
  },
  comments: async (chat, post, window) => {
    await translated(engine.commentGroup(chat))
    if (!stored.threadMessages)
      throw new CliError("provider_unavailable", "this cli-core cannot read stored comment threads; update wa")
    return stored.threadMessages(chat, post, window)
  },
})
