import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { privateStore } from "../dist/paths.js"

const path = privateStore("contract", process.env)
const expected = join(process.env.WA_STATE_DIR, "profiles", "contract", "private.db")
if (path !== expected) throw new Error("device database moved during upgrade")
const digest = createHash("sha256").update(readFileSync(path)).digest("hex")
if (digest !== readFileSync(join(process.env.WA_STATE_DIR, "device-sha256"), "utf8")) {
  throw new Error("offline reads changed the device database")
}
process.stdout.write(`${JSON.stringify({ preserved: true })}\n`)
