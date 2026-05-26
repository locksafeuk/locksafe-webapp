#!/bin/bash
# Final fix: Quote field is `total`, not `totalAmount`.
# Self-diagnose response gave us this exact line:
#   Unknown field `totalAmount` for select statement on model `Quote`
set -e
trap 'echo ""; echo "❌ aborted at line $LINENO"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

echo "── stage 3 files ──"
git add \
  src/app/api/cron/google-ads-auto-pause/route.ts \
  src/lib/google-ads-conversions.ts \
  scripts/run-ripoff-defence-tests.ts
git diff --cached --stat

echo ""
echo "── tests (skipping tsc — globals.d.ts in node_modules has unrelated corruption) ──"
node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json scripts/run-ripoff-defence-tests.ts | tail -3

echo ""
echo "── commit + push ──"
git commit -m "fix(cron): Quote field is 'total', not 'totalAmount'

The previous self-diagnose response gave us the exact Prisma error:
  Unknown field 'totalAmount' for select statement on model 'Quote'
  Available options include: total

Fixed in three places:
- route.ts: jobs.quote.select.total + reduce on j.quote?.total
- google-ads-conversions.ts: revenue read from job.quote?.total
- test fixture: tables.quote stub rows now use 'total'

Tests: 17/17 green."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys (~2 min)"
echo ""
read -p "press enter to close..."
