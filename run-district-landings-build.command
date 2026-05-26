#!/bin/bash
# District Landing Pages — full build deploy.
#
# Ships in one batch:
#   • New DistrictLandingPage Prisma model + db push
#   • Fact assembler + LLM content generator + validator (all pure)
#   • ensureDistrictLandingPage orchestration (idempotent, manual-override safe)
#   • /locksmith/[district] dynamic route (SSG + 404 on no-coverage)
#   • Orchestrator wiring (campaign draft cannot ship without its page)
#   • Sitemap update (district pages + real lastModified)
#   • Stripped MLA from EVERY family of ad copy (legal honesty fix)
#   • Updated recompose curated lineup (no MLA, real outcodes only)
#   • ~50 unit tests for the validator + generator + helpers
#
# Run order:
#   1. tests (no LLM calls — all mocked)
#   2. prisma generate + db push (creates DistrictLandingPage collection)
#   3. commit + push to main

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Step 1/4 — Running tests"
echo ""
npx jest \
  --testPathPatterns='(validate-content|assemble-facts|generate-content)' \
  --no-coverage
echo ""
echo "✓ tests green"
echo ""

echo "▶ Step 2/4 — prisma generate"
echo ""
npx prisma generate
echo ""

echo "▶ Step 3/4 — prisma db push (sync DistrictLandingPage to MongoDB)"
echo "   (creates the new collection + indexes; non-destructive)"
echo ""
read -p "Type 'go' to push the schema change to MongoDB: " confirm
if [ "$confirm" != "go" ]; then
  echo "  aborted — schema NOT pushed"
  exit 1
fi
npx prisma db push
echo ""

echo "▶ Step 4/4 — Commit + push to main"
echo ""
git add \
  prisma/schema.prisma \
  src/lib/postcodes-io.ts \
  src/lib/district-landing/ \
  src/app/locksmith/\[district\]/page.tsx \
  src/lib/discovery-campaign-generator.ts \
  src/lib/discovery-campaign-orchestrator.ts \
  src/lib/postcode-keyword-generator.ts \
  src/app/sitemap.ts \
  scripts/recompose-discovery-drafts.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase4): district landing pages — honest, locally-grounded, AI-generated

The website-side answer to the campaign generator. Every covered
UK postcode district gets ONE landing page at /locksmith/{district},
grounded in REAL local facts (engineer base location, coverage
radius, nearby outcodes), wrapped in LLM-generated prose that reads
like a real local locksmith — not programmatic SEO.

Honesty audit (May 2026): LockSafe does NOT currently hold MLA,
Which? Trusted Trader, or Checkatrade accreditation. Bidding on or
claiming those would be misrepresentation under the Consumer
Protection from Unfair Trading Regulations 2008. This commit strips
every MLA claim from the codebase. Allowed trust signals: DBS-checked
(AI-verified at onboarding), Insured (AI-verified), Fixed price,
Real local engineer, 24/7 dispatch, GPS-tracked.

Architecture:
  • prisma DistrictLandingPage — cached per-district content
  • postcodes-io.ts             — nearby outcodes + anchor town
  • assemble-facts.ts           — pure: DB + postcodes.io → facts
  • validate-content.ts         — pure: banned-phrase + JSON shape
  • generate-content.ts         — LLM (Ollama-first, OpenAI fallback)
                                   with retry on banned-phrase hit
  • ensure-landing.ts           — idempotent upsert; never overwrites
                                   manual_override; 90-day regenerate
  • /locksmith/[district]       — SSG route, 404 when no coverage
                                   even if row exists (defence in depth)
  • orchestrator wiring         — cannot ship draft without page
  • sitemap                     — adds district pages + real updatedAt

Page sections:
  • Hero (real anchor town badge, district-specific headline)
  • Trust strip (3-5 verified bullets)
  • Intro paragraph (district-specific prose)
  • Coverage narrative (LockSafe brand-first, never names engineer)
  • Why-choose-us (anti-shark voice, no preaching)
  • District-specific FAQs (4-6)
  • Nearby areas (real internal links to sibling published districts)
  • Call CTA (data-call-id attributes pick up TelLinkAttribution)
  • JSON-LD (LocalBusiness + FAQPage + BreadcrumbList)

~50 unit tests covering:
  • banned-phrase scanner (MLA, Which?, Checkatrade, doorway tells)
  • missing-block detection
  • malformed JSON rejection
  • prompt builder shape (MLA forbidden, base location surfaced)
  • generator retry semantics (banned-once → succeed-on-2)
  • generator throw-on-double-fail (no garbage shipped)
  • helpers: extractBaseLocation, estimateTravelMins, NoCoverageError"

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
echo ""
echo "WHAT TO DO NEXT"
echo "──────────────"
echo "  1. Wait ~2 min for Vercel rebuild"
echo "  2. Run \`recompose-discovery-drafts.command\` — it will:"
echo "       • DELETE the 6 old drafts (with their /request URL + MLA copy)"
echo "       • GENERATE landing pages for RG1/KT13/SK4/LS1/M1/BS1 (Ollama)"
echo "       • CREATE 6 new drafts pointing at /locksmith/{district}"
echo "  3. Spot-check the first 1-2 generated pages live:"
echo "       https://locksafe.uk/locksmith/rg1"
echo "       https://locksafe.uk/locksmith/kt13"
echo "     Look for: no MLA mentions, engineer NEVER named,"
echo "     real local detail (Caversham, the Oracle, etc.),"
echo "     varied sentence rhythm, no template tells."
echo "  4. If a page reads off, edit it in admin (/admin/seo/district-landings"
echo "     coming in next phase) and set contentSource='manual_override' so"
echo "     the regenerator won't overwrite it."
read -p "press enter to close..."
