import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const EXE = process.platform === "win32" ? ".exe" : ""

/** The npm package that carries the engine for this system, an optional dependency of whatsapp-cli. */
export const enginePackage = (platform: string = process.platform, arch: string = process.arch): string =>
  `@wirecat/whatsapp-engine-${platform}-${arch}`

const installed = (): string | undefined => {
  try {
    const manifest = createRequire(import.meta.url).resolve(`${enginePackage()}/package.json`)
    return join(dirname(manifest), "bin", `wa-engine${EXE}`)
  } catch {
    return undefined
  }
}

/** `WA_ENGINE`, else the engine package installed beside the CLI, else the binary `pnpm engine:build` writes. */
export const engineBinary = (env: NodeJS.ProcessEnv = process.env): string =>
  env.WA_ENGINE || installed() || fileURLToPath(new URL(`../engine/bin/wa-engine${EXE}`, import.meta.url))
