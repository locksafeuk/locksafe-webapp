#!/usr/bin/env bash
# Rollback Mac Ultra power settings to normal defaults.
# Apply with: sudo ./scripts/restore-normal-sleep.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run with sudo."
  exit 1
fi

echo "Restoring normal power policy..."
pmset -c sleep 1
pmset -c disksleep 10
pmset -c displaysleep 10
pmset -c autorestart 0
pmset -c networkoversleep 0
pmset -c powernap 1
pmset -c womp 1

echo ""
echo "✅ Normal settings restored. Current state:"
pmset -g | grep -E "sleep|autorestart|powernap|womp|networkoversleep"
