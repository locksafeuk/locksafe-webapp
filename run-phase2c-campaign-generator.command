#!/bin/bash
# Phase 2c — discovery campaign generator.
#
# Pure draft builder. Takes a ranked candidate from the Phase 2b pipeline
# and produces a prisma-ready GoogleAdsCampaignDraft payload, complete
# with family-specific ad copy, keyword variants, negative keywords,
# and per-family budget caps.
#
# The orchestrator that selects top-N candidates + writes to the DB is
# out of scope for this file — it'll be its own thin module so this
# builder stays 100% unit-testable.
#
# Files in this batch:
#   • src/lib/discovery-campaign-generator.ts          (NEW — pure builder)
#   • src/lib/__tests__/discovery-campaign-generator.test.ts (NEW — ~35 tests)

set -e
trap 'echo ""; echo "❌ aborted"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Running Phase 2c — discovery-campaign-generator tests"
echo ""
npx jest --testPathPatterns='discovery-campaign-generator' --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Staging files"
git add \
  src/lib/discovery-campaign-generator.ts \
  src/lib/__tests__/discovery-campaign-generator.test.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase2c): discovery campaign generator — pure draft builder

Integrates the Phase 2 stack into a single function that produces
prisma-ready GoogleAdsCampaignDraft payloads:

  • Family-specific ad copy (postcode_local / trust_signal /
    service_long_tail / b2b_specialist / research_intent) with safe
    {district} substitution + 30/90 char clipping for RSA limits
  • Keyword variants — original phrase (PHRASE) + district-first
    (EXACT) when a UK outcode is detected
  • Negative keywords — 28-entry industry baseline + family extras
    (b2b adds residential/house/domestic, service adds second-hand/used)
  • Budget cap enforcement via family-budget-caps
  • CPC ceiling enforcement
  • aiReasoning carries phoneLeadIntentScore + cap audit for log review
  • Deterministic name: 'LockSafe · {FamilyShort} · {District|UK}'

PURE module — no DB, no clock. The orchestrator that pulls KeywordSeed
rows, ranks them by phoneLeadIntent, filters via shark-saturation, and
calls prisma.googleAdsCampaignDraft.create() will be its own thin file.

~35 unit tests cover headline length limits, substitution, family copy
selection, fallback for unknown families, negative dedup + alphabetisation,
budget + CPC capping, audit field surfacing, status overrides,
determinism, and a smoke test across every family."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
