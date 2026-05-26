#!/bin/bash
# Reconcile drift between Locksafe's GoogleAdsCampaignDraft.status and
# the live state of each campaign on Google Ads (via GAQL). Read-only —
# reports drift, does NOT mutate either side.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

node_modules/.bin/ts-node \
  --transpile-only \
  --project scripts/tsconfig.scripts.json \
  scripts/reconcile-campaign-drift.ts

echo ""
read -p "press enter to close..."
