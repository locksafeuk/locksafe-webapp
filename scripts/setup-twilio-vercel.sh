#!/bin/bash
# ============================================================
# setup-twilio-vercel.sh
# Adds Twilio credentials to Vercel production environment.
#
# Usage:
#   TWILIO_ACCOUNT_SID="ACxxxxxxxx" \
#   TWILIO_AUTH_TOKEN="your_auth_token" \
#   TWILIO_PHONE_NUMBER="+44xxxxxxxxxx" \
#   bash scripts/setup-twilio-vercel.sh
#
# Find credentials at: https://console.twilio.com
# ============================================================

set -e

if [[ -z "$TWILIO_ACCOUNT_SID" || -z "$TWILIO_AUTH_TOKEN" || -z "$TWILIO_PHONE_NUMBER" ]]; then
  echo "❌  Missing env vars. Run as:"
  echo "    TWILIO_ACCOUNT_SID=ACxxx TWILIO_AUTH_TOKEN=xxx TWILIO_PHONE_NUMBER=+44xxx bash scripts/setup-twilio-vercel.sh"
  exit 1
fi

echo "🔧  Adding Twilio env vars to Vercel production..."

printf '%s' "$TWILIO_ACCOUNT_SID"  | npx vercel env add TWILIO_ACCOUNT_SID  production --force 2>/dev/null || \
  printf '%s' "$TWILIO_ACCOUNT_SID"  | npx vercel env add TWILIO_ACCOUNT_SID  production

printf '%s' "$TWILIO_AUTH_TOKEN"   | npx vercel env add TWILIO_AUTH_TOKEN   production --force 2>/dev/null || \
  printf '%s' "$TWILIO_AUTH_TOKEN"   | npx vercel env add TWILIO_AUTH_TOKEN   production

printf '%s' "$TWILIO_PHONE_NUMBER" | npx vercel env add TWILIO_PHONE_NUMBER production --force 2>/dev/null || \
  printf '%s' "$TWILIO_PHONE_NUMBER" | npx vercel env add TWILIO_PHONE_NUMBER production

echo ""
echo "✅  Done! Triggering redeploy..."
git commit --allow-empty -m "chore: redeploy to pick up Twilio env vars" && git push origin main
echo ""
echo "🎉  Twilio will be live once the deploy finishes (~60s)."
echo "    Test at: https://www.locksafe.uk/api/test-sms"
