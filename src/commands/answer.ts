import type { Renderer, RenderFormat } from "@wirecat/cli-base"
import { itemOf, jsonlRecords, sealed } from "@wirecat/cli-core/cli"

export const itemAnswer = <T>(item: T) => sealed(itemOf(item))

export const printItem = ({ renderer, format }: { renderer: Renderer; format: RenderFormat }, item: unknown): void => {
  if (format === "json") renderer.result(itemAnswer(item))
  else if (format === "jsonl") renderer.stream(jsonlRecords(itemOf(item)))
  else renderer.result(item)
}
