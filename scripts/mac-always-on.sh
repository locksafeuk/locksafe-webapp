#!/usr/bin/env bash
# Mac Ultra Always-On Hardening for local Hermes/Ollama agent.
# Apply with: sudo ./scripts/mac-always-on.sh
# Rollback with: sudo ./scripts/restore-normal-sleep.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run with sudo."
  exit 1
fi

echo "Applying always-on AC power policy..."
pmset -c sleep 0
pmset -c disksleep 0
pmset -c displaysleep 30
pmset -c autorestart 1
pmset -c networkoversleep 0
pmset -c powernap 1
pmset -c womp 1
pmset -c tcpkeepalive 1

echo ""
echo "✅ Always-on settings applied. Current state:"
pmset -g | grep -E "sleep|autorestart|powernap|womp|networkoversleep|tcpkeepalive"
