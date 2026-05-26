#!/bin/bash
# Targeted deploy of the auto-pause schema fix.
# Only commits the route + test changes; nothing else.

set -e
trap 'echo ""; echo "❌ aborted at line $LINENO"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

GREEN='\033[1;32m'; BLUE='\033[1;34m'; DIM='\033[2m'; NC='\033[0m'
step() { echo ""; echo -e "${BLUE}══ $1 ══${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }

step "1/4 stage the auto-pause fix"
git add src/app/api/cron/google-ads-auto-pause/route.ts \
        scripts/run-ripoff-defence-tests.ts
echo "Staged:"
git diff --cached --stat
ok "staged"

step "2/4 typecheck (the Vercel-equivalent gate)"
npx tsc --noEmit
ok "no type errors"

step "3/4 tests"
node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json scripts/run-ripoff-defence-tests.ts
ok "17/17 green"

step "4/4 commit + push"
git commit -m "fix(cron): auto-pause uses GoogleAdsCampaignDraft + platform=google snapshots

The first auto-pause deploy was querying prisma.adCampaign.findMany with
a googleCampaignId filter — but AdCampaign is the Meta-side model and has
no googleCampaignId column. Prisma threw at runtime; route returned 500
with empty body; Vercel logged 3 cron invocations at 0ms duration.

Google Ads campaigns live in GoogleAdsCampaignDraft (post-publish state
is status=PUBLISHED, optional googleCampaignId carries the remote ID).
Spend is in AdPerformanceSnapshot with platform=\"google\" + the same
googleCampaignId string. account.customerId (not accountId) is the
dash-stripped numeric needed for the Google Ads API mutate.

This commit:
- route.ts now queries googleAdsCampaignDraft + filters platform=google
  on the snapshot lookup
- pauseRemoteCampaign called with account.customerId (was accountId)
- local pause updates googleAdsCampaignDraft (was adCampaign)
- test fixture rewritten to seed the right tables/fields/statuses
- 17/17 tests green"
ok "committed"

git push origin "$(git branch --show-current)"
ok "pushed — Vercel auto-deploys"

echo ""
echo -e "${GREEN}✓ deployed${NC}"
echo "Wait ~2 min for Vercel build, then re-run smoketest.command"
echo ""
read -p "press enter to close..."
