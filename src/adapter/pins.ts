import { CliError } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import type { MessagePins } from "@wirecat/cli-core/cli"
import type { WaKey, WhatsAppEngine } from "../engine/contract.js"

/**
 * Pins as WhatsApp has them: every pin is for the whole chat, and its members see it, so a quiet pin is refused
 * rather than made loudly. The message is addressed by its key in the store, like an edit or a reaction.
 */
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
  pin: async (chatId, messageId, { notify }) => {
    if (!notify)
      throw new CliError(
        "validation_error",
        "WhatsApp tells the chat's members about every pin and has no quiet one; pin with --notify",
      )
    await translated(engine.pin(keyOf(chatId, await held(chatId, messageId))))
  },

  unpin: async (chatId, messageId) => {
    await translated(engine.unpin(keyOf(chatId, await held(chatId, messageId))))
  },
})
