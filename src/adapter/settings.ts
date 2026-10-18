import { CliError } from "@wirecat/cli-base"
import type { MessengerAdapter } from "@wirecat/cli-core/cli"
import { EngineError, type WhatsAppEngine } from "../engine/contract.js"
import type { Words } from "./checks.js"

/** The account's own settings, which WhatsApp syncs to its other devices; nobody else is told. */
export type SettingsAdapter = Required<Pick<MessengerAdapter, "mute">>

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
  }
}
