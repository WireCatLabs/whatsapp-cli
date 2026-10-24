import { jsonlEndSchema, jsonlItemSchema } from "@wirecat/cli-base/standards"
import * as v from "valibot"

/** Decode a complete watch response from the captured stream's records. */
export const watchItems = (lines: readonly string[] | string): Record<string, unknown>[] => {
  const records: unknown[] = (typeof lines === "string" ? lines.split("\n") : lines)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line))
  const end = v.parse(jsonlEndSchema, records.at(-1))
  if (!end.complete) throw new Error("synthetic watch did not finish complete")
  return records.slice(0, -1).map((record) => v.parse(jsonlItemSchema(v.record(v.string(), v.unknown())), record).data)
}
