#!/bin/bash
# Definitive diagnostic for the /locksmith-in routing mystery.
#
# Does a CLEAN local Next.js build and dumps the resulting route
# manifest. If /locksmith-in/[district] is in the manifest locally,
# the issue is Vercel-side. If it's NOT in the manifest even
# locally, the issue is with the files or config.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Step 1 — Confirm files exist on disk"
echo ""
ls -la "src/app/locksmith-in/" "src/app/locksmith-in/[district]/" 2>&1
echo ""

echo "▶ Step 2 — Confirm files in git"
echo ""
git ls-files "src/app/locksmith-in/" 2>&1
echo ""

echo "▶ Step 3 — Clean .next + clean build (this may take 2-5 minutes)"
echo ""
rm -rf .next
npm run build 2>&1 | tail -80
echo ""

echo "▶ Step 4 — Search build output for locksmith-in routes"
echo ""
if [ -f .next/routes-manifest.json ]; then
  echo "DYNAMIC routes containing 'locksmith':"
  jq '.dynamicRoutes | map(select(.page | contains("locksmith"))) | map(.page)' .next/routes-manifest.json 2>&1 | head -30
  echo ""
  echo "STATIC routes containing 'locksmith':"
  jq '.staticRoutes | map(select(.page | contains("locksmith"))) | map(.page)' .next/routes-manifest.json 2>&1 | head -30
else
  echo "✗ No routes-manifest.json — build failed?"
fi
echo ""

echo "▶ Step 5 — Look in app-paths-manifest (Next.js 13+ App Router routes)"
if [ -f .next/server/app-paths-manifest.json ]; then
  grep -oE '"[^"]*locksmith[^"]*"' .next/server/app-paths-manifest.json | sort -u
else
  echo "no app-paths-manifest"
fi

echo ""
echo "──────────────────────────────────────────────────────────────"
echo "INTERPRETATION"
echo "──────────────────────────────────────────────────────────────"
echo ""
echo "If you see /locksmith-in OR /locksmith-in/[district] in the output above:"
echo "  → Next.js is registering the route locally. The issue is Vercel-specific."
echo "  → Likely cause: stale Vercel build cache. Fix: redeploy with"
echo "    \"Use existing Build Cache\" UNCHECKED from the dashboard."
echo ""
echo "If you DON'T see /locksmith-in in any list:"
echo "  → Next.js is silently skipping the folder."
echo "  → Likely cause: an error in one of the page.tsx files at build"
echo "    time, OR a config that excludes the path."
echo ""
read -p "press enter to close..."
