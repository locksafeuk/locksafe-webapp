#!/bin/bash
# Final field-name fix: Quote has no `status` column.
# Self-diagnose response gave us the exact mistake — removed unused select.
set -e
trap 'echo ""; echo "❌ aborted at line $LINENO"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

git add src/app/api/cron/google-ads-auto-pause/route.ts
git diff --cached --stat

echo ""
node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json scripts/run-ripoff-defence-tests.ts | tail -3

echo ""
git commit -m "fix(cron): remove unused quote.status select (field doesn't exist)

Self-diagnose response: Quote has no 'status' field. Available options
include accepted, acceptedAt, declinedAt — state via flags, not a status
column. We weren't using the value, just selecting it. Removed."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
