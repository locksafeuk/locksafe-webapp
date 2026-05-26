#!/bin/bash
# Phase 2c — discovery campaign orchestrator (final wire-up).
#
# This is the orchestrator that pulls everything together:
#   1. Reads KeywordSeed rows (active only)
#   2. Optionally drops shark-saturated keywords
#   3. Scores each via phoneLeadIntentScore
#   4. Sorts by score descending
#   5. Applies per-family quota (default: 4 postcode + 1 trust + 1 b2b = 6)
#   6. Builds drafts via the pure generator
#   7. Writes them to prisma.googleAdsCampaignDraft — idempotent by name
#
# Files in this batch:
#   • src/lib/discovery-campaign-orchestrator.ts            (NEW — DB layer)
#   • src/lib/__tests__/discovery-campaign-orchestrator.test.ts (NEW — ~17 tests)

set -e
trap 'echo ""; echo "❌ aborted"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Running Phase 2c — discovery-campaign-orchestrator tests"
echo ""
npx jest --testPathPatterns='discovery-campaign-orchestrator' --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Staging files"
git add \
  src/lib/discovery-campaign-orchestrator.ts \
  src/lib/__tests__/discovery-campaign-orchestrator.test.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase2c): discovery campaign orchestrator — KeywordSeed → drafts

Thin DB layer that wires the Phase 2 stack into actual
GoogleAdsCampaignDraft rows. The pure generator does the heavy work
(family copy, caps, audit); this file does the pulls, the sorting,
the family quota, and the writes.

Pipeline:
  1. pull active KeywordSeed rows
  2. optionally drop shark-saturated (when IntelKeywords + flag-source
     are passed alongside)
  3. score each via phoneLeadIntentScore
  4. sort by score desc, stable on keyword
  5. apply per-family quota — default mix sums to 6:
       postcode_local 4   trust_signal 1   b2b_specialist 1
       service_long_tail 0   research_intent 0   negative 0
  6. build draft payload via buildDiscoveryCampaignDraft
  7. write to prisma — idempotent (skip if a draft with this name
     already exists on the same accountId)

dryRun mode: zero side effects, full audit list returned for ops review
before the first real run.

~17 tests cover the quota selector (pure), idempotent writes, dryRun,
error capture, missing-accountId guards, active-only query filter,
and shark-saturation gating with realistic IntelKeyword fixtures.

This closes Phase 2c. Next: launch the first 6 campaigns + monitor."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
