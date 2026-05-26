#!/bin/bash
# DRY-RUN preview of the opening 6 discovery campaigns.
# Reads from MongoDB (KeywordSeed + GoogleAdsAccount), runs the full
# Phase 2 pipeline, prints a review table. NOTHING IS WRITTEN.
#
# Use this BEFORE running launch-discovery-campaigns-LIVE.command.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

node_modules/.bin/ts-node \
  --transpile-only \
  -r tsconfig-paths/register \
  --project scripts/tsconfig.scripts.json \
  scripts/launch-discovery-campaigns.ts

echo ""
read -p "press enter to close..."
