#!/bin/bash
# Phase 2b — shark-saturated SERP filter.
#
# Pure module: pull an IntelKeyword.serpDomains list + a shark flag-set
# (either Set<string> or Map<string, SharkVerdict>) and emit a saturation
# verdict per keyword. The opportunity scout uses partitionBySharkSaturation
# to drop saturated keywords before scoring/ranking.
#
# Files in this batch:
#   • src/lib/shark-saturation.ts            (NEW — analyser + helpers)
#   • src/lib/__tests__/shark-saturation.test.ts (NEW — ~21 tests)

set -e
trap 'echo ""; echo "❌ aborted"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Running Phase 2b — shark-saturation tests"
echo ""
npx jest --testPathPatterns='shark-saturation' --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Staging files"
git add \
  src/lib/shark-saturation.ts \
  src/lib/__tests__/shark-saturation.test.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase2b): shark-saturated SERP filter — demote shark-dominated keywords

The opportunity scout's protection layer against burning budget on
keywords where shark-flagged operators own the paid SERP. Cleanly
demotes those keywords so we redirect spend toward markets where
LockSafe can actually win the auction.

Two-gate logic:
  • minFlaggedCount      ≥2 flagged domains must be present
  • minSaturationRatio   ≥50% of SERP domains must be flagged

Both gates must trip. One shark on a 5-domain SERP doesn't make the
keyword saturated — it makes it competitive. Two sharks on a
3-domain SERP DOES make it saturated.

Flexible flag-source: accepts either Set<string> (just the flagged
domain names) or Map<string, SharkVerdict> (full verdicts from
scoreSharkFingerprint). The Map form lets future audit features
surface WHICH shark patterns triggered.

Wrappers:
  • analyseSharkSaturation()       — per-keyword verdict
  • annotateSharkSaturation()      — add verdict field to every kw
  • partitionBySharkSaturation()   — split into { clean, saturated }
  • filterOutSharkSaturated()      — one-shot clean-only filter

~21 unit tests cover both gates, both flag-source forms, threshold
overrides, domain deduplication across geos, and realistic SERP
scenarios (shark-dominated emergency vs trust-led MLA).

Pure module: no DB, no clock, deterministic."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
