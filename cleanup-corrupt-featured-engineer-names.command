#!/bin/bash
# Cleanup: null out corrupt featuredEngineerName values
# (stringified coords or admin-region names) in DistrictLandingPage.
# Idempotent — safe to re-run after the patched extractBaseLocation ships.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

node_modules/.bin/ts-node \
  --transpile-only \
  --project scripts/tsconfig.scripts.json \
  scripts/cleanup-corrupt-featured-engineer-names.ts

echo ""
read -p "press enter to close..."
