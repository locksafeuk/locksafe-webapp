#!/bin/bash
# Double-click this file in Finder to ship (commit + push → piky-boy deploys).
# No terminal typing needed. First time only: right-click → Open (to clear the
# macOS "unidentified developer" warning), or run: chmod +x ship.command
cd "/Users/piks/Locksafe Project/locksafe-webapp" || exit 1
./ship.sh "$@"
echo ""
read -n 1 -s -r -p "✅ Done — press any key to close this window."
echo ""
