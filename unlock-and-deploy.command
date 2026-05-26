#!/bin/bash
# Removes the stale .git/index.lock (left behind when a git process
# crashes), then re-runs deploy.command.
# One-shot use — safe to delete once main deploy is clean.

set -e
cd "$(dirname "$0")"

LOCK=".git/index.lock"
if [ -f "$LOCK" ]; then
  echo "→ removing stale $LOCK ($(ls -la "$LOCK" | awk '{print $6, $7, $8}'))"
  rm -f "$LOCK"
  echo "  done"
else
  echo "→ no lock file (already clean)"
fi

echo ""
echo "→ re-running deploy.command..."
echo ""
exec "./deploy.command"
