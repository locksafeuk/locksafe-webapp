#!/bin/bash
# LIVE WRITE — creates GoogleAdsCampaignDraft rows in MongoDB.
# Drafts land with status=PENDING_APPROVAL. A human still has to click
# Publish in the admin UI before any spend happens.
#
# Idempotent: re-running never double-creates a draft (skips on name match).
#
# ‼ Always run `review-discovery-campaigns.command` first.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

echo ""
echo "⚠  This will WRITE draft campaigns to the database."
echo "   Drafts open as PENDING_APPROVAL — a human still publishes them."
echo ""
read -p "Type 'go' to proceed (anything else aborts): " confirm
if [ "$confirm" != "go" ]; then
  echo "  aborted by user"
  exit 1
fi
echo ""

node_modules/.bin/ts-node \
  --transpile-only \
  -r tsconfig-paths/register \
  --project scripts/tsconfig.scripts.json \
  scripts/launch-discovery-campaigns.ts --live

echo ""
read -p "press enter to close..."
