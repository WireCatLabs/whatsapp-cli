#!/usr/bin/env bash
# Prints the git tree of <rev> without CHANGELOG.md and with the version set to 0.0.0 in package.json, in the engine
# packages of its optionalDependencies that carry the same version, and in src/version.ts: two commits share it only
# when everything but the changelog and the version is byte for byte the same.
#
#   scripts/ci-fingerprint.sh [rev]   (default HEAD)
set -euo pipefail

rev=${1:-HEAD}
index=$(mktemp)
trap 'rm -f "$index"' EXIT
export GIT_INDEX_FILE=$index

# The blob of <file> at $rev with its one version line, matched by <pattern>, set to 0.0.0, and with every line that
# starts with <same> and holds that same version. Never written to the object store: the fingerprint is the tree id.
neutral() {
  git show "$rev:$1" | FILE=$1 PATTERN=$2 SAME=${3:-} node -e '
    const text = require("fs").readFileSync(0, "utf8")
    const line = new RegExp(process.env.PATTERN, "gm")
    const found = text.match(line) ?? []
    if (found.length !== 1) {
      console.error(`${process.env.FILE} has ${found.length} version lines, not one`)
      process.exit(1)
    }
    const zero = (_, start) => `${start}0.0.0"`
    let out = text.replace(line, zero)
    if (process.env.SAME) {
      const version = /"([^"]*)"$/.exec(found[0])[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      out = out.replace(new RegExp(`${process.env.SAME}${version}"`, "gm"), zero)
    }
    process.stdout.write(out)
  ' | git hash-object --stdin
}

git read-tree "$rev"
git update-index --force-remove CHANGELOG.md
# Only package.json's top-level field, found by its two-space indent; anything else in the file stays as it is.
# The engine packages bin/release moves with the version; version:check proves they agree with it.
package=$(neutral package.json '^(  "version": ")[^"\n]*"' '^(    "@wirecat/whatsapp-engine-[a-z0-9-]+": ")')
version=$(neutral src/version.ts '^(export const VERSION = ")[^"\n]*"')
git update-index --cacheinfo "100644,$package,package.json" --cacheinfo "100644,$version,src/version.ts"
git write-tree --missing-ok
