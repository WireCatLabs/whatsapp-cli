import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll } from "vitest"
import { ARGV_LOG } from "./argv-log.js"

/**
 * **Moves the whole installation into a temporary directory, for every test file**, as max-cli and tg-cli do: a
 * test that reaches a command would otherwise read the owner's config, migrate the owner's store, and could open
 * the owner's linked WhatsApp device. `pnpm test` must not be able to write anything a person owns.
 */
// macOS's own temporary directory is long enough to push a socket path past its 104 bytes.
const sandbox = mkdtempSync(join(process.platform === "darwin" ? "/tmp" : tmpdir(), "wa-test-"))

process.env.WA_CONFIG_DIR = join(sandbox, "config")
process.env.WA_STATE_DIR = join(sandbox, "state")
process.env.WA_CACHE_DIR = join(sandbox, "cache")
process.env.WA_REQUESTS_PER_MINUTE = "0"
// cli-core's store is one file for every messenger, outside all three.
process.env.MESSAGING_STORE = join(sandbox, "messages.db")
process.env.WIRECAT_STATE_DIR = join(sandbox, "wirecat")
// `wa server install` writes the systemd unit under it — the owner's real one otherwise.
process.env.XDG_CONFIG_HOME = join(sandbox, "xdg-config")
process.env.TMPDIR = sandbox
process.env.TMP = sandbox
process.env.TEMP = sandbox
delete process.env.WA_ENGINE
delete process.env.WA_TIMEOUT
delete process.env.WA_PROFILE_LOCK
// No profile is ever assumed; a test about "none named" removes this from its own env.
process.env.WA_PROFILE = "default"
process.env.WA_TEST_SANDBOX = "1"
process.env.WA_TEST_ARGV_LOG = ARGV_LOG
for (const key of Object.keys(process.env)) {
  if (/^WA_(MODELS|EMBEDDING|ANALYSIS)_/.test(key)) delete process.env[key]
}
process.env.WA_NO_UPDATE_CHECK = "1"
delete process.env.AI_AGENT
delete process.env.CLAUDECODE

afterAll(() => rmSync(sandbox, { recursive: true, force: true }))
