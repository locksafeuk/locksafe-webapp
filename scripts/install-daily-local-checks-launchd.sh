#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/uk.locksafe.daily-checks.plist"
LOG_DIR="$ROOT_DIR/reports/daily-checks"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>uk.locksafe.daily-checks</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd "$ROOT_DIR" && bash ./scripts/run-daily-local-checks.sh</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>6</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchd-out.log</string>

  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd-err.log</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo "Installed launchd job: uk.locksafe.daily-checks"
echo "Plist: $PLIST_PATH"
echo "Schedule: daily at 06:00 local machine time"
echo
echo "Commands:"
echo "  Run now:    launchctl kickstart -k gui/\$(id -u)/uk.locksafe.daily-checks"
echo "  Status:     launchctl print gui/\$(id -u)/uk.locksafe.daily-checks"
echo "  Disable:    launchctl unload $PLIST_PATH"
