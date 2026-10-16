import { contractCases } from "@wirecat/cli-core/testing"
import { describe, it } from "vitest"
import { fakeEngine, whatsAppIds } from "../testing/fake-engine.js"
import { whatsAppAdapter } from "./adapter.js"

describe("the WhatsApp adapter keeps the port's promises", () => {
  for (const one of contractCases({
    connect: (seed) => whatsAppAdapter(fakeEngine(seed)),
    ids: whatsAppIds,
    orderBy: "time",
    history: "store",
  }))
    it(one.name, async (context) => {
      const result = await one.run()
      if (result) context.skip(result.skipped)
    })
})
