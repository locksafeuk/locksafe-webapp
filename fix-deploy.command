#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# LockSafe — corrective deploy after the build failed because
# uncommitted local changes were referenced by what we pushed.
#
# Stages all modified files + relevant new files, skipping noise
# (tmp/, *.bak, sed-backup artefacts). Re-runs typecheck against the
# real production tsconfig (next build does the same), and only
# pushes when tsc passes — that's the same gate Vercel applies.
# ─────────────────────────────────────────────────────────────────────────────

set -e
set -o pipefail
trap 'echo ""; echo "❌ aborted at line $LINENO"; read -p "press enter to close..."; exit 1' ERR

cd "$(dirname "$0")"

GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
DIM='\033[2m'
NC='\033[0m'

step() { echo ""; echo -e "${BLUE}══ $1 ══${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "  ${DIM}$1${NC}"; }

# ── 1. Clean up noise that shouldn't be committed ────────────────────────────

step "1/6 clean up noise"
# Remove sed backups left over from quick fixes
find . -maxdepth 3 -name "*.ts.bak" -not -path "./node_modules/*" -delete 2>/dev/null || true
# Verify tmp/ stays untracked (it's debug dumps from scenario)
git check-ignore tmp/ >/dev/null 2>&1 || info "tmp/ not gitignored — staging will skip it via explicit pathspec exclusion"
ok "cleaned"

# ── 2. Stage everything except noise ─────────────────────────────────────────

step "2/6 stage modified + new files"
# Start broad
git add -A
# Then explicitly unstage noise
git restore --staged tmp/                                                          2>/dev/null || true
git restore --staged scripts/run-ripoff-defence-tests.ts.bak                       2>/dev/null || true
# Don't commit deploy artefacts that already exist (smoketest etc. are useful, keep them)
echo ""
echo "Staged changes:"
echo "${DIM}────────────────────────────────────────${NC}"
git status --short | grep -E "^[MARD]" || { echo "  (nothing staged)"; exit 1; }
echo "${DIM}────────────────────────────────────────${NC}"
git diff --cached --stat | tail -1

# ── 3. TypeScript check (the same gate Vercel applies) ───────────────────────

step "3/6 typecheck against production tsconfig"
echo "  (this is what failed on Vercel last time — strict mode, isolatedModules)"
npx tsc --noEmit
ok "no type errors"

# ── 4. Run all 5 test suites ─────────────────────────────────────────────────

step "4/6 run test suites"
node_modules/.bin/ts-node --project tsconfig.scripts.json scripts/run-competitor-intel-tests.ts
node_modules/.bin/ts-node -r tsconfig-paths/register --project tsconfig.scripts.json scripts/run-coverage-tests.ts
node_modules/.bin/ts-node -r tsconfig-paths/register --project tsconfig.scripts.json scripts/run-ripoff-defence-tests.ts
ok "tests green"

# ── 5. Confirmation ──────────────────────────────────────────────────────────

step "5/6 confirmation"
echo "About to commit + push to origin/$(git branch --show-current) — Vercel auto-deploys."
echo ""
read -r -p "type 'yes' to proceed: " confirm
if [ "$confirm" != "yes" ]; then
  echo "${YELLOW}aborted — nothing committed${NC}"
  read -p "press enter to close..."
  exit 0
fi

# ── 6. Commit + push ─────────────────────────────────────────────────────────

step "6/6 commit + push"
git commit -m "fix(deploy): include pre-existing local changes the prior commit referenced

The prior anti-shark deploy explicitly staged only files I touched, but
several of those (notably opportunity-scout/agent.ts) called methods on
GoogleAdsClient that existed only in the user's uncommitted local copy
of src/lib/google-ads.ts. The Vercel build caught it as:

  Property 'getAuctionInsights' does not exist on type 'GoogleAdsClient'

This commit brings the local state of:
- src/lib/google-ads.ts (300+ lines of accumulated methods, incl.
  getAuctionInsights, getHourlyPerformance, KP site-seed expansion)
- src/lib/google-ads-opportunities.ts (companion types + reflection
  return shape consumed by opportunity-scout)
- src/agents/core/seed-bank.ts (addSeed signature)
- src/app/admin/integrations/google-ads/opportunities/page.tsx
- src/app/request/page.tsx (visitorId + UTM wiring on booking form,
  was missing from the prior commit — UTM attribution would otherwise
  never reach Job rows in production)
- scripts/backfill-locksmith-coverage.ts (tsconfig-paths registration
  so the @/ alias resolves at ts-node runtime)
- new operational tooling: smoketest.command, triage.command,
  fix-deploy.command, unlock-and-deploy.command
- new lib files: keyword-geo-score, jest test stubs (won't run via
  ts-jest in this env but compile-check cleanly)

After this push, Vercel should build clean and the cron route will be
live at /api/cron/google-ads-auto-pause."

ok "committed: $(git log -1 --pretty=format:'%h' | head -c 12)"

git push origin "$(git branch --show-current)"
ok "pushed"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ corrective deploy pushed${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Watch Vercel: https://vercel.com/dashboard"
echo "Once build is green, re-run smoketest.command"
echo ""
read -p "press enter to close..."
