import { CliError } from "@wirecat/cli-base"
import type { Audience, PrivacySettings } from "@wirecat/cli-core"
import type { MessengerAdapter } from "@wirecat/cli-core/cli"
import type { WhatsAppEngine } from "../engine/contract.js"
import type { WaPrivacy, WaPrivacyChange } from "../engine/privacy.js"

export type PrivacyAdapter = Required<Pick<MessengerAdapter, "privacy" | "updatePrivacy">>

const GROUP_ADD: Record<Audience, string> = { everyone: "all", contacts: "contacts", nobody: "none" }
// WhatsApp's "silence unknown callers": an unknown caller's call still arrives, without ringing.
const CALL_ADD: Partial<Record<Audience, string>> = { everyone: "all", contacts: "known" }

const audienceOf = (values: Partial<Record<Audience, string>>, value: string): Audience | undefined =>
  (Object.keys(values) as Audience[]).find((audience) => values[audience] === value)

/**
 * What WhatsApp has of cli-core's settings. A value cli-core cannot name ("my contacts except…") is left out, never
 * rounded to the nearest. Hidden online means last seen to nobody and online only to those who see last seen.
 */
export const toPrivacy = (privacy: WaPrivacy): PrivacySettings => {
  const chatInvites = audienceOf(GROUP_ADD, privacy.groupadd)
  const calls = audienceOf(CALL_ADD, privacy.calladd)
  return {
    ...(calls === undefined ? {} : { calls }),
    ...(chatInvites === undefined ? {} : { chatInvites }),
    ...(privacy.last === "" || privacy.online === ""
      ? {}
      : { hideOnline: privacy.last === "none" && privacy.online === "match_last_seen" }),
  }
}

const refusedUpFront = (change: PrivacySettings): string | undefined => {
  if (change.findByPhone !== undefined) return "WhatsApp has no setting for who finds the account by its number"
  if (change.phoneNumber !== undefined) return "WhatsApp has no setting for who sees the account's number"
  if (change.calls === "nobody")
    return "WhatsApp lets everyone call, or silences callers the account does not know (contacts), not nobody"
  return undefined
}

/**
 * The settings to send, only those that differ from now. Showing online again sets last seen to contacts: the
 * audience before it was hidden is not kept anywhere, and contacts shows the least of what "not hidden" can mean.
 */
const changesFor = (change: PrivacySettings, now: WaPrivacy): WaPrivacyChange[] => {
  const wanted: WaPrivacyChange[] = []
  if (change.chatInvites !== undefined) wanted.push({ name: "groupadd", value: GROUP_ADD[change.chatInvites] })
  if (change.calls !== undefined) wanted.push({ name: "calladd", value: CALL_ADD[change.calls] as string })
  if (change.hideOnline === true)
    wanted.push({ name: "last", value: "none" }, { name: "online", value: "match_last_seen" })
  if (change.hideOnline === false && now.last === "none") wanted.push({ name: "last", value: "contacts" })
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
