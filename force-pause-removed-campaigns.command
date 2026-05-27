#!/bin/bash
# Force-pause the 3 known-REMOVED campaigns by name (no GAQL — DB only).
# Idempotent. Pass --apply to commit changes; default is dry-run.
#
# Use when the regular remediate-removed-drift can't find the campaigns
# because Google has purged them from `FROM campaign` queries entirely.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

node_modules/.bin/ts-node \
  --transpile-only \
  --project scripts/tsconfig.scripts.json \
  scripts/force-pause-removed-campaigns.ts "$@"

echo ""
read -p "press enter to close..."
