#!/usr/bin/env bash
#
# LockSafe — make the local Ollama reliably + SECURELY reachable from production,
# and survive reboots. Run ONCE on the Mac Studio:
#
#   bash infra/ollama/setup.sh
#
# What it sets up (idempotent — safe to re-run):
#   • Caddy auth proxy (:11435) — validates X-Ollama-Secret, rewrites Host,
#     forwards to Ollama on 127.0.0.1:11434. Runs as a KeepAlive LaunchAgent
#     (auto-restarts if it ever dies).
#   • Tailscale Funnel (:443 → :11435), re-asserted at every login by a
#     LaunchAgent (with retry, in case tailscaled isn't up yet).
#   • Verifies the whole chain end-to-end.
#
# Result: production reaches Ollama through one authenticated, Host-correct path
# that comes back automatically after a reboot — no more silent outages.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CADDYFILE="$DIR/Caddyfile"
PROXY_PORT=11435
OLLAMA_PORT=11434
LA="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs"
CADDY_PLIST="$LA/com.locksafe.ollama-proxy.plist"
FUNNEL_PLIST="$LA/com.locksafe.ollama-funnel.plist"

echo "▶ LockSafe Ollama hardening setup"
mkdir -p "$LA" "$LOGS"

# ── 1. Dependencies ──────────────────────────────────────────────────────────
if ! command -v tailscale >/dev/null 2>&1; then
  echo "✗ 'tailscale' not found in PATH. Install Tailscale, then re-run."; exit 1
fi
TS_BIN="$(command -v tailscale)"

if ! command -v caddy >/dev/null 2>&1; then
  echo "• Installing Caddy via Homebrew…"
  brew install caddy
fi
CADDY_BIN="$(command -v caddy)"

# ── 2. Ollama must be running locally ────────────────────────────────────────
if ! curl -s "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
  echo "✗ Ollama isn't answering on 127.0.0.1:${OLLAMA_PORT}. Start Ollama first."; exit 1
fi
echo "• Ollama is up locally ✓"

# ── 3. OLLAMA_SECRET — MUST match the value set in Vercel ─────────────────────
SECRET="${OLLAMA_SECRET:-}"
if [ -z "$SECRET" ]; then
  for f in "$DIR/../../.env.vercel.prod" "$DIR/../../.env"; do
    if [ -f "$f" ]; then
      v=$(grep -E '^OLLAMA_SECRET=' "$f" | head -1 | cut -d= -f2- | tr -d '"' || true)
      [ -n "$v" ] && SECRET="$v" && echo "• Using OLLAMA_SECRET from ${f##*/}" && break
    fi
  done
fi
if [ -z "$SECRET" ]; then
  read -r -s -p "Enter OLLAMA_SECRET (the SAME value as in Vercel): " SECRET; echo
fi
[ -z "$SECRET" ] && { echo "✗ OLLAMA_SECRET is required (it must match Vercel)."; exit 1; }

# ── 4. Caddy LaunchAgent (KeepAlive; carries the secret in its own env) ──────
cat > "$CADDY_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.locksafe.ollama-proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>${CADDY_BIN}</string><string>run</string><string>--config</string><string>${CADDYFILE}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>OLLAMA_SECRET</key><string>${SECRET}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOGS}/locksafe-ollama-proxy.log</string>
  <key>StandardErrorPath</key><string>${LOGS}/locksafe-ollama-proxy.log</string>
</dict></plist>
PLIST
chmod 600 "$CADDY_PLIST"  # the plist holds the secret — keep it private

# ── 5. Funnel LaunchAgent (re-asserts at login, with retry for tailscaled) ──
cat > "$FUNNEL_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.locksafe.ollama-funnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string><string>-c</string>
    <string>for i in 1 2 3 4 5 6; do ${TS_BIN} funnel --bg ${PROXY_PORT} &amp;&amp; exit 0; sleep 10; done</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>${LOGS}/locksafe-ollama-funnel.log</string>
  <key>StandardErrorPath</key><string>${LOGS}/locksafe-ollama-funnel.log</string>
</dict></plist>
PLIST

# ── 6. (Re)load both agents ──────────────────────────────────────────────────
launchctl unload "$CADDY_PLIST" 2>/dev/null || true
launchctl load  "$CADDY_PLIST"
launchctl unload "$FUNNEL_PLIST" 2>/dev/null || true
launchctl load  "$FUNNEL_PLIST"

# ── 7. Point the public funnel at the proxy (clear any old :443 funnel first) ─
"$TS_BIN" funnel --https=443 off 2>/dev/null || true
"$TS_BIN" funnel --bg "$PROXY_PORT"

# ── 8. Verify the chain ──────────────────────────────────────────────────────
sleep 3
echo ""
echo "── Verification ─────────────────────────────────────────"
echo -n "• Proxy WITH secret (expect model JSON): "
curl -s -H "X-Ollama-Secret: ${SECRET}" "http://127.0.0.1:${PROXY_PORT}/api/tags" | head -c 90; echo
echo -n "• Proxy WITHOUT secret (expect 403):     "
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PROXY_PORT}/api/tags"; echo
echo ""
echo "✅ Setup complete. Now confirm PRODUCTION sees it:"
echo "   https://www.locksafe.uk/api/admin/agents/ollama-probe   → expect reachable: true"
echo ""
echo "   (If still false, the router's circuit breaker may take ~30 min to retry Ollama.)"
