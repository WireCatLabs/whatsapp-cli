import { defineReasons, type ErrorReason } from "@wirecat/cli-base/standards"

/** Every reason wa raises beyond cli-core's, so an agent branches on it (WC-OUT-15). */
export const REASONS: ErrorReason[] = defineReasons(
  (
    [
      ["device.in-use", "provider_unavailable", "another wa process holds this WhatsApp login"],
      ["device.replaced", "provider_unavailable", "another connection took over this WhatsApp login"],
      ["device.logged-out", "authentication_error", "WhatsApp logged this device out"],
      ["client.outdated", "provider_unavailable", "WhatsApp no longer accepts this version of wa"],
      ["account.banned", "permission_error", "WhatsApp has banned or restricted this account"],
      ["account.rate-limited", "rate_limited", "WhatsApp asked this account to slow down"],
      ["settings.keys-missing", "provider_unavailable", "WhatsApp has not sent the keys a settings change needs yet"],
      ["engine.stopped", "provider_unavailable", "the WhatsApp engine stopped unexpectedly"],
      ["engine.stopped-mid-write", "outcome_unknown", "the WhatsApp engine stopped before WhatsApp confirmed a change"],
    ] satisfies [string, ErrorReason["code"], string][]
  ).map(([reason, code, message]) => ({ reason, code, message, details: [] })),
)
