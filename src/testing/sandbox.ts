import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll } from "vitest"
import { ARGV_LOG } from "./argv-log.js"

const saved = { ...process.env }

/**
 * wa's own part of the test setup. `@wirecat/cli-base/testing/setup` runs first and already gives each file a fresh
 * TMPDIR and HOME, a keyring that throws and no network beyond this machine.
 */
const sandbox = tmpdir()

// Set inside the file's folder rather than left to fall under its home: tests read these paths back.
process.env.WA_CONFIG_DIR = join(sandbox, "config")
process.env.WA_STATE_DIR = join(sandbox, "state")
process.env.WA_CACHE_DIR = join(sandbox, "cache")
// cli-core's store is one file for every messenger, outside all three.
process.env.MESSAGING_STORE = join(sandbox, "messages.db")
process.env.WIRECAT_STATE_DIR = join(sandbox, "wirecat")
process.env.WA_REQUESTS_PER_MINUTE = "0"
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

afterAll(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
  Object.assign(process.env, saved)
})
