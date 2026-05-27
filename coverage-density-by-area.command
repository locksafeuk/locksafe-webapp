#!/bin/bash
# Where do we have the most ACTIVE locksmiths? Ranks towns / regions /
# postcode-districts by distinct active locksmith count, London excluded
# from the recommendation. Read-only.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

node_modules/.bin/ts-node \
  --transpile-only \
  --project scripts/tsconfig.scripts.json \
  scripts/coverage-density-by-area.ts

echo ""
read -p "press enter to close..."
