import { CliError } from "@wirecat/cli-base"
import type { Message } from "@wirecat/cli-core"
import type { MessengerAdapter, ProfileChange, StoredMessages } from "@wirecat/cli-core/cli"
import { EngineError, type WaAnchor, type WaKey, type WhatsAppEngine } from "../engine/contract.js"
import type { WaProfileChange } from "../engine/settings.js"
import type { Words } from "./checks.js"
import { toAccount } from "./map.js"

/** The account's own settings, which WhatsApp syncs to its other devices, and the profile everyone sees. */
export type SettingsAdapter = Required<Pick<MessengerAdapter, "mute" | "updateProfile" | "deleteChat" | "clearHistory">>

export interface SettingsDeps {
  engine: WhatsAppEngine
  translated: <T>(work: Promise<T>) => Promise<T>
  words: Words
  stored: StoredMessages
  keyOf: (chatId: string, message: Message) => WaKey
}

// `anchor` gives the newest message sent at a time or before; this one is later than any message's.
const AFTER_EVERY_MESSAGE = "9999-12-31T23:59:59.999Z"

export const settingsAdapter = ({ engine, translated, words, stored, keyOf }: SettingsDeps): SettingsAdapter => {
  // The engine cannot name the profile, so the command that brings the keys is named here. whatsmeow refuses before
  // anything leaves, so a retry is safe (WC-OUT-20).
  const keyed = <T>(work: Promise<T>): Promise<T> =>
    translated(
      work.catch((error: unknown) => {
        if (!(error instanceof EngineError) || error.reason !== "settings.keys-missing") throw error
        throw new CliError(
          error.code,
          `WhatsApp has not sent the settings keys yet; keep ${words("serve")} running a few minutes and try again`,
          { reason: error.reason, sent: false },
        )
      }),
    )

  // WhatsApp deletes up to a message the patch names, either side's; a guessed one makes the phone drop the patch
  // without a word, so a chat the store holds nothing of is refused.
  const newest = async (chatId: string): Promise<WaAnchor> => {
    const last = await stored.anchor(chatId, AFTER_EVERY_MESSAGE)
    if (!last)
      throw new CliError(
        "not_found",
        "nothing of this chat is in the local store, and WhatsApp needs its newest message to know what to delete; " +
          `${words("serve")} keeps the store filled`,
      )
    return { ...keyOf(chatId, last), timestamp: last.timestamp }
  }

  return {
    mute: async (chatId, until) => {
      await keyed(engine.mute(chatId, until))
    },
    deleteChat: async (chatId) => {
      await keyed(engine.deleteChat(await newest(chatId)))
    },
    clearHistory: async (chatId) => {
      await keyed(engine.clearChat(await newest(chatId)))
    },
    updateProfile: async (change) => toAccount(await keyed(engine.updateProfile(toWaProfile(change)))),
  }
}

/** WhatsApp keeps one name, so a first and a last name are joined into it; a last name alone has nothing to join. */
const toWaProfile = ({ firstName, lastName, description, photo }: ProfileChange): WaProfileChange => {
  if (photo !== undefined)
    throw new CliError("validation_error", "wa does not set the profile photo yet; set it on the phone")
  if (firstName === undefined && lastName !== undefined)
    throw new CliError(
      "validation_error",
      "WhatsApp has one name — pass --first-name, and --last-name is added to it after a space",
    )
  if (description !== undefined && description.trim() === "")
    throw new CliError("validation_error", "a WhatsApp about cannot be empty")
  const pushName =
    firstName === undefined
      ? undefined
      : [firstName, lastName]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(" ")
  if (pushName === "") throw new CliError("validation_error", "a WhatsApp name cannot be empty")
  return {
    ...(pushName === undefined ? {} : { pushName }),
    ...(description === undefined ? {} : { about: description }),
  }
}
