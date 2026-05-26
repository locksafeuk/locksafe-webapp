#!/bin/bash
# Content audit for every DistrictLandingPage row.
# Checks: no MLA/Master Locksmiths/Which?/Checkatrade mentions,
# engineer never named, anchorTown surfaced, ≥2 nearby outcodes
# named, district-specific FAQs, varied sentence rhythm.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

# Note: paths alias `@/*` is registered programmatically inside the script
# (mirroring scripts/diag-district-state.ts), so we do NOT pass
# `-r tsconfig-paths/register` here — that flag reads from
# scripts/tsconfig.scripts.json which has no baseUrl and emits a warning.
node_modules/.bin/ts-node \
  --transpile-only \
  --project scripts/tsconfig.scripts.json \
  scripts/audit-district-content.ts

echo ""
read -p "press enter to close..."
