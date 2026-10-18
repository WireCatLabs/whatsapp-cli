import { CliError } from "@wirecat/cli-base"
import type { MessengerAdapter, ProfileChange } from "@wirecat/cli-core/cli"
import { EngineError, type WhatsAppEngine } from "../engine/contract.js"
import type { WaProfileChange } from "../engine/settings.js"
import type { Words } from "./checks.js"
import { toAccount } from "./map.js"

/** The account's own settings, which WhatsApp syncs to its other devices, and the profile everyone sees. */
export type SettingsAdapter = Required<Pick<MessengerAdapter, "mute" | "updateProfile">>

export interface SettingsDeps {
  engine: WhatsAppEngine
  translated: <T>(work: Promise<T>) => Promise<T>
  words: Words
}

export const settingsAdapter = ({ engine, translated, words }: SettingsDeps): SettingsAdapter => {
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

  return {
    mute: async (chatId, until) => {
      await keyed(engine.mute(chatId, until))
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
