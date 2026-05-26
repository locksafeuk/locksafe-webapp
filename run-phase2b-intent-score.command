#!/bin/bash
# Phase 2b — phoneLeadIntentScore.
#
# Ships the central ranking metric for the keyword discovery engine.
# Same structure as the Phase 2a runner: run new tests locally, exit on
# any failure, commit + push only when green.
#
# Files in this batch:
#   • src/lib/phone-lead-intent-score.ts            (NEW — pure scorer)
#   • src/lib/__tests__/phone-lead-intent-score.test.ts (NEW — ~30 tests)

set -e
trap 'echo ""; echo "❌ aborted"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Running Phase 2b — phone-lead-intent-score tests"
echo ""
npx jest --testPathPatterns='phone-lead-intent-score' --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Staging files"
git add \
  src/lib/phone-lead-intent-score.ts \
  src/lib/__tests__/phone-lead-intent-score.test.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase2b): phoneLeadIntentScore — central phone-call ranking metric

The CMO opportunity scout needs ONE number to rank candidate keywords
by phone-call propensity. This is it: a pure 0-100 composite of four
auditable components.

Composition (max 100):
  • familyWeight       0-30  postcode_local highest, negative=0
  • tokenIntent        0-35  emergency/24-hour/locked-out boost,
                              DIY/research subtracts
  • geoSpecificity     0-20  postcode district > city > 'near me'
  • historicalWinRate  0-15  Wilson-shrunk so brand-new seeds sit at
                              the neutral midpoint until they earn it

Every adjustment carries a 'reason' string for the audit trail —
ops can ask 'why did this keyword rank above that?' and get a
human-readable breakdown without re-running the math.

Determinism: pure function, no clock, no DB, no random.

~30 tests pin the contract: family ordering, cluster non-double-counting,
postcode-beats-city precedence, score clamping, deterministic output."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
