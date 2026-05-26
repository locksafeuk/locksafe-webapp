#!/bin/bash
# Phase 3b — per-call attribution (CallIntent + matcher + click-to-call helper).
#
# Steps:
#   1. Run the new Phase 3b unit tests
#   2. prisma generate (refresh the local client for the new CallIntent model)
#   3. prisma db push (sync the new CallIntent collection to MongoDB)
#   4. Commit + push to main

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Step 1/4 — Running Phase 3b tests"
echo ""
npx jest --testPathPatterns='(call-intent|click-to-call)' --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Step 2/4 — prisma generate (refresh Prisma client for CallIntent)"
echo ""
npx prisma generate
echo ""

echo "▶ Step 3/4 — prisma db push (sync CallIntent to MongoDB)"
echo "   (this creates the new collection + indexes; non-destructive)"
echo ""
read -p "Type 'go' to push the schema change to MongoDB: " confirm
if [ "$confirm" != "go" ]; then
  echo "  aborted — schema NOT pushed"
  echo "  re-run when ready (the commit step is also skipped)"
  exit 1
fi
npx prisma db push
echo ""

echo "▶ Step 4/4 — Commit + push to main"
echo ""
git add \
  prisma/schema.prisma \
  src/lib/marketing/call-intent-matcher.ts \
  src/lib/marketing/click-to-call.ts \
  src/lib/marketing/__tests__/call-intent-matcher.test.ts \
  src/lib/marketing/__tests__/click-to-call.test.ts \
  src/app/api/marketing/call-intent/route.ts \
  src/app/api/marketing/call-intent/__tests__/call-intent.test.ts \
  src/lib/retell-handler.ts \
  src/lib/google-ads-conversions.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase3b): per-call attribution loop — CallIntent + Retell matcher

Closes the loop on call-led jobs. Now when a visitor clicks the
website Call CTA, lands on Retell via Zadarma, and books a job that
later completes paid, Google Ads gets credited with the right click
— even though we use ONE shared website phone instead of per-campaign
DIDs.

Pipeline:
  1. Visitor clicks Call → recordCallIntent() fires a beacon
     (sendBeacon-preferred, keepalive-fetch fallback) to
     POST /api/marketing/call-intent. CallIntent row created with
     visitorId + gclid + UTMs captured client-side.
  2. tel: opens, user dials, call hits Retell via Zadarma.
  3. Retell call_started webhook → handleCallStarted →
     matchInboundCall() finds the freshest unmatched CallIntent
     (visitor-scoped first, global-recent fallback within 5min).
     Atomic updateMany predicate prevents double-claim under
     concurrent webhook deliveries.
  4. Retell agent creates a Job → VoiceCall.jobId set (existing).
  5. Stripe payment_intent.succeeded → uploadJobConversionIfEligible
     falls through to CallIntent when Job.gclid is null:
       Job → VoiceCall (jobId) → CallIntent (retellCallId, matched)
       → upload using CallIntent.gclid.
     Mirrors upload outcome back onto CallIntent for audit.

New module:
  prisma/schema.prisma            +CallIntent model + 4 indexes
  src/lib/marketing/
    call-intent-matcher.ts        two-strategy atomic matcher
    click-to-call.ts              fire-and-forget beacon helper
  src/app/api/marketing/
    call-intent/route.ts          POST endpoint (visitorId-required)

Modified:
  src/lib/retell-handler.ts       call_started → matchInboundCall hook
                                  (dynamic import so matcher errors
                                  can't crash the primary call flow)
  src/lib/google-ads-conversions.ts
                                  Job.gclid → CallIntent.gclid fallback,
                                  with audit mirror back to CallIntent

~40 unit tests cover the matcher (both strategies, race conditions,
invalid timestamps), the POST endpoint (validation, allowlist semantics,
DB-failure-as-200 contract so the tel: dial never blocks), and the
click-to-call helper (sendBeacon preference, fetch fallback, never
throws, anchor-vs-button modes)."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
echo ""
echo "WHAT TO DO NEXT"
echo "──────────────"
echo "  1. Vercel rebuilds with the new CallIntent client"
echo "  2. Update the website's Call button to call trackAndCall()"
echo "     from src/lib/marketing/click-to-call.ts"
echo "  3. Test by clicking Call on the live site, then verify a"
echo "     CallIntent row appears with the right gclid"
echo ""
read -p "press enter to close..."
