#!/bin/bash

# ============================================
# LockSafe UK - Telegram Webhook Setup Script
# ============================================
# This script sets up the Telegram webhook for production
#
# Usage: ./scripts/setup-telegram-webhook.sh YOUR_BOT_TOKEN
#
# Or set environment variable:
#   export TELEGRAM_BOT_TOKEN="your-token"
#   ./scripts/setup-telegram-webhook.sh
# ============================================

# Get bot token from argument or environment
BOT_TOKEN="${1:-$TELEGRAM_BOT_TOKEN}"
WEBHOOK_URL="${WEBHOOK_URL:-https://locksafe.uk/api/agent/telegram}"

if [ -z "$BOT_TOKEN" ]; then
  echo "Error: No bot token provided."
  echo ""
  echo "Usage:"
  echo "  ./scripts/setup-telegram-webhook.sh YOUR_BOT_TOKEN"
  echo ""
  echo "Or set environment variable:"
  echo "  export TELEGRAM_BOT_TOKEN='your-token'"
  echo "  ./scripts/setup-telegram-webhook.sh"
  exit 1
fi

echo "============================================"
echo "Telegram Webhook Setup for LockSafe UK"
echo "============================================"
echo ""

# Step 1: Get bot info
echo "Step 1: Verifying bot token..."
BOT_INFO=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getMe")

if echo "$BOT_INFO" | grep -q '"ok":true'; then
  BOT_USERNAME=$(echo "$BOT_INFO" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
  BOT_ID=$(echo "$BOT_INFO" | grep -o '"id":[0-9]*' | cut -d':' -f2)
  echo "✅ Bot verified: @$BOT_USERNAME (ID: $BOT_ID)"
else
  echo "❌ Invalid bot token. Please check your token."
  echo "Response: $BOT_INFO"
  exit 1
fi

echo ""

# Step 2: Check current webhook
echo "Step 2: Checking current webhook configuration..."
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo")
CURRENT_URL=$(echo "$WEBHOOK_INFO" | grep -o '"url":"[^"]*' | cut -d'"' -f4)

if [ -n "$CURRENT_URL" ]; then
  echo "Current webhook: $CURRENT_URL"
  if [ "$CURRENT_URL" = "$WEBHOOK_URL" ]; then
    echo "✅ Webhook already configured correctly!"
    echo ""
    echo "Webhook Details:"
    echo "$WEBHOOK_INFO" | python3 -m json.tool 2>/dev/null || echo "$WEBHOOK_INFO"
    exit 0
  else
    echo "⚠️  Different webhook URL configured. Will update..."
  fi
else
  echo "No webhook currently configured."
fi

echo ""

# Step 3: Set webhook
echo "Step 3: Setting webhook to: $WEBHOOK_URL"
SET_RESULT=$(curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"allowed_updates\": [\"message\", \"callback_query\"],
    \"drop_pending_updates\": true
  }")

if echo "$SET_RESULT" | grep -q '"ok":true'; then
  echo "✅ Webhook set successfully!"
else
  echo "❌ Failed to set webhook."
  echo "Response: $SET_RESULT"
  exit 1
fi

echo ""

# Step 4: Verify webhook
echo "Step 4: Verifying webhook configuration..."
VERIFY_INFO=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo")
VERIFIED_URL=$(echo "$VERIFY_INFO" | grep -o '"url":"[^"]*' | cut -d'"' -f4)

if [ "$VERIFIED_URL" = "$WEBHOOK_URL" ]; then
  echo "✅ Webhook verified!"
  echo ""
  echo "Webhook Details:"
  echo "$VERIFY_INFO" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_INFO"
else
  echo "❌ Webhook verification failed."
  echo "Expected: $WEBHOOK_URL"
  echo "Got: $VERIFIED_URL"
  exit 1
fi

echo ""
echo "============================================"
echo "✅ SETUP COMPLETE!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Open Telegram and find @$BOT_USERNAME"
echo "2. Send /help or /stats to test"
echo "3. Check Vercel function logs for incoming requests"
echo ""
echo "Webhook URL: $WEBHOOK_URL"
echo "Bot Username: @$BOT_USERNAME"
