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

# --- Ollama remote-access env (required for Tailscale Funnel access from Vercel) ---
# These survive across launchd-managed app launches but NOT reboots; the LaunchAgent
# below makes them survive reboot.
echo ""
echo "Configuring Ollama for Tailscale Funnel access..."
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
launchctl setenv OLLAMA_ORIGINS "*"

PLIST="/Library/LaunchDaemons/uk.locksafe.ollama-env.plist"
cat > "$PLIST" <<'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>uk.locksafe.ollama-env</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>/bin/launchctl setenv OLLAMA_HOST 0.0.0.0:11434; /bin/launchctl setenv OLLAMA_ORIGINS *</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
</dict>
</plist>
PLIST_EOF
chmod 644 "$PLIST"
launchctl load -w "$PLIST" 2>/dev/null || true
echo "✅ Ollama env vars persisted via $PLIST"

# --- Tailscale Funnel for Ollama ---
if command -v tailscale >/dev/null 2>&1; then
  echo ""
  echo "Re-asserting Tailscale Funnel on port 11434..."
  sudo -u "$SUDO_USER" tailscale funnel reset 2>/dev/null || true
  sudo -u "$SUDO_USER" tailscale funnel --bg 11434 || echo "⚠️  funnel command failed (check Tailscale state)"
  sudo -u "$SUDO_USER" tailscale funnel status || true
else
  echo "⚠️  tailscale CLI not found — install or skip funnel step."
fi
