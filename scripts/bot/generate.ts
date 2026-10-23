/**
 * The committed Cloud API snapshot → `src/bot/generated/` and the coverage page.
 *
 *   pnpm bot:generate            # write
 *   pnpm bot:generate:check      # fail if anything is out of date; writes nothing
 *
 * Reads only `spec/bot/`; never the network. `pnpm bot:spec:sync` refreshes the snapshot.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  type ApiModel,
  type ApiOperation,
  adaptOpenApi,
  coverageGenerator,
  definitionsGenerator,
  generate,
  kebab,
  manifestGenerator,
  typesGenerator,
  valibotGenerator,
  writeArtifacts,
} from "@wirecat/cli-base/codegen"
import { parse } from "yaml"
import { effects, FROM_SETTINGS, omitted, renames, VERSION_PARAMETER } from "./overrides.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")
const check = process.argv.includes("--check")

const provenance = JSON.parse(readFileSync(join(root, "spec/bot/provenance.json"), "utf8"))
const spec = `spec/bot/${provenance.file}`
const source = adaptOpenApi(parse(readFileSync(join(root, spec), "utf8")), {
  sourceUrl: provenance.source,
  sourceRevision: provenance.sourceRevision,
})

const problems: string[] = []
const ids = new Set(source.operations.map((operation) => operation.id))
for (const [table, entries] of Object.entries({ omitted, renames, effects }))
  for (const id of Object.keys(entries))
    if (!ids.has(id)) problems.push(`${table}: "${id}" matches no operation — stale, or Meta renamed it`)
for (const id of ids)
  if (!(id in omitted) && !(id in effects)) problems.push(`"${id}" is neither kept with an effect nor omitted`)
for (const id of Object.keys(effects)) if (id in omitted) problems.push(`"${id}" is both kept and omitted`)
if (problems.length > 0) {
  process.stderr.write(`bot:generate stopped:\n${problems.map((problem) => `  - ${problem}`).join("\n")}\n`)
  process.exit(1)
}

const kept = (operation: ApiOperation): ApiOperation => ({
  ...operation,
  id: renames[operation.id] ?? operation.id,
  effect: effects[operation.id],
  parameters: operation.parameters
    .filter((parameter) => !(parameter.in === "path" && parameter.name === VERSION_PARAMETER))
    .map((parameter) =>
      parameter.in === "path" && parameter.name in FROM_SETTINGS ? { ...parameter, required: false } : parameter,
    ),
})

const model: ApiModel = {
  ...source,
  operations: source.operations.filter((operation) => !(operation.id in omitted)).map(kept),
}

const leftOut = [
  "",
  "## Left out",
  "",
  "| Operation | Call | Why |",
  "|---|---|---|",
  ...source.operations
    .filter((operation) => operation.id in omitted)
    .map((operation) => {
      const call = operation.binding.kind === "http" ? `${operation.binding.method} ${operation.binding.path}` : ""
      return `| \`${operation.id}\` | \`${call}\` | ${omitted[operation.id]} |`
    }),
  "",
].join("\n")

const artifacts = generate(
  model,
  [
    typesGenerator({ path: "src/bot/generated/types.ts" }),
    valibotGenerator({ path: "src/bot/generated/schemas.ts", typesImport: "./types.js" }),
    manifestGenerator({ path: "src/bot/generated/manifest.ts" }),
    definitionsGenerator({ path: "src/bot/generated/definitions.ts" }),
    coverageGenerator({
      path: "docs/dev/bot-api-coverage.md",
      title: "WhatsApp Cloud API coverage",
      command: (operation) => `wa <profile> bot api ${operation.command}`,
    }),
  ],
  { banner: [`Source: ${spec}`, "Run: pnpm bot:generate"] },
).map((artifact) =>
  artifact.path.endsWith(".md")
    ? {
        ...artifact,
        content: `${artifact.content}${
          Object.keys(renames).length > 0
            ? `\n## Renamed\n\n| Meta's id | Command |\n|---|---|\n${Object.entries(renames)
                .map(([from, to]) => `| \`${from}\` | \`${kebab(to)}\` |`)
                .join("\n")}\n`
            : ""
        }${leftOut}`,
      }
    : artifact,
)

const biome = join(root, "node_modules/@biomejs/biome/bin/biome")
const format = (path: string, content: string): string =>
  path.endsWith(".ts")
    ? execFileSync(process.execPath, [biome, "check", "--write", `--stdin-file-path=${path}`], {
        input: content,
        encoding: "utf8",
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
      })
    : content

const stale = writeArtifacts(artifacts, { root, check, format })
if (check && stale.length > 0) {
  process.stderr.write(`out of date — run pnpm bot:generate:\n${stale.map((path) => `  ${path}`).join("\n")}\n`)
  process.exit(1)
}
process.stderr.write(
  `${model.operations.length} operations kept, ${source.operations.length - model.operations.length} left out, ${stale.length} file(s) ${check ? "checked" : "written"}\n`,
)
