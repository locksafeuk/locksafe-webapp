#!/bin/bash
# Phase 3a — locksmith recruitment recommender.
# Runs the tests, then commits and pushes.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Running Phase 3a tests"
echo ""
npx jest --testPathPatterns='locksmith-recruitment-recommender' --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Staging Phase 3a files"
git add \
  src/lib/uk-outcodes-reference.ts \
  src/lib/locksmith-recruitment-recommender.ts \
  src/lib/__tests__/locksmith-recruitment-recommender.test.ts \
  scripts/run-recruitment-recommender.ts \
  recommend-recruitment.command
git diff --cached --stat
echo ""

git commit -m "feat(phase3a): locksmith recruitment recommender

Pure scorer that ranks uncovered UK outcodes by recruitment priority.
Read-only — produces a ranked table for ops review, no DB writes.

Score composition (max 100):
  • demandScore         0-40  log(population) — log curve avoids
                              over-weighting larger settlements
  • sharkPressureBoost  0-25  high shark density + high CPC = LockSafe
                              undercuts on honesty
  • regionBoost         0-20  commuter_belt + london highest, NI lowest
  • flips new_hire → radius_extend when an existing locksmith is
    within 12mi of the uncovered outcode centroid (5-point penalty
    to prevent quick radius-extends from masking real coverage gaps)

UK_OUTCODES reference: ~80 curated outcodes with population + lat/lng
+ region tag. Covers locksmith-relevant markets: Birmingham, Bristol,
Cambridge, Cardiff, Edinburgh, Glasgow, Hull, Leeds, Liverpool,
London, Manchester, Newcastle, Oxford, Reading, Sheffield, Surrey
commuter belt, and more.

Output: ranked table with action (new_hire | radius_extend) and
audit-friendly reasons. For radius_extend rows the recommender names
the closest locksmith + distance so ops can ping them directly.

Runner + .command file:
  ./recommend-recruitment.command
  ./recommend-recruitment.command -- --region=midlands --limit=5

~30 unit tests cover scoring components, haversine distance, coverage
filter, region filter, new_hire vs radius_extend flip, limit,
deterministic sort, and reference-data integrity (every outcode has
valid UK lat/lng bounds, population > 0, unique outcode strings)."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
