#!/bin/bash
# Recompose the opening 6 discovery drafts with a curated, diverse lineup.
#
# Step 1 of 2 is a dry-run: shows what would be deleted + what would be
# created. Step 2 prompts for confirmation before any DB writes happen.
#
# Safety:
#   • Only touches drafts with aiPrompt = "discovery-orchestrator:phase2c"
#     (i.e. the ones our launcher created — never your hand-built drafts)
#   • Only deletes DRAFT / PENDING_APPROVAL — never touches PUBLISHED
#   • Idempotent on the create side

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

TSNODE="node_modules/.bin/ts-node --transpile-only -r tsconfig-paths/register --project scripts/tsconfig.scripts.json"

echo ""
echo "▶ Step 1 of 2 — DRY RUN (preview deletions + new drafts)"
echo ""
$TSNODE scripts/recompose-discovery-drafts.ts

echo ""
echo "▶ Step 2 of 2 — confirm before deleting + creating"
echo ""
read -p "Type 'go' to delete the old drafts and create the new ones: " confirm
if [ "$confirm" != "go" ]; then
  echo "  aborted by user — nothing changed"
  exit 1
fi
echo ""

$TSNODE scripts/recompose-discovery-drafts.ts --live

echo ""
read -p "press enter to close..."
