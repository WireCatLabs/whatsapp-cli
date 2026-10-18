import * as v from "valibot"
import type { EngineRequest } from "./groups.js"

/**
 * The account's privacy in WhatsApp's own names and values (whatsmeow's `types.PrivacySettings`): `groupadd` who may
 * add the account to groups, `last` who sees last seen, `online` who sees it online (`match_last_seen`: those who see
 * last seen), `calladd` whose calls ring (`known`: unknown callers are silenced). `""` is a setting WhatsApp did not
 * send.
 */
export const waPrivacy = v.strictObject({
  groupadd: v.string(),
  last: v.string(),
  online: v.string(),
  calladd: v.string(),
})

export type WaPrivacy = v.InferOutput<typeof waPrivacy>

export interface WaPrivacyChange {
  name: keyof WaPrivacy
  value: string
}

/** The engine's privacy requests. A change is seen by everyone the setting is about. */
export interface PrivacyEngine {
  /** Asked of WhatsApp each time, never from a cache another device may have outdated. */
  privacy(): Promise<WaPrivacy>
  /** In order, one request each; answers every setting as it now is. Nothing is sent unless every change is valid. */
  setPrivacy(changes: WaPrivacyChange[]): Promise<WaPrivacy>
}

export const goPrivacy = (request: EngineRequest): PrivacyEngine => ({
  privacy: () => request("privacy", {}, waPrivacy),
  setPrivacy: (changes) => request("setPrivacy", { privacy: changes }, waPrivacy),
})
