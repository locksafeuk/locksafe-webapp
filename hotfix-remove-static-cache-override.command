#!/bin/bash
# THE FIX we should have done at the start of this debugging session.
#
# Vercel warned at build time:
#   "Custom Cache-Control headers detected for the following routes:
#     - /_next/static/:path*
#    Setting a custom Cache-Control header can break Next.js
#    development behavior."
#
# We set it aside to fix the more urgent route-collision error. But
# THIS warning was the root cause of /locksmith-in/* serving stuck
# 404s across multiple deploys + force-dynamic. Overriding the
# Cache-Control header that Next.js sets natively confuses Vercel's
# edge cache eviction logic — new routes inherit the immutable cache
# rules from the static asset path, and 404s for those routes get
# pinned in the edge cache regardless of redeploys.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

git add next.config.js
git diff --cached --stat
echo ""

git commit -m "fix(routing): remove /_next/static custom Cache-Control override

Vercel's build was emitting this warning since at least Phase 4:

  Warning: Custom Cache-Control headers detected for the following routes:
    - /_next/static/:path*
  Setting a custom Cache-Control header can break Next.js development behavior.

Next.js 16 already sets 'public, max-age=31536000, immutable' on
its own static assets in production. Overriding it from
next.config.js confused Vercel's edge cache eviction such that
newly-deployed dynamic routes (e.g. /locksmith-in/[district]) had
their 404 responses pinned indefinitely — surviving deployments,
force-dynamic flags, and manual cache busters.

Removing the override lets Vercel's native cache handling take
over. After this deploys, /locksmith-in/* should resolve to the
correct route on the next request."

git push origin main
echo ""
echo "✓ pushed — Vercel rebuilds, takes ~2-3 min"
echo ""
echo "When green, run:"
echo "  curl -sI https://www.locksafe.uk/locksmith-in/rg1 | grep -iE '^(HTTP|x-matched-path|x-vercel-cache):'"
echo ""
echo "Expected:"
echo "  HTTP/2 200"
echo "  x-matched-path: /locksmith-in/[district]"
echo "  x-vercel-cache: MISS  (first hit; HIT on subsequent within revalidate window)"
read -p "press enter to close..."
