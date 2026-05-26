#!/bin/bash
# Phase 3b — final two pieces:
#   1. Global tel: click listener (TelLinkAttribution) — closes the
#      website side of the attribution loop without touching the 34
#      tel: anchors scattered across marketing pages
#   2. End-to-end conversion loop test — proves the user's exact ask:
#      gclid → CallIntent → matched call → call-led job → Stripe paid
#      → uploadClickConversion(gclid) fires with the right Google ID

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Running listener + end-to-end conversion-loop tests"
echo ""
npx jest \
  --testPathPatterns='(TelLinkAttribution|conversion-loop-e2e)' \
  --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Staging files"
git add \
  src/components/marketing/TelLinkAttribution.tsx \
  src/components/marketing/__tests__/TelLinkAttribution.test.tsx \
  src/components/marketing/index.ts \
  src/app/ClientBody.tsx \
  src/lib/__tests__/conversion-loop-e2e.test.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase3b): global tel: listener + end-to-end conversion-loop test

Closes Phase 3b — the per-call attribution loop is now FULLY WIRED
on both ends, and pinned by a comprehensive integration test.

TelLinkAttribution
──────────────────
One capture-phase listener at the root layout intercepts every
<a href=\"tel:...\"> click anywhere on the site. Walks the click
target up to the nearest anchor, checks the href is tel: (case-
insensitive), walks the ancestor chain for data-call-id (or
anchor.id) as the CTA label, fires recordCallIntent(). Never
preventDefault — browser opens the dialler natively.

Means every existing tel: anchor (34 across sections/CTA, Pricing,
request page, help page, city pages, blog templates) captures gclid
+ UTMs without any per-component edits. Optional later: tag CTAs
with data-call-id=\"hero\" / \"sticky-footer\" etc. for finer
attribution reporting.

End-to-End Test
───────────────
Walks the WHOLE chain in one test:

  Step 1  Stages a CallIntent with the test gclid
  Step 2  Runs matchInboundCall — proves visitor_scoped match wins,
          asserts the atomic updateMany predicate
  Step 3  Stages Job (gclid=null, call-led, £235 paid),
          VoiceCall (jobId set), CallIntent (retellCallId stamped)
  Step 4  Runs uploadJobConversionIfEligible
  Step 5  Asserts uploadClickConversion called with:
            • the CallIntent's gclid (NOT the null Job.gclid)
            • the correct conversionAction resource
            • £235 conversion value in GBP
            • the Job.jobNumber as orderId for idempotency
  Step 6  Asserts BOTH Job + CallIntent get stamped with
          conversionUploadStatus=\"uploaded\"

Plus negative cases:
  • no gclid anywhere → skipped_no_gclid (no upload)
  • CallIntent exists but no gclid → skipped_no_gclid
  • already uploaded → skipped_already_uploaded (idempotency)
  • Google API error → failed status persisted for retry cron
  • web-form-led Job (Job.gclid present) → uses that directly,
    does NOT fall through to VoiceCall/CallIntent

Aligns with the user's Google Ads goal setup:
  Primary:    Locksafe Job Completed (UPLOAD_CLICKS)
  Secondary:  Phone calls, Contact, Request quote
→ Google Ads now optimises bidding for clicks that produce paid
  jobs, not just clicks that produce phone calls."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
echo ""
echo "Phase 3b is now COMPLETE end-to-end:"
echo "  ✓ CallIntent model live in MongoDB"
echo "  ✓ /api/marketing/call-intent endpoint deployed"
echo "  ✓ Retell webhook → matchInboundCall hook"
echo "  ✓ Stripe → uploadJobConversionIfEligible → CallIntent fall-through"
echo "  ✓ Global tel: listener mounted at root layout"
echo "  ✓ End-to-end test proves the loop closes"
read -p "press enter to close..."
