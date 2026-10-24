import { CliError } from "@wirecat/cli-base"
import type { Message, Page } from "@wirecat/cli-core"
import type { MessengerAdapter, StoredMessages } from "@wirecat/cli-core/cli"
import type { WhatsAppEngine } from "../engine/contract.js"

export type CommentStore = StoredMessages & {
  threadMessages?(chat: string, thread: string, window: { limit: number; before?: string }): Promise<Page<Message>>
}

export type CommentAdapter = Required<Pick<MessengerAdapter, "discussionOf" | "comments">>

export const commentAdapter = (
  engine: WhatsAppEngine,
  stored: CommentStore,
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
