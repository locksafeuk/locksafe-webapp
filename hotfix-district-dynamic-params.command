#!/bin/bash
# Hotfix: /locksmith-in/rg1 was returning 404 because Next.js App Router
# defaults to dynamicParams = false. When Vercel built the site, the
# DistrictLandingPage table was empty (rows generated AFTER the build),
# so generateStaticParams returned no slugs → any /locksmith-in/* path
# 404s until the next full deploy.
#
# Fix: add `export const dynamicParams = true` + `export const revalidate = 3600`
# to the page. Now districts created after deploy render on-demand via
# ISR, and admin edits show up within an hour.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

git add src/app/locksmith-in/\[district\]/page.tsx scripts/recompose-discovery-drafts.ts
git diff --cached --stat
echo ""

git commit -m "fix(district-landings): dynamicParams=true so post-deploy districts render

The /locksmith-in/[district] route was returning 404 for every
district because Next.js App Router defaults to dynamicParams=false
on routes with generateStaticParams. When Vercel built the site,
the DistrictLandingPage table was empty (rows were generated AFTER
the build, by the recompose script's ensureOrSkip calls), so the
static-params list was empty and every request 404'd.

Adding dynamicParams=true lets unrecognised slugs render on-demand
via ISR. Inside the page we still call notFound() when the DB row
is missing or coverage is paused, so the route stays gated on real
coverage — just no longer requires a full Vercel rebuild to expose
new districts.

Also added revalidate=3600 so admin edits to a landing page
(contentSource=manual_override) propagate within 60 minutes.

Also includes recompose-discovery-drafts.ts NAME-based deletion
filter (previous tag-based filter couldn't catch drafts written
with newer aiPrompt tags, leaving stale rows uncleaned)."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys (~30s)"
echo ""
echo "Once Vercel is green, hit https://locksafe.uk/locksmith-in/rg1"
echo "and re-run recompose-discovery-drafts.command to refresh the"
echo "draft URLs at the same time."
read -p "press enter to close..."
