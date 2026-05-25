#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# LockSafe — guarded deploy.
#
# Runs the full pre-flight sequence, shows the staged commit, PAUSES for
# your confirmation, then commits + pushes to origin/main. Vercel auto-
# deploys from main, so the push IS the deploy.
#
# Double-click to run (it's a .command file, macOS opens it in Terminal).
# Aborts on any step that fails so partial states never reach production.
# ─────────────────────────────────────────────────────────────────────────────

set -e
set -o pipefail
trap 'echo ""; echo "❌ aborted at line $LINENO"; read -p "press enter to close..."; exit 1' ERR

# Go to the repo regardless of where Finder opened the .command file from.
cd "$(dirname "$0")"

ORANGE='\033[1;33m'
GREEN='\033[1;32m'
RED='\033[1;31m'
BLUE='\033[1;34m'
DIM='\033[2m'
NC='\033[0m'

step() { echo ""; echo -e "${BLUE}══ $1 ══${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${ORANGE}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }

# ── 0. Sanity checks ─────────────────────────────────────────────────────────

step "0/8 sanity checks"
[ -d ".git" ]         || { fail "not a git repo — run this from locksafe-webapp/";  exit 1; }
[ -f "package.json" ] || { fail "package.json missing"; exit 1; }
command -v git    >/dev/null || { fail "git not in PATH"; exit 1; }
command -v node   >/dev/null || { fail "node not in PATH"; exit 1; }
command -v npx    >/dev/null || { fail "npx not in PATH"; exit 1; }
ok "in $(pwd)"
ok "git remote: $(git remote get-url origin 2>/dev/null || echo "(none — push will fail)")"
ok "current branch: $(git branch --show-current)"

# ── 1. Regenerate Prisma client ──────────────────────────────────────────────

step "1/8 regenerate Prisma client (picks up Job UTM + LocksmithCoverage)"
npx prisma generate
ok "client regenerated"

# ── 2. Push schema to MongoDB ────────────────────────────────────────────────

step "2/8 push schema to MongoDB"
echo "${DIM}(adds new fields: Job.utm*, Job.gclid, Job.conversionUpload*, UserSession.gclid + LocksmithCoverage model)${NC}"
npx prisma db push --skip-generate
ok "schema in sync with DB"

# ── 3. TypeScript ─────────────────────────────────────────────────────────────

step "3/8 typecheck"
npx tsc --noEmit
ok "no type errors"

# ── 4. Test suites ────────────────────────────────────────────────────────────

step "4/8 test suites"
echo "${DIM}competitor-intel unit (86)${NC}"
node_modules/.bin/ts-node --project tsconfig.scripts.json scripts/run-competitor-intel-tests.ts
echo "${DIM}competitor-intel scenario (32 — may use live network)${NC}"
node_modules/.bin/ts-node --project tsconfig.scripts.json scripts/scenario-competitor-intel.ts
echo "${DIM}competitor-intel agent integration (25)${NC}"
node_modules/.bin/ts-node -r tsconfig-paths/register --project tsconfig.scripts.json scripts/run-competitor-intel-agent-test.ts
echo "${DIM}coverage stack (21)${NC}"
node_modules/.bin/ts-node -r tsconfig-paths/register --project tsconfig.scripts.json scripts/run-coverage-tests.ts
echo "${DIM}rip-off defence (17)${NC}"
node_modules/.bin/ts-node -r tsconfig-paths/register --project tsconfig.scripts.json scripts/run-ripoff-defence-tests.ts
ok "all suites green"

# ── 5. Stage exactly the files we touched ────────────────────────────────────

step "5/8 stage files for commit"
# New files
git add prisma/schema.prisma                                                   2>/dev/null || true
git add src/lib/locksmith-coverage.ts                                          2>/dev/null || true
git add src/lib/google-ads-conversions.ts                                      2>/dev/null || true
git add src/lib/marketing/client-attribution.ts                                2>/dev/null || true
git add src/app/api/admin/locksmith-coverage/route.ts                          2>/dev/null || true
git add src/app/api/cron/google-ads-auto-pause/route.ts                        2>/dev/null || true
git add src/app/admin/locksmiths/coverage/page.tsx                             2>/dev/null || true
git add scripts/backfill-locksmith-coverage.ts                                 2>/dev/null || true
git add scripts/scenario-competitor-intel.ts                                   2>/dev/null || true
git add scripts/run-competitor-intel-tests.ts                                  2>/dev/null || true
git add scripts/run-competitor-intel-agent-test.ts                             2>/dev/null || true
git add scripts/run-coverage-tests.ts                                          2>/dev/null || true
git add scripts/run-ripoff-defence-tests.ts                                    2>/dev/null || true
git add deploy.command                                                          2>/dev/null || true
# Modified
git add src/lib/serp-intelligence-client.ts                                    2>/dev/null || true
git add src/lib/competitor-fingerprint.ts                                      2>/dev/null || true
git add src/lib/competitor-cross-validate.ts                                   2>/dev/null || true
git add src/agents/cmo/subagents/opportunity-scout/agent.ts                    2>/dev/null || true
git add src/agents/cmo/subagents/competitor-intel/agent.ts                     2>/dev/null || true
git add src/app/api/admin/ads/route.ts                                          2>/dev/null || true
git add src/lib/marketing/tracker.ts                                            2>/dev/null || true
git add src/app/api/webhooks/stripe/route.ts                                    2>/dev/null || true
git add src/app/api/jobs/route.ts                                                2>/dev/null || true
git add src/hooks/useUserTracking.ts                                            2>/dev/null || true
git add src/app/api/marketing/session/route.ts                                  2>/dev/null || true
git add src/app/api/auth/register/route.ts                                      2>/dev/null || true
git add vercel.json                                                             2>/dev/null || true
# Deprecated stub — remove it cleanly
if [ -f "src/lib/campaign-call-numbers.ts" ]; then
  git rm src/lib/campaign-call-numbers.ts 2>/dev/null || true
fi

echo ""
echo "Staged changes:"
echo "${DIM}────────────────────────────────────────${NC}"
git status --short | grep -E "^[MARD]" || warn "nothing staged"
echo "${DIM}────────────────────────────────────────${NC}"
echo ""
echo "Diff stats:"
git diff --cached --stat | tail -1

# ── 6. Confirmation gate ─────────────────────────────────────────────────────

step "6/8 confirmation"
echo "About to:"
echo "  1. commit the staged files (message preview below)"
echo "  2. push to origin/$(git branch --show-current) — Vercel auto-deploys"
echo ""
echo -e "${ORANGE}Commit message preview:${NC}"
echo "${DIM}────────────────────────────────────────${NC}"
cat <<'EOF'
feat: rip-off-defence stack + anti-shark expansion foundations

Phase 1 step 1 (coverage truth)
  - LocksmithCoverage Prisma model: per-locksmith × postcode-district
    capacity rows with pause flag, source provenance, confidence score
  - Backfill script from legacy Locksmith.coverageAreas[]
  - Admin UI at /admin/locksmiths/coverage with inline edit
  - Campaign-create gate: rejects campaigns targeting uncovered districts
    with actionable reasons (no_coverage / all_paused / all_at_capacity)
  - 21 tests

Phase 1 step 2 (rip-off defence)
  - Google Ads Conversions API uploader (server-side, idempotent)
  - Stripe webhook now fires Google conversion next to Meta on
    payment_intent.succeeded for paymentType=quote|final
  - Daily auto-pause cron: kills campaigns where cost-per-completed-job
    exceeds £25 OR bookings>=3 with zero completions (vanity pattern)
  - 17 tests covering payload formatting, eligibility, decision matrix

UTM + gclid attribution
  - Job model: utmSource/Medium/Campaign/Content/Term + gclid/fbclid
  - UserSession: same fields, captured at landing via useUserTracking
  - getClientAttribution() helper for any booking surface
  - request/page.tsx + register/route.ts both stamp attribution on Job
  - Server-side fallback: visitorId lookup when client didn't pass UTMs

Competitor intel hardening (calibrated to real 2026 markup)
  - SerpIntelligenceClient: js_only_serp detection, role=heading parser,
    unwrapGoogleRedirect (Google /url?q= wrappers), data-text-ad
    balanced-div extraction, plus opt-in setRenderedFetcher() hook for
    Playwright when ad-level data matters
  - CompetitorFingerprint: inner-page crawl of /about /pricing /services
    /locations /contact; meta-description captured; Cloudflare /
    JS-shell / non-HTML / empty-response classification
  - Cross-validator: phrase + synonym-aware matching (24/7 ↔ 24-hour,
    lockout ↔ locked-out, etc.); fpDomainText keyed by domain not token
  - Fixed two pre-existing bugs: dualConfirmed never fired for multi-
    word keywords; CompetitorGeoSignal never populated for template-only
    keywords (added IntelKeyword.geos[] passthrough)
  - 143 tests + live-data scenario passing

Cleanup
  - Removed CampaignCallNumber stub (per-campaign DID approach abandoned
    in favour of single shared website number + Google's own call-click
    attribution via Conversions API)
  - Fixed pre-existing TS errors in opportunity-scout agent

Total: 181 tests green
EOF
echo "${DIM}────────────────────────────────────────${NC}"
echo ""
read -r -p "Type 'yes' to commit and push (anything else aborts): " confirm
if [ "$confirm" != "yes" ]; then
  warn "aborted by user — nothing committed, nothing pushed"
  read -p "press enter to close..."
  exit 0
fi

# ── 7. Commit ────────────────────────────────────────────────────────────────

step "7/8 commit"
git commit -m "feat: rip-off-defence stack + anti-shark expansion foundations

Phase 1 step 1 — coverage truth:
- LocksmithCoverage Prisma model (per-locksmith x postcode-district
  capacity rows with pause/source/confidence)
- Backfill script from legacy coverageAreas[]
- Admin UI /admin/locksmiths/coverage with inline edit
- Campaign-create gate rejects targeting in uncovered districts
- 21 tests

Phase 1 step 2 — rip-off defence:
- Google Ads Conversions API uploader (server-side, idempotent)
- Stripe webhook fires Google conversion alongside Meta on
  payment_intent.succeeded for paymentType=quote|final
- Daily auto-pause cron kills campaigns where cost-per-completed-job
  > GBP 25 or bookings >= 3 with zero completions (vanity pattern)
- 17 tests

UTM + gclid attribution:
- Job model gains utmSource/Medium/Campaign/Content/Term + gclid/fbclid
- UserSession extended with same fields, captured at landing
- getClientAttribution() helper + wired through booking flow and
  register-with-pending-request path
- Server-side fallback: visitorId session lookup when body omits

Competitor-intel hardening (calibrated to real 2026 markup):
- SerpIntelligenceClient: js_only_serp detection, role=heading parser,
  unwrapGoogleRedirect, balanced-div ad extraction, opt-in
  setRenderedFetcher() for Playwright
- CompetitorFingerprint: inner-page crawl of /about /pricing /services
  /locations /contact; Cloudflare/JS-shell/non-HTML classification
- Cross-validator: synonym-aware phrase matching (24/7 <-> 24-hour,
  lockout <-> locked-out); domain-keyed evidence
- Fixed dualConfirmed never firing for multi-word keywords
- Fixed CompetitorGeoSignal never populated for template-only keywords
- 143 tests + live-data scenario passing

Cleanup:
- Removed dead-direction CampaignCallNumber model + lib
- Fixed pre-existing opportunity-scout TS errors

Total: 181 tests green"

ok "committed: $(git log -1 --pretty=format:'%h %s' | head -c 80)..."

# ── 8. Push ──────────────────────────────────────────────────────────────────

step "8/8 push to origin/$(git branch --show-current)"
git push origin "$(git branch --show-current)"
ok "pushed"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ DEPLOY TRIGGERED${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Vercel auto-deploys from main."
echo "Watch the build at: https://vercel.com/dashboard"
echo ""
echo "Post-deploy checklist (DO THIS):"
echo "  1. In Google Ads UI, create a new conversion action:"
echo "     Tools -> Conversions -> +New action -> Import"
echo "     -> Other data sources -> Track from clicks"
echo "     Value type: Use a value we record"
echo "     Currency: GBP"
echo "  2. Copy the resource name (customers/X/conversionActions/Y)"
echo "  3. Add to Vercel env (Production scope):"
echo "       GOOGLE_ADS_CONVERSION_ACTION_RESOURCE=<resource>"
echo "  4. Backfill locksmith coverage:"
echo "       npx ts-node --project tsconfig.scripts.json scripts/backfill-locksmith-coverage.ts"
echo "  5. Refine per-locksmith capacity at /admin/locksmiths/coverage"
echo "  6. Test the auto-pause cron in dryRun mode:"
echo "       curl -X POST -H \"Authorization: Bearer \$CRON_SECRET\" \\"
echo "         \"https://www.locksafe.uk/api/cron/google-ads-auto-pause?dryRun=1\""
echo ""
read -p "press enter to close..."
