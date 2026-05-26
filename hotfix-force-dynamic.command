#!/bin/bash
# Definitive hotfix: force-dynamic on /locksmith-in routes.
# Removes generateStaticParams (whose build-time Prisma calls were
# excluding the route from the manifest), replaces with
# dynamic = "force-dynamic" + revalidate = 3600.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

git add \
  src/app/locksmith-in/page.tsx \
  src/app/locksmith-in/\[district\]/page.tsx
git diff --cached --stat
echo ""

git commit -m "fix(district-landings): force-dynamic to guarantee route registration

The /locksmith-in/[district] route was being excluded from the
Vercel build manifest entirely — proven by curl showing
\`x-matched-path: /locksmith-city/[city]/[area]\` for every request
to /locksmith-in/*. Local routes-manifest.json confirmed only
/locksmith-area/[slug], /locksmith-area/[slug]/[service],
/locksmith-city/[city] and /locksmith-city/[city]/[area] were
registered as dynamic routes under the locksmith-* parent.

Root cause: generateStaticParams was calling Prisma at build time.
On the first deploys of this feature the DistrictLandingPage table
didn't exist (db push had run locally but the cached Vercel build
didn't see the new model in the generated client). When
generateStaticParams threw, Next silently excluded the entire route
from the manifest rather than failing the build.

Fix: drop generateStaticParams entirely. Set dynamic='force-dynamic'
so the route is unconditionally registered. revalidate=3600 caches
each rendered page at the edge for 1 hour — still cheap given the
small number of districts (~80 max foreseeable). notFound() inside
the page handler stays as the coverage gate.

After this deploy:
  curl -sI https://www.locksafe.uk/locksmith-in/rg1
should return HTTP/2 200 with x-matched-path: /locksmith-in/[district]."

git push origin main
echo ""
echo "✓ pushed — Vercel rebuilds, takes ~2-3 min"
echo ""
echo "When green, run:"
echo "  curl -sI https://www.locksafe.uk/locksmith-in/rg1 | grep -iE '^(HTTP|x-matched-path):'"
echo ""
echo "Expected:"
echo "  HTTP/2 200"
echo "  x-matched-path: /locksmith-in/[district]"
read -p "press enter to close..."
