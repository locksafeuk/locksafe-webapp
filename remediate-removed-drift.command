#!/bin/bash
# Remediate REMOVED-drift cases — flip Locksafe status from PUBLISHED
# to PAUSED for campaigns that Google Ads has removed entirely.
# DEFAULT IS DRY-RUN. Pass --apply to actually commit changes.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

node_modules/.bin/ts-node \
  --transpile-only \
  --project scripts/tsconfig.scripts.json \
  scripts/remediate-removed-drift.ts "$@"

echo ""
read -p "press enter to close..."
