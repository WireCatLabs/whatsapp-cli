/**
 * Meta's file carries sample phone numbers in its examples; some may be real people's, and the secret scan reads
 * every branch. The snapshot replaces each one with a fictional `1555-01NN`, the same number for the same original
 * and in the order first seen, so a re-sync of an unchanged file gives the same bytes.
 */

/** Keys whose value is a phone number in Meta's examples. */
const PHONE_KEYS = [
  "wa_id",
  "from",
  "to",
  "recipient_id",
  "display_phone_number",
  "phone_number",
  "mobile_number",
  "landline_number",
  "phone",
  "input",
  "user",
  "number",
]

const KEYED = new RegExp(
  `(?:^|[\\s{,"'])(?:${PHONE_KEYS.join("|")})["']?\\s*[:=]\\s*["']?(\\+?\\d[\\d ().-]{8,}\\d)`,
  "gm",
)
/** Any number written the international way, wherever it stands: `+1 (631) 555-1000`, `+913854559033`. */
const INTERNATIONAL = /(?<![\w+])\+\d[\d ().-]{7,}\d(?!\d)/g

const literally = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export interface Scrubbed {
  text: string
  /** How many distinct numbers were replaced. */
  replaced: number
}

export const scrubPhoneNumbers = (text: string): Scrubbed => {
  const found: string[] = []
  // Ten digits at least: a date (2026-10-01) or a short code under the same keys is not a phone number.
  const note = (value: string | undefined) => {
    if (value && value.replace(/\D/g, "").length >= 10 && !found.includes(value)) found.push(value)
  }
  for (const match of text.matchAll(KEYED)) note(match[1])
  for (const match of text.matchAll(INTERNATIONAL)) note(match[0])
  if (found.length > 99) throw new Error(`${found.length} phone numbers: more than 1555-01NN can number`)
  // Longest first, so a number that contains another is replaced whole.
  const order = [...found].sort((a, b) => b.length - a.length)
  let scrubbed = text
  for (const original of order) {
    const index = String(found.indexOf(original) + 1).padStart(2, "0")
    const fictional = `${original.startsWith("+") ? "+" : ""}1555-01${index}`
    scrubbed = scrubbed.replace(new RegExp(`(?<![\\d+/])${literally(original)}(?![\\d/])`, "g"), fictional)
  }
  return { text: scrubbed, replaced: found.length }
}
