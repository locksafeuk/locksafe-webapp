#!/bin/bash
# Hotfix: Vercel build failed due to dynamic-route collision between
# the new /locksmith/[district] landing page and the existing
# /locksmith/[id] locksmith-profile page (Next.js can't tell two
# single-segment dynamic routes apart at the same path level).
#
# Resolution: rename the landings to /locksmith-in/[district]
#   • New folder src/app/locksmith-in/[district]/ created (already on disk)
#   • All callers (orchestrator, recompose, sitemap) point at /locksmith-in
#   • Old folder src/app/locksmith/[district]/ MUST be deleted (this script)
#
# Safe to re-run if the build is already green.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Step 1/3 — Delete the conflicting old folder"
echo ""
if [ -d "src/app/locksmith/[district]" ]; then
  rm -rf "src/app/locksmith/[district]"
  echo "  ✓ Removed src/app/locksmith/[district]/"
else
  echo "  (already gone)"
fi
echo ""

echo "▶ Step 2/3 — Verify no other route conflict remains"
echo ""
find src/app/locksmith -maxdepth 1 -type d -name '[\[]*' | sort
echo ""

echo "▶ Step 3/3 — Commit + push"
echo ""
git add \
  src/app/locksmith-in/ \
  src/app/locksmith/ \
  src/lib/discovery-campaign-orchestrator.ts \
  src/lib/discovery-campaign-generator.ts \
  src/lib/postcode-keyword-generator.ts \
  src/lib/postcodes-io.ts \
  src/lib/district-landing/ \
  src/app/sitemap.ts \
  scripts/recompose-discovery-drafts.ts \
  prisma/schema.prisma
# We also remove the deleted folder explicitly in case git missed it.
git add -A src/app/locksmith/

git diff --cached --stat
echo ""

git commit -m "fix(routing): rename /locksmith/[district] to /locksmith-in/[district]

Vercel build was failing with:

  Ambiguous route pattern '/locksmith/[*]' matches multiple routes:
    - /locksmith/[district]
    - /locksmith/[id]

The existing /locksmith/[id] route is the customer-facing locksmith
profile page (ratings, reviews, contact). Next.js can't distinguish
two single-segment dynamic routes under the same parent.

Rename:
  /locksmith/[district]  →  /locksmith-in/[district]

The new URL reads naturally ('locksmith in RG1') and is a common UK
SEO pattern for hyper-local landing pages — arguably stronger than
the original.

Updated all callers:
  • discovery-campaign-orchestrator.ts  finalUrl construction
  • recompose-discovery-drafts.ts       finalUrl + dry-run preview
  • sitemap.ts                          district-pages route
  • locksmith-in/[district]/page.tsx    self-canonical + sister links + breadcrumb

No active ads point at /locksmith/{x} yet (build was failing so
nothing ever shipped), so no redirect needed. Future regenerations
will write the correct URL automatically."

git push origin main
echo ""
echo "✓ pushed — Vercel will rebuild within ~30s"
echo ""
echo "After Vercel goes green:"
echo "  1. Re-run recompose-discovery-drafts.command — it will:"
echo "       • DELETE the 6 stale drafts (now matches both old tags)"
echo "       • GENERATE landing pages at /locksmith-in/{district}"
echo "       • CREATE 6 new drafts pointing at the correct URLs"
echo "  2. Spot-check: https://locksafe.uk/locksmith-in/rg1"
read -p "press enter to close..."
