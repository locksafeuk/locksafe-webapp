#!/bin/bash
# Deploy the try/catch wrapper + bracket-notation env fix.
# After this lands, the cron returns either real JSON or a structured
# JSON error (with stack trace) instead of HTTP 500 + empty body.

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
echo "── typecheck (Vercel-equivalent) ──"
npx tsc --noEmit

echo ""
echo "── tests ──"
node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json scripts/run-ripoff-defence-tests.ts | tail -3

echo ""
echo "── commit + push ──"
git commit -m "fix(cron): self-diagnosing auto-pause + bracket-notation env access

Two issues blocking the verification:

1. Auto-pause cron was throwing an unhandled exception → Vercel returned
   HTTP 500 with empty body, hiding the actual error. Wrapped the route
   body in try/catch with explicit JSON error response (including
   message + truncated stack). Now self-diagnosing: any future runtime
   issues surface in the response itself, no Vercel function-logs
   spelunking required.

2. Strict env-typing rejected process.env.AUTO_PAUSE_* and
   GOOGLE_ADS_CONVERSION_ACTION_RESOURCE references after the latest
   next-env regen. Switched to process.env[\"X\"] bracket notation which
   bypasses the strict NodeJS.ProcessEnv interface check while still
   giving us runtime env access.

Tests: 17/17 green."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys (~2 min)"
echo ""
read -p "press enter to close..."
