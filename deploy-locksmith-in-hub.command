#!/bin/bash
# Phase 4 polish: /locksmith-in hub index page + footer link + sitemap entry.
#
# Solves the orphan-pages problem from the SEO audit (district pages
# were only sitemap-discoverable, no internal links). Now they have:
#   • Hub at /locksmith-in listing every published district (one entry
#     point Google's crawler can use to reach all of them)
#   • Sister-district cross-links on each district page (already shipped)
#   • Footer link from every page on the site → /locksmith-in
#
# Also picks up any uncommitted previous waves of work (dynamicParams
# fix, NAME-based recompose) in case those didn't ship cleanly.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Staging files"
git add \
  src/app/locksmith-in/page.tsx \
  src/app/locksmith-in/\[district\]/page.tsx \
  src/components/layout/Footer.tsx \
  src/app/sitemap.ts \
  scripts/recompose-discovery-drafts.ts \
  scripts/diag-district-state.ts
git diff --cached --stat
echo ""

git commit -m "feat(phase4): /locksmith-in hub page — fixes orphan-pages signal

Before: the 6 DistrictLandingPage entries were only discoverable
via sitemap.xml. No public page on the site linked to them. This
is the single strongest 'low value' signal Google's crawler uses
to deprioritise indexation — and was the dominant cause of the
4% indexation rate we found in the SEO audit.

After this commit:
  1. /locksmith-in is a public hub page listing every published
     district, grouped by UK region (London, South East, North West,
     etc.), with ItemList + BreadcrumbList JSON-LD.
  2. Footer 'Find a Local Locksmith' link appears on every page on
     the site, pointing at the hub. Internal-link surface area for
     the district pages goes from 0 → site-wide.
  3. Sitemap entry for /locksmith-in at priority 0.9 (same as the
     individual district pages — the hub IS the entry point).
  4. Hub revalidates hourly so new DistrictLandingPage rows surface
     within 60min without a deploy.

Combined with the dynamicParams=true fix on the district pages,
the per-district landings should now flip from 'Discovered — not
indexed' to actually-indexed within the next crawl cycle.

Also bundles:
  • scripts/recompose-discovery-drafts.ts — NAME-based deletion
    filter so re-runs reliably clean up stale drafts regardless of
    what aiPrompt tag previous runs used.
  • scripts/diag-district-state.ts — operational diagnostic for
    inspecting DistrictLandingPage rows + coverage + draft URLs."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
echo ""
echo "After Vercel goes green, check:"
echo "  • https://locksafe.uk/locksmith-in        — hub renders, shows 6 districts"
echo "  • https://locksafe.uk/locksmith-in/rg1    — district page renders"
echo "  • Footer on any page → 'Find a Local Locksmith' link works"
read -p "press enter to close..."
