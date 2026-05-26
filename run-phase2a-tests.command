#!/bin/bash
# Phase 2a — run the new unit tests locally, then commit + push if green.
#
# What's in this batch:
#   • src/lib/shark-domains.ts            (already present)
#   • src/lib/postcode-keyword-generator.ts (typed family via SeedCategory)
#   • src/lib/competitor-cross-validate.ts (extended SYNONYM_GROUPS with
#                                           anti-shark trust clusters)
#   • src/agents/core/seed-bank.ts        (exports SeedCategory + adds
#                                           postcode_local/service_long_tail/
#                                           trust_signal/b2b_specialist/
#                                           research_intent families)
#   • jest.config.ts                      (Jest 30 fix: absolute path to ts-jest
#                                           via createRequire — the bare string
#                                           "ts-jest" stopped resolving in 30)
#   • src/lib/__tests__/shark-domains.test.ts            (NEW — ~14 tests)
#   • src/lib/__tests__/postcode-keyword-generator.test.ts (NEW — ~15 tests)
#   • src/lib/__tests__/competitor-cross-validate.test.ts (extended —
#                                                          +12 trust-cluster tests)
#
# Run with double-click from Finder, or `./run-phase2a-tests.command` from a
# terminal. The script exits early if any test fails — push only happens
# when the suite is green.

set -e
trap 'echo ""; echo "❌ aborted"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Running Phase 2a unit tests"
echo ""
npx jest \
  --testPathPatterns='(shark-domains|postcode-keyword-generator|competitor-cross-validate)' \
  --no-coverage
echo ""
echo "✓ all Phase 2a tests passing"
echo ""

echo "▶ Staging files"
git add \
  src/lib/shark-domains.ts \
  src/lib/postcode-keyword-generator.ts \
  src/lib/competitor-cross-validate.ts \
  src/agents/core/seed-bank.ts \
  src/lib/__tests__/shark-domains.test.ts \
  src/lib/__tests__/postcode-keyword-generator.test.ts \
  src/lib/__tests__/competitor-cross-validate.test.ts \
  jest.config.ts \
  prisma/schema.prisma
git diff --cached --stat
echo ""

git commit -m "feat(phase2a): discovery foundations — shark heuristic, postcode generator, trust-cluster synonyms

Adds the building blocks the CMO opportunity scout needs to surface the
'cheap tricky keywords' universe — hyper-local + trust-signal + b2b
queries that the national-PPC sharks structurally ignore.

• shark-domains.ts: pure scoreSharkFingerprint() heuristic. Combines
  competitor-fingerprint signals (no MLA, no DBS, claims nationwide,
  bait pricing, active PPC) into a 0-1 confidence score. Trust badges
  actively subtract. Threshold 0.6 → shouldFlag.

• postcode-keyword-generator.ts: builds the (district × service)
  universe across 4 families (postcode_local, service_long_tail,
  trust_signal, b2b_specialist). Gates on LocksmithCoverage by default
  so we never seed a keyword we can't fulfil. Idempotent via addSeed.

• seed-bank.ts: exposes SeedCategory union and extends it with the
  Phase 2a families so the generator stays type-safe end-to-end.

• competitor-cross-validate.ts: extends SYNONYM_GROUPS with six
  trust-signal clusters (honest, MLA, DBS, fixed-price, no-callout,
  local). Clusters intentionally stay independent — 'mla' does NOT
  match a page that only says 'honest', so intel surface tells the
  difference between trust attributes.

• jest.config.ts: Jest 30 resolves transform modules by absolute path
  only — bare 'ts-jest' string fails with 'Module ts-jest in the
  transform option was not found'. Use createRequire to resolve from
  the config file (which Jest 30 loads under ESM).

• ~41 new unit tests covering the heuristic, generator, and synonym
  expansion. All green locally."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
