#!/bin/sh
# Refuses a Bash call that asks to leave the sandbox (`dangerouslyDisableSandbox`). In bypass mode
# that request would otherwise run unasked, and the sandbox is what keeps shell writes inside
# ~/Projects/AI. Only `excludedCommands` in settings.json run outside it.
set -eu
if [ "$(jq -r '.tool_input.dangerouslyDisableSandbox // false')" = "true" ]; then
  echo "refused: shell commands here stay in the sandbox; only a plain \`bin/wa …\` runs outside it (docs/dev/agents.md)" >&2
  exit 2
fi
