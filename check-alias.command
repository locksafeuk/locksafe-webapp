#!/bin/bash
# Compare the production alias (www.locksafe.uk) against the latest preview
# deployment URL. Tells us definitively whether the production alias is
# pointing at the latest build, or stuck on an older one.

set +e
cd "$(dirname "$0")"

GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
DIM='\033[2m'
NC='\033[0m'

# Load CRON_SECRET
[ -f ".env" ]       && { set -a; source .env       2>/dev/null; set +a; }
[ -f ".env.local" ] && { set -a; source .env.local 2>/dev/null; set +a; }

PROD_URL="https://www.locksafe.uk"
PREVIEW_URL="https://locksafe-webapp-1loe3w6c7-locksafeuks-projects.vercel.app"
CRON_PATH="/api/cron/google-ads-auto-pause?dryRun=1"

echo ""
echo -e "${BLUE}══ comparing production alias vs latest preview ══${NC}"
echo ""

probe() {
  local label="$1"; local url="$2"
  echo -e "${BLUE}→ $label${NC}"
  echo -e "  ${DIM}$url${NC}"
  RESP=$(curl -sS -X POST -m 30 \
    -H "Authorization: Bearer $CRON_SECRET" \
    -w "\n__HTTP_STATUS:%{http_code}\n__CONTENT_TYPE:%{content_type}\n" \
    "$url$CRON_PATH" 2>&1)
  STATUS=$(echo "$RESP" | grep "__HTTP_STATUS" | cut -d: -f2)
  CTYPE=$(echo "$RESP" | grep "__CONTENT_TYPE" | cut -d: -f2-)
  BODY=$(echo "$RESP" | grep -v "__HTTP_STATUS\|__CONTENT_TYPE")

  echo -e "  HTTP $STATUS, content-type: $CTYPE"
  if echo "$BODY" | grep -q '"success":true'; then
    echo -e "  ${GREEN}✓ JSON response — route is live, env var configured${NC}"
    EVAL=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ evaluated={d.get(\"evaluated\",0)}, paused={d.get(\"paused\",0)}, thresholds active')" 2>/dev/null)
    echo "$EVAL"
  elif echo "$BODY" | grep -q '<!DOCTYPE html>'; then
    echo -e "  ${RED}✗ HTML response — route NOT deployed here${NC}"
  elif echo "$BODY" | grep -q '"Unauthorized"'; then
    echo -e "  ${YELLOW}! Unauthorized — route is deployed but auth rejected${NC}"
    echo -e "    ${DIM}CRON_SECRET in .env may not match Vercel env${NC}"
  elif [ -z "$BODY" ]; then
    echo -e "  ${RED}✗ empty body${NC}"
  else
    echo -e "  ${YELLOW}! unknown response shape${NC}"
    echo "$BODY" | head -c 200 | sed 's/^/    /'
  fi
  echo ""
}

probe "PRODUCTION (www.locksafe.uk)" "$PROD_URL"
probe "PREVIEW (the new deployment direct URL)" "$PREVIEW_URL"

echo -e "${BLUE}══ verdict ══${NC}"
echo ""
echo "If PREVIEW = JSON ✓ and PRODUCTION = HTML ✗ →"
echo "   The latest deploy is built and has the env var, but"
echo "   www.locksafe.uk is still aliased to an OLDER deploy."
echo "   Fix: Vercel dashboard → Deployments → click latest 'Ready' row →"
echo "        Promote to Production (••• menu)"
echo ""
echo "If BOTH = JSON ✓ → everything is fine, smoketest had stale cache"
echo "If BOTH = HTML ✗ → route is missing from build, deeper issue"
echo "If PREVIEW = Unauthorized → CRON_SECRET in Vercel ≠ local .env"
echo ""

read -p "press enter to close..."
