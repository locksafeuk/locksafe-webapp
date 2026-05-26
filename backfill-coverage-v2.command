#!/bin/bash
# Radius-based coverage backfill — populates LocksmithCoverage from
# baseLat/baseLng + coverageRadius using postcodes.io.
# Should produce ~400 rows (43 locksmiths × ~10 districts each).
set -e
trap 'echo ""; echo "❌ aborted"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

echo "── DRY RUN preview first ──"
DRY_RUN=1 node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json \
  scripts/backfill-locksmith-coverage-v2.ts
echo ""
read -p "type 'yes' to run for real (writes to MongoDB): " confirm
if [ "$confirm" != "yes" ]; then
  echo "aborted by user — nothing written"
  read -p "press enter to close..."
  exit 0
fi

echo ""
echo "── running for real ──"
node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json \
  scripts/backfill-locksmith-coverage-v2.ts

read -p "press enter to close..."
