#!/bin/bash
# Populate the KeywordSeed bank from LocksmithCoverage.
# Step 1 of 2 is a dry-run. Step 2 prompts for confirmation before writing.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

TSNODE="node_modules/.bin/ts-node --transpile-only -r tsconfig-paths/register --project scripts/tsconfig.scripts.json"

echo ""
echo "▶ Step 1 of 2 — DRY RUN (preview)"
echo ""
$TSNODE scripts/run-postcode-keyword-generator.ts

echo ""
echo "▶ Step 2 of 2 — confirm before writing"
echo ""
read -p "Type 'go' to write these seeds to the bank: " confirm
if [ "$confirm" != "go" ]; then
  echo "  aborted by user"
  exit 1
fi
echo ""

$TSNODE scripts/run-postcode-keyword-generator.ts --live

echo ""
read -p "press enter to close..."
