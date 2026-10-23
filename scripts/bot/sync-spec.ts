/**
 * Fetches Meta's Business Messaging OpenAPI file into `spec/bot/`, on purpose and at development time only.
 * Nothing at run time reads the network for it.
 *
 *   pnpm bot:spec:sync
 *   pnpm bot:spec:sync --from path/to/file.yaml [--revision <sha>]
 *
 * Refuses, leaving the committed snapshot as it was, when the result is not an OpenAPI 3 document
 * with operations in it. A new Graph version is a new file name upstream: change FILE, then sync.
 * The sample phone numbers in Meta's examples are replaced before anything is written (scrub.ts).
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"
import { scrubPhoneNumbers } from "./scrub.ts"

const REPOSITORY = "facebook/openapi"
const FILE = "business-messaging-api_v23.0.yaml"
const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

const option = (name: string): string | undefined => {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

const fail = (message: string): never => {
  process.stderr.write(`bot:spec:sync: ${message}; spec/bot/ left unchanged\n`)
  process.exit(1)
}

const latest = async (): Promise<{ text: string; revision: string }> => {
  const commit = await fetch(`https://api.github.com/repos/${REPOSITORY}/commits/main`, {
    headers: { accept: "application/vnd.github+json" },
  })
  if (!commit.ok) fail(`GitHub answered ${commit.status} for the latest commit`)
  const { sha } = (await commit.json()) as { sha: string }
  const file = await fetch(`https://raw.githubusercontent.com/${REPOSITORY}/${sha}/${FILE}`)
  if (!file.ok) fail(`GitHub answered ${file.status} for ${FILE} at ${sha}`)
  return { text: await file.text(), revision: sha }
}

const from = option("--from")
const { text, revision } = from
  ? { text: readFileSync(from, "utf8"), revision: option("--revision") ?? "local" }
  : await latest()

let document: { openapi?: unknown; info?: { version?: unknown }; paths?: Record<string, Record<string, unknown>> }
try {
  document = parse(text)
} catch (error) {
  fail(`not YAML: ${(error as Error).message}`)
  throw error
}
if (typeof document?.openapi !== "string" || !document.openapi.startsWith("3.")) fail("not an OpenAPI 3 document")
const methods = new Set(["get", "post", "put", "patch", "delete", "head"])
const operations = Object.values(document.paths ?? {}).flatMap((item) =>
  Object.keys(item).filter((key) => methods.has(key)),
)
if (operations.length === 0) fail("the document has no operations")

const scrubbed = scrubPhoneNumbers(text)
writeFileSync(join(root, "spec/bot", FILE), scrubbed.text)
const provenance = {
  source: `https://github.com/${REPOSITORY}`,
  file: FILE,
  license: "MIT, spec/bot/LICENSE",
  sourceRevision: revision,
  apiVersion: document.info?.version,
  syncedAt: new Date().toISOString(),
  upstreamSha256: createHash("sha256").update(text).digest("hex"),
  sha256: createHash("sha256").update(scrubbed.text).digest("hex"),
  phoneNumbersReplaced: scrubbed.replaced,
  scrubbed: "sample phone numbers in examples replaced with fictional 1555-01NN by scripts/bot/scrub.ts",
}
writeFileSync(join(root, "spec/bot/provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`)
process.stderr.write(`spec/bot/${FILE}: ${operations.length} operations, ${provenance.apiVersion} at ${revision}\n`)
