#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# LockSafe — full production smoke test.
#
# Verifies the just-shipped anti-shark stack is alive end-to-end:
#   1. Latest commit matches what we pushed
#   2. Production site responds (Vercel deploy succeeded)
#   3. Coverage backfill populates LocksmithCoverage from existing locksmiths
#   4. Coverage data is queryable via the live MongoDB
#   5. Auto-pause cron endpoint responds correctly in dryRun mode
#   6. Google Ads conversion env var is set in prod (if accessible)
#
# Read-only where possible; the one write step (backfill) is idempotent.
# ─────────────────────────────────────────────────────────────────────────────

set +e  # don't abort on a single check failing — collect all verdicts
cd "$(dirname "$0")"

BASE_URL="${NEXT_PUBLIC_APP_URL:-https://www.locksafe.uk}"

GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
DIM='\033[2m'
NC='\033[0m'

pass=0
fail=0
warns=0

step() { echo ""; echo -e "${BLUE}══ $1 ══${NC}"; }
ok()   { pass=$((pass+1)); echo -e "${GREEN}✓${NC} $1"; }
err()  { fail=$((fail+1)); echo -e "${RED}✗${NC} $1"; [ -n "$2" ] && echo -e "  ${DIM}$2${NC}"; }
warn() { warns=$((warns+1)); echo -e "${YELLOW}!${NC} $1"; [ -n "$2" ] && echo -e "  ${DIM}$2${NC}"; }
info() { echo -e "  ${DIM}$1${NC}"; }

# ── Load env (CRON_SECRET, GOOGLE_ADS_CONVERSION_ACTION_RESOURCE) ────────────

if [ -f ".env" ]; then
  set -a
  source .env 2>/dev/null
  set +a
fi
if [ -f ".env.local" ]; then
  set -a
  source .env.local 2>/dev/null
  set +a
fi

# ── 1. Git / deploy correlation ──────────────────────────────────────────────

step "1/6  git + deploy correlation"
LOCAL_SHA=$(git rev-parse --short HEAD 2>/dev/null)
REMOTE_SHA=$(git rev-parse --short origin/main 2>/dev/null)
info "local HEAD:    $LOCAL_SHA"
info "origin/main:   $REMOTE_SHA"
if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  ok "local main matches origin/main"
else
  warn "local ahead of/behind origin — your deploy may not have the latest"
fi
LAST_COMMIT_MSG=$(git log -1 --pretty=format:'%s' | head -c 80)
info "last commit: $LAST_COMMIT_MSG…"

# ── 2. Vercel deploy alive ───────────────────────────────────────────────────

step "2/6  $BASE_URL responding"
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" -m 15 "$BASE_URL" 2>/dev/null)
case "$STATUS" in
  200|301|302|307|308) ok "homepage returns HTTP $STATUS" ;;
  000)                 err "could not reach $BASE_URL" "DNS / network / Vercel may still be building" ;;
  *)                   err "unexpected HTTP $STATUS from $BASE_URL" ;;
esac

# ── 3. Locksmith coverage backfill (idempotent) ──────────────────────────────

step "3/6  locksmith coverage backfill"
info "this is idempotent — re-running just refreshes timestamps"
node_modules/.bin/ts-node --project tsconfig.scripts.json scripts/backfill-locksmith-coverage.ts 2>&1 | tail -10
if [ $? -eq 0 ]; then
  ok "backfill completed"
else
  err "backfill threw"
fi

# ── 4. Count coverage rows (verify data exists) ──────────────────────────────

step "4/6  LocksmithCoverage row count"
ROW_COUNT=$(node_modules/.bin/ts-node --project tsconfig.scripts.json -e "
import { prisma } from './src/lib/db';
(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const total      = await p.locksmithCoverage.count();
  const active     = await p.locksmithCoverage.count({ where: { isPaused: false } });
  const districts  = (await p.locksmithCoverage.findMany({
    distinct: ['postcodeDistrict'], select: { postcodeDistrict: true },
  })).length;
  console.log(JSON.stringify({ total, active, districts }));
  process.exit(0);
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
" 2>/dev/null | tail -1)

if echo "$ROW_COUNT" | grep -q '"total"'; then
  TOTAL=$(echo "$ROW_COUNT" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null)
  ACTIVE=$(echo "$ROW_COUNT" | python3 -c "import sys,json; print(json.load(sys.stdin)['active'])" 2>/dev/null)
  DISTRICTS=$(echo "$ROW_COUNT" | python3 -c "import sys,json; print(json.load(sys.stdin)['districts'])" 2>/dev/null)
  info "total rows: $TOTAL"
  info "active (not paused): $ACTIVE"
  info "unique districts covered: $DISTRICTS"
  if [ "$TOTAL" -gt 0 ]; then
    ok "coverage data populated"
  else
    warn "no coverage rows" "Locksmiths may have no postcodes in their legacy coverageAreas — refine via /admin/locksmiths/coverage"
  fi
else
  err "could not query LocksmithCoverage" "$ROW_COUNT"
fi

# ── 5. Auto-pause cron dryRun ────────────────────────────────────────────────

step "5/6  auto-pause cron (dryRun)"
if [ -z "$CRON_SECRET" ]; then
  warn "CRON_SECRET not set" "skipping cron smoke-test"
else
  RESP=$(curl -sS -X POST -m 30 \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$BASE_URL/api/cron/google-ads-auto-pause?dryRun=1" 2>/dev/null)
  if echo "$RESP" | grep -q '"success":true'; then
    EVAL=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d.get(\"evaluated\",0)} evaluated, {d.get(\"paused\",0)} would-pause (dry-run)')" 2>/dev/null)
    ok "cron responded: $EVAL"
    THRESH=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin)['thresholds']; print(f'min_spend=£{d[\"MIN_SPEND_GBP\"]}, max_cpc_complete=£{d[\"MAX_COST_PER_COMPLETE_GBP\"]}, rolling={d[\"ROLLING_DAYS\"]}d')" 2>/dev/null)
    info "thresholds: $THRESH"
  elif echo "$RESP" | grep -q '"Unauthorized"'; then
    err "cron rejected CRON_SECRET" "value in .env doesn't match Vercel env"
  else
    err "cron unhealthy response" "$(echo "$RESP" | head -c 200)"
  fi
fi

# ── 6. Google Ads conversion env var (local check, prod has its own) ─────────

step "6/6  GOOGLE_ADS_CONVERSION_ACTION_RESOURCE configured"
if [ -n "$GOOGLE_ADS_CONVERSION_ACTION_RESOURCE" ]; then
  if [[ "$GOOGLE_ADS_CONVERSION_ACTION_RESOURCE" =~ ^customers/[0-9]+/conversionActions/[0-9]+$ ]]; then
    ok "set locally: $GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"
    info "make sure the same value is set in Vercel production env"
  else
    warn "set locally but malformed" "expected: customers/X/conversionActions/Y"
  fi
else
  warn "not set locally" "rip-off vaccine inactive until you create the conversion action in Google Ads UI and set this in Vercel production env"
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
if [ $fail -eq 0 ]; then
  echo -e "${GREEN}SMOKE TEST: $pass passed / $warns warnings / 0 failed${NC}"
  echo ""
  if [ $warns -eq 0 ]; then
    echo -e "${GREEN}✓ 100% system check clean${NC}"
  else
    echo -e "${YELLOW}System is live; warnings above are operational gaps you can close at your pace.${NC}"
  fi
else
  echo -e "${RED}SMOKE TEST: $pass passed / $warns warnings / $fail failed${NC}"
  echo ""
  echo -e "${RED}Address the failures above before running real campaigns.${NC}"
fi
echo -e "${BLUE}════════════════════════════════════════${NC}"

read -p "press enter to close..."
