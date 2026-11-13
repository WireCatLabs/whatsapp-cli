import type { ManifestIdentity } from "@wirecat/cli-base/wcat/manifest"
import { keyForCommand } from "@wirecat/cli-core/sends"
import { DESKTOP } from "./identity.js"

export const WCAT: ManifestIdentity = { ...DESKTOP, permissionOf: (path) => keyForCommand(path) ?? null }
