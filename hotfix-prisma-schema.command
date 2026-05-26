#!/bin/bash
# Hotfix: push only the prisma schema fix to unblock Vercel.
#
# The earlier CallIntent model was added with /** */ block comments,
# which Prisma's schema language rejects (only // and /// are valid).
# This pushes the schema with the comment style corrected to /// — no
# other changes, no DB push, just shut up Vercel's build error.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo "▶ Hotfix: pushing prisma/schema.prisma with /// comment fix"
echo ""

git add prisma/schema.prisma
git diff --cached --stat
echo ""

git commit -m "fix(schema): use /// doc comments on CallIntent model (was /** */)

Prisma schema language only supports // and /// — block comments
(/** */) trigger P1012 'This line is invalid' on prisma generate.
The Vercel build fails on the same error because next build runs
prisma generate as part of the pipeline.

Switching CallIntent's doc block from /** */ to /// resolves the
validation error. Behaviour unchanged — /// comments are preserved
into the generated client just like /** */ would have been if it
were valid."

git push origin main
echo ""
echo "✓ pushed — Vercel should rebuild cleanly now"
echo ""
echo "Note: this only fixes the schema. The full Phase 3b deploy"
echo "(tests + db push + commit) is still pending — run"
echo "run-phase3b-tests-and-deploy.command once test fixes are verified."
read -p "press enter to close..."
