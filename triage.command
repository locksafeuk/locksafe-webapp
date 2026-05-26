#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# LockSafe — triage after the first smoke test surfaced issues.
#
#   1. Confirm /api/cron/google-ads-auto-pause/route.ts is on disk + in HEAD
#   2. Confirm Vercel served the new deploy (compare local SHA to a header
#      Vercel sets), and ping the new cron path to see what comes back
#   3. Re-run coverage backfill with tsconfig-paths registered (the fix)
#   4. Re-count coverage rows
#   5. Re-run auto-pause cron dryRun
# ─────────────────────────────────────────────────────────────────────────────

set +e
cd "$(dirname "$0")"

BASE_URL="${NEXT_PUBLIC_APP_URL:-https://www.locksafe.uk}"

GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
DIM='\033[2m'
NC='\033[0m'

# Load .env so we can read CRON_SECRET
[ -f ".env" ]       && { set -a; source .env       2>/dev/null; set +a; }
[ -f ".env.local" ] && { set -a; source .env.local 2>/dev/null; set +a; }

step() { echo ""; echo -e "${BLUE}══ $1 ══${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; [ -n "$2" ] && echo -e "  ${DIM}$2${NC}"; }
warn() { echo -e "${YELLOW}!${NC} $1"; [ -n "$2" ] && echo -e "  ${DIM}$2${NC}"; }
info() { echo -e "  ${DIM}$1${NC}"; }

# ── 1. Route file exists + committed ─────────────────────────────────────────

step "1. is the new cron route in the repo and pushed?"
ROUTE_PATH="src/app/api/cron/google-ads-auto-pause/route.ts"
if [ -f "$ROUTE_PATH" ]; then
  ok "file exists on disk: $ROUTE_PATH ($(wc -c < "$ROUTE_PATH") bytes)"
else
  err "file MISSING on disk!"
fi

if git ls-tree origin/main --name-only -r 2>/dev/null | grep -q "$ROUTE_PATH"; then
  COMMIT=$(git log origin/main -1 --pretty=format:'%h' -- "$ROUTE_PATH")
  ok "tracked in origin/main (introduced at $COMMIT)"
else
  err "NOT in origin/main — push didn't include the file"
fi

# ── 2. Hit the cron path and inspect the response carefully ──────────────────

step "2. what does production return for /api/cron/google-ads-auto-pause?"
echo "  GET  →"
RESP_GET=$(curl -sS -m 15 -w "\nHTTP_STATUS:%{http_code}\nCONTENT_TYPE:%{content_type}\n" \
  "$BASE_URL/api/cron/google-ads-auto-pause" 2>/dev/null)
echo "$RESP_GET" | tail -3 | sed 's/^/    /'

echo "  POST without auth →"
RESP_POST_NOAUTH=$(curl -sS -X POST -m 15 -w "\nHTTP_STATUS:%{http_code}\nCONTENT_TYPE:%{content_type}\n" \
  "$BASE_URL/api/cron/google-ads-auto-pause" 2>/dev/null)
echo "$RESP_POST_NOAUTH" | tail -3 | sed 's/^/    /'

echo "  POST with CRON_SECRET, dryRun=1 →"
RESP_POST_AUTH=$(curl -sS -X POST -m 30 \
  -H "Authorization: Bearer $CRON_SECRET" \
  -w "\nHTTP_STATUS:%{http_code}\nCONTENT_TYPE:%{content_type}\n" \
  "$BASE_URL/api/cron/google-ads-auto-pause?dryRun=1" 2>/dev/null)
echo "$RESP_POST_AUTH" | head -c 600
echo ""
echo "$RESP_POST_AUTH" | tail -3 | sed 's/^/    /'

# Diagnosis hints
if echo "$RESP_POST_AUTH" | grep -q '"success":true'; then
  ok "route is live + responding with JSON"
elif echo "$RESP_POST_AUTH" | grep -q '"Unauthorized"'; then
  warn "route exists but rejected CRON_SECRET (wrong value in Vercel env?)"
elif echo "$RESP_POST_AUTH" | grep -q '<!DOCTYPE html>'; then
  err "route NOT deployed — Next.js fell back to homepage" \
      "this means Vercel build failed for that route, OR Vercel hasn't picked up the new commit yet"
  echo ""
  echo -e "${YELLOW}  → check Vercel dashboard build logs for the latest deployment${NC}"
  echo -e "${YELLOW}  → if green, force a redeploy of latest commit${NC}"
else
  warn "unexpected response shape — see body above"
fi

# ── 3. Coverage backfill (with tsconfig-paths/register fix) ──────────────────

step "3. coverage backfill (with @/ alias fix)"
# capture output AND exit code, since `tee | tail` masks the inner status
BACKFILL_OUT=$(node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json scripts/backfill-locksmith-coverage.ts 2>&1)
BACKFILL_RC=$?
echo "$BACKFILL_OUT" | tail -15

if [ $BACKFILL_RC -eq 0 ]; then
  ok "backfill exited cleanly"
elif echo "$BACKFILL_OUT" | grep -q "MODULE_NOT_FOUND"; then
  err "still MODULE_NOT_FOUND — fix didn't take" \
      "make sure backfill-locksmith-coverage.ts has the tsconfig-paths.register block at the top"
else
  err "backfill failed (exit $BACKFILL_RC) — see tail above"
fi

# ── 4. LocksmithCoverage row count ───────────────────────────────────────────

step "4. LocksmithCoverage row count"
COUNT_JSON=$(node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json -e "
import { prisma } from './src/lib/db';
(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const total      = await p.locksmithCoverage.count();
  const active     = await p.locksmithCoverage.count({ where: { isPaused: false } });
  const districts  = (await p.locksmithCoverage.findMany({
    distinct: ['postcodeDistrict'], select: { postcodeDistrict: true },
  })).length;
  const sampleLocksmiths = await p.locksmith.count({ where: { isActive: true } });
  const locksmithsWithCoverage = (await p.locksmithCoverage.findMany({
    distinct: ['locksmithId'], select: { locksmithId: true },
  })).length;
  console.log(JSON.stringify({ total, active, districts, sampleLocksmiths, locksmithsWithCoverage }));
  process.exit(0);
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
" 2>&1 | tail -1)

if echo "$COUNT_JSON" | grep -q '"total"'; then
  echo "$COUNT_JSON" | python3 -m json.tool 2>/dev/null || echo "$COUNT_JSON"
  TOTAL=$(echo "$COUNT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null)
  if [ "$TOTAL" -gt 0 ]; then
    ok "$TOTAL coverage rows in production DB"
  else
    warn "0 rows" "either no active locksmiths or their coverageAreas[] arrays are empty"
  fi
else
  err "could not query — see above"
  echo "$COUNT_JSON" | head -c 300
fi

# ── 5. Cron dryRun (final verdict) ───────────────────────────────────────────

step "5. cron dryRun (final verdict)"
RESP=$(curl -sS -X POST -m 30 \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/cron/google-ads-auto-pause?dryRun=1" 2>/dev/null)
if echo "$RESP" | grep -q '"success":true'; then
  EVAL=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d.get(\"evaluated\",0)} campaigns evaluated, {d.get(\"paused\",0)} would-pause')" 2>/dev/null)
  ok "cron alive: $EVAL"
elif echo "$RESP" | grep -q '<!DOCTYPE html>'; then
  err "still serving HTML — the route is not on the live deployment"
  info "options:"
  info "  (a) wait 1-2 min for Vercel to finish building latest push, re-run this script"
  info "  (b) check Vercel build log — fix any errors and redeploy"
  info "  (c) confirm Vercel is connected to the right git branch"
else
  warn "unexpected response — first 200 chars:"
  echo "$RESP" | head -c 200
fi

echo ""
read -p "press enter to close..."
