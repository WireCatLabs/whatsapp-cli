import { CliError } from "@wirecat/cli-base"
import type { AccountStanding } from "@wirecat/cli-core/cli"
import type { EngineError } from "../engine/contract.js"

/**
 * WhatsApp's 429 says neither how long nor whether reads count, so writes wait this long and reads go on
 * (WC-PERM-18). The owner's to change: docs/dev/BACKLOG.md.
 */
export const RATE_LIMIT_HOLD_MS = 15 * 60_000

const at = (ms: number) => new Date(ms).toISOString()

/**
 * An engine refusal in cli-core's terms, its reason kept. A rate limit and a ban carry `standing`, which cli-core turns
 * into a hold on the profile's writes.
 */
export const fromEngine = (
  error: EngineError,
  now = Date.now(),
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): CliError => {
  const reason = error.reason === undefined ? {} : { reason: error.reason }
  if (error.reason === "account.rate-limited")
    return new CliError(error.code, `${error.message}; this profile holds its writes for 15 minutes`, {
      ...reason,
      retry_after_ms: RATE_LIMIT_HOLD_MS,
      standing: {
        state: "limited",
        hint: "WhatsApp asked this account to slow down",
        until: at(now + RATE_LIMIT_HOLD_MS),
      } satisfies AccountStanding,
    })
  if (error.reason === "account.banned") {
    const ends = error.until === undefined ? Number.NaN : Date.parse(error.until)
    const dated = ends > now
    return new CliError(
      error.code,
      dated
        ? `${error.message}; the ban ends ${new Date(ends).toLocaleString("sv-SE", { timeZone: zone, hour12: false })} (${zone})`
        : error.message,
      {
        ...reason,
        standing: {
          state: "banned",
          hint: "WhatsApp banned or restricted this account",
          ...(dated ? { until: at(ends) } : {}),
        } satisfies AccountStanding,
      },
    )
  }
  if (error.reason === "account.reachout-restricted") {
    const ends = error.until === undefined ? Number.NaN : Date.parse(error.until)
    if (ends > now)
      return new CliError(
        error.code,
        `${error.message} until ${new Date(ends).toLocaleString("sv-SE", { timeZone: zone, hour12: false })} (${zone})`,
        { ...reason, until: at(ends) },
      )
  }
  return new CliError(error.code, error.message, reason)
}
