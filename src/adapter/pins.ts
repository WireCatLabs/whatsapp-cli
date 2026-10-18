import type { Message } from "@wirecat/cli-core"
import type { MessagePins } from "@wirecat/cli-core/cli"
import type { WaKey, WhatsAppEngine } from "../engine/contract.js"

/** The message is addressed by its key in the store, like an edit or a reaction. */
export const pinAdapter = ({
  engine,
  held,
  keyOf,
  translated,
}: {
  engine: WhatsAppEngine
  held: (chatId: string, messageId: string) => Promise<Message>
  keyOf: (chatId: string, message: Message) => WaKey
  translated: <T>(work: Promise<T>) => Promise<T>
}): MessagePins => ({
  pin: async (chatId, messageId, { duration }) => {
    await translated(engine.pin(keyOf(chatId, await held(chatId, messageId)), duration))
  },

  unpin: async (chatId, messageId) => {
    await translated(engine.unpin(keyOf(chatId, await held(chatId, messageId))))
  },
})
