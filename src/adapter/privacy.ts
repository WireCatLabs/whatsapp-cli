import { CliError } from "@wirecat/cli-base"
import type { Audience, PrivacyKey, PrivacySettings, ShownAudience } from "@wirecat/cli-core"
import type { MessengerAdapter } from "@wirecat/cli-core/cli"
import type { WhatsAppEngine } from "../engine/contract.js"
import type { WaPrivacy, WaPrivacyChange } from "../engine/privacy.js"

export type PrivacyAdapter = Required<Pick<MessengerAdapter, "privacy" | "updatePrivacy">>

/** WhatsApp's settings, in the order its phone app lists them; `findByPhone` and `phoneNumber` it has not. */
export const PRIVACY_SETTINGS: readonly PrivacyKey[] = [
  "lastSeen",
  "hideOnline",
  "profilePhoto",
  "about",
  "readReceipts",
  "chatInvites",
  "calls",
]

type Values<A extends string> = Partial<Record<A, string>>

const SHOWN: Values<ShownAudience> = {
  everyone: "all",
  contacts: "contacts",
  contacts_except: "contact_blacklist",
  nobody: "none",
}
// whatsmeow lists groupadd none, but Baileys dropped it as refused by WhatsApp (WhiskeySockets/Baileys#966).
const GROUP_ADD: Values<Audience> = { everyone: "all", contacts: "contacts" }
// Baileys' "mute unknown calls" (WhiskeySockets/Baileys#872), the phone's "silence unknown callers"; not checked live.
const CALL_ADD: Values<Audience> = { everyone: "all", contacts: "known" }

const AUDIENCES = [
  ["lastSeen", "last"],
  ["profilePhoto", "profile"],
  ["about", "status"],
] as const

const audienceOf = <A extends string>(values: Values<A>, value: string): A | undefined => {
  for (const audience in values) if (values[audience] === value) return audience
  return undefined
}

const hidden = (privacy: WaPrivacy) => privacy.last === "none" && privacy.online === "match_last_seen"

/**
 * What WhatsApp has of cli-core's settings. Who may add the account has no "contacts except" in cli-core, so such a
 * value is left out there, never rounded to the nearest; calls have none in WhatsApp. Hidden online means last seen
 * to nobody and online only to those who see last seen.
 */
export const toPrivacy = (privacy: WaPrivacy): PrivacySettings => {
  const settings: PrivacySettings = {
    calls: audienceOf(CALL_ADD, privacy.calladd),
    chatInvites: audienceOf(GROUP_ADD, privacy.groupadd),
    hideOnline: privacy.last === "" || privacy.online === "" ? undefined : hidden(privacy),
    readReceipts: privacy.readreceipts === "" ? undefined : privacy.readreceipts === "all",
  }
  for (const [key, name] of AUDIENCES) settings[key] = audienceOf(SHOWN, privacy[name])
  return Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== undefined))
}

const refusedUpFront = (change: PrivacySettings): string | undefined => {
  const missing = Object.keys(change).find((key) => !PRIVACY_SETTINGS.some((known) => known === key))
  if (missing) return `WhatsApp has no ${missing} privacy setting`
  if (change.chatInvites === "nobody")
    return "WhatsApp lets everyone or only contacts add the account to groups, not nobody"
  if (change.calls === "nobody")
    return "WhatsApp lets everyone call, or silences callers the account does not know (contacts), not nobody"
  if (change.hideOnline !== undefined && change.lastSeen !== undefined)
    return "--hide-online sets who sees last seen too; give --hide-online or --last-seen, not both"
  for (const [key] of AUDIENCES)
    if (change[key] === "contacts_except")
      return "contacts_except is kept on the phone with its list of exceptions; wa only shows it"
  return undefined
}

const valueFor = <A extends string>(values: Values<A>, audience: A): string => {
  const value = values[audience]
  if (value === undefined) throw new CliError("validation_error", `WhatsApp does not support the ${audience} audience`)
  return value
}

/**
 * The settings to send, only those that differ from now. Showing online again sets last seen to contacts: the
 * audience before it was hidden is not kept anywhere, and contacts shows the least of what "not hidden" can mean.
 */
const changesFor = (change: PrivacySettings, now: WaPrivacy): WaPrivacyChange[] => {
  const wanted: WaPrivacyChange[] = []
  for (const [key, name] of AUDIENCES) {
    const audience = change[key]
    if (audience !== undefined) wanted.push({ name, value: valueFor(SHOWN, audience) })
  }
  if (change.readReceipts !== undefined)
    wanted.push({ name: "readreceipts", value: change.readReceipts ? "all" : "none" })
  if (change.chatInvites !== undefined)
    wanted.push({ name: "groupadd", value: valueFor(GROUP_ADD, change.chatInvites) })
  if (change.calls !== undefined) wanted.push({ name: "calladd", value: valueFor(CALL_ADD, change.calls) })
  if (change.hideOnline === true)
    wanted.push({ name: "last", value: "none" }, { name: "online", value: "match_last_seen" })
  if (change.hideOnline === false && hidden(now)) wanted.push({ name: "last", value: "contacts" })
  return wanted.filter(({ name, value }) => now[name] !== value)
}

export const privacyAdapter = ({
  engine,
  translated,
}: {
  engine: WhatsAppEngine
  translated: <T>(work: Promise<T>) => Promise<T>
}): PrivacyAdapter => ({
  privacy: async () => toPrivacy(await translated(engine.privacy())),

  updatePrivacy: async (change) => {
    const refused = refusedUpFront(change)
    if (refused) throw new CliError("validation_error", refused)
    const now = await translated(engine.privacy())
    const changes = changesFor(change, now)
    return toPrivacy(changes.length === 0 ? now : await translated(engine.setPrivacy(changes)))
  },
})
