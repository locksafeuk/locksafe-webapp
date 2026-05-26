#!/bin/bash
# Phase 2b — per-family budget caps.
#
# Pure config + helpers + planner. No DB writes. Tested in isolation.
#
# Files in this batch:
#   • src/lib/family-budget-caps.ts            (NEW — caps + planner)
#   • src/lib/__tests__/family-budget-caps.test.ts (NEW — ~22 tests)

set -e
trap 'echo ""; echo "❌ aborted"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Running Phase 2b — family-budget-caps tests"
echo ""
npx jest --testPathPatterns='family-budget-caps' --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Staging files"
git add \
  src/lib/family-budget-caps.ts \
  src/lib/__tests__/family-budget-caps.test.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase2b): per-family budget caps + allocation planner

Spending guardrail for the keyword discovery engine. Each family gets:
  • dailyBudgetGbp — max daily spend per campaign in this family
  • maxCpcGbp      — max bid ceiling (anti-overpay safeguard)
  • enabled        — hard switch (default false for 'negative' family)

Defaults sized for the opening £500-£2k/week budget:
  • postcode_local       £30/day  £3.50 CPC ceiling
  • trust_signal         £20/day  £2.80
  • b2b_specialist       £15/day  £3.00
  • service_long_tail    £15/day  £2.00
  • competitor           £15/day  £2.50
  • baseline / learned   £12/day  £2.00
  • experimental         £8/day   £1.50
  • research_intent      £5/day   £0.80
  • negative             £0/day   disabled

Ops can override any value via FAMILY_CAP_<FAMILY>_<FIELD> env vars
without a code deploy. Garbage values fall back to defaults — typos
never crash the scout.

planFamilyBudgetSplit() distributes a total daily budget across N
planned campaigns, respecting per-family caps. Returns a surplus
when caps absorb everything (e.g. £100 ask split across 2
research_intent campaigns → £10 allocated, £90 surplus).

~22 unit tests cover defaults, env overrides (including garbage
input), clamping in both directions, planner invariants, and
determinism."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
