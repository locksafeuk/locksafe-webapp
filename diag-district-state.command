#!/bin/bash
# Print the actual DB state for district landing pages so we can
# pinpoint why /locksmith-in/{slug} is 404'ing.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

node_modules/.bin/ts-node \
  --transpile-only \
  -r tsconfig-paths/register \
  --project scripts/tsconfig.scripts.json \
  scripts/diag-district-state.ts

echo ""
read -p "press enter to close..."
