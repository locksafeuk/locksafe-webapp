#!/bin/bash
# Locksmith Recruitment Recommender — print the top 20 uncovered UK
# outcodes worth pursuing, with audit-friendly reasons for each.
# Read-only — does not write to the database.
#
# Optional CLI args (passed after --):
#   --region=commuter_belt,london    restrict by region
#   --limit=10                       limit results
#
# Example: ./recommend-recruitment.command -- --region=midlands --limit=5

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

# Strip the leading "--" sentinel macOS Finder passes when arguments
# are supplied via Get Info → Open With (rare; safe no-op if absent)
if [ "$1" = "--" ]; then shift; fi

node_modules/.bin/ts-node \
  --transpile-only \
  -r tsconfig-paths/register \
  --project scripts/tsconfig.scripts.json \
  scripts/run-recruitment-recommender.ts "$@"

echo ""
read -p "press enter to close..."
