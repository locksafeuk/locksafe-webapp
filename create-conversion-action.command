#!/bin/bash
# Create the LockSafe Job Completed conversion action via Google Ads API,
# bypassing the wizard UI. Uses OAuth tokens already in the database.
# Prints the resource name to paste into Vercel.

set -e
trap 'echo ""; echo "❌ failed at line $LINENO"; read -p "press enter to close..."; exit 1' ERR

cd "$(dirname "$0")"

echo ""
echo "Creating 'LockSafe Job Completed' conversion action via Google Ads API..."
echo ""

node_modules/.bin/ts-node \
  -r tsconfig-paths/register \
  --project tsconfig.scripts.json \
  scripts/create-google-ads-conversion-action.ts

echo ""
read -p "press enter to close..."
