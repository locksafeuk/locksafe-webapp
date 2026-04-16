#!/bin/bash

# ============================================
# LockSafe UK Production API Testing Script
# ============================================
# Run this script to test all critical API endpoints
# Usage: ./scripts/test-production-apis.sh
# ============================================

DOMAIN="${1:-https://locksafe.uk}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"

echo "============================================"
echo "LockSafe UK API Test Suite"
echo "Domain: $DOMAIN"
echo "Timestamp: $(date)"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0
SKIPPED=0

test_endpoint() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected_status="$4"
  local data="$5"

  echo -n "Testing: $name... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
  fi

  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $status_code)"
    ((PASSED++))
  else
    echo -e "${RED}FAIL${NC} (Expected $expected_status, got $status_code)"
    ((FAILED++))
  fi
}

echo "============================================"
echo "1. BASIC HEALTH CHECKS"
echo "============================================"

# Test homepage
test_endpoint "Homepage" "GET" "$DOMAIN" "200"

# Test health endpoint
test_endpoint "Health Check API" "GET" "$DOMAIN/api/health" "200"

echo ""
echo "============================================"
echo "2. WEBHOOK ENDPOINTS"
echo "============================================"

# Test Telegram webhook GET (should return setup info or ok)
test_endpoint "Telegram Webhook (GET)" "GET" "$DOMAIN/api/agent/telegram" "200"

# Test WhatsApp webhook verification
test_endpoint "WhatsApp Webhook Verify" "GET" "$DOMAIN/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=locksafe_whatsapp_verify_2024&hub.challenge=test123" "200"

echo ""
echo "============================================"
echo "3. AUTH ENDPOINTS"
echo "============================================"

# Test login endpoint exists
test_endpoint "Customer Login Endpoint" "POST" "$DOMAIN/api/auth/login" "400" '{"email":"","password":""}'

# Test admin auth endpoint exists
test_endpoint "Admin Auth Endpoint" "POST" "$DOMAIN/api/admin/auth" "401" '{}'

# Test locksmith auth endpoint
test_endpoint "Locksmith Auth Endpoint" "POST" "$DOMAIN/api/locksmiths/auth" "400" '{}'

echo ""
echo "============================================"
echo "4. PUBLIC API ENDPOINTS"
echo "============================================"

# Test locksmiths listing (public)
test_endpoint "Locksmiths Public List" "GET" "$DOMAIN/api/locksmiths" "200"

echo ""
echo "============================================"
echo "5. TELEGRAM SPECIFIC TESTS"
echo "============================================"

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  echo "Testing Telegram Bot API..."

  # Get bot info
  echo -n "Testing: Telegram Bot Info... "
  bot_response=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe")
  if echo "$bot_response" | grep -q '"ok":true'; then
    bot_username=$(echo "$bot_response" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}PASS${NC} (Bot: @$bot_username)"
    ((PASSED++))
  else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
  fi

  # Get webhook info
  echo -n "Testing: Telegram Webhook Info... "
  webhook_response=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo")
  if echo "$webhook_response" | grep -q '"ok":true'; then
    webhook_url=$(echo "$webhook_response" | grep -o '"url":"[^"]*' | cut -d'"' -f4)
    if [ -n "$webhook_url" ]; then
      echo -e "${GREEN}PASS${NC} (Webhook: $webhook_url)"
    else
      echo -e "${YELLOW}WARN${NC} (No webhook set)"
    fi
    ((PASSED++))
  else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
  fi
else
  echo -e "${YELLOW}SKIPPED${NC} - Set TELEGRAM_BOT_TOKEN environment variable to test"
  ((SKIPPED+=2))
fi

echo ""
echo "============================================"
echo "6. STRIPE WEBHOOK ENDPOINT"
echo "============================================"

# Stripe webhook endpoint should exist (returns 400 without signature)
test_endpoint "Stripe Webhook Exists" "POST" "$DOMAIN/api/webhooks/stripe" "400" '{}'

echo ""
echo "============================================"
echo "7. MARKETING ENDPOINTS"
echo "============================================"

# Test marketing session
test_endpoint "Marketing Session" "POST" "$DOMAIN/api/marketing/session" "200" '{"pageUrl":"https://locksafe.uk","referrer":""}'

# Test tracking
test_endpoint "Marketing Track" "POST" "$DOMAIN/api/marketing/track" "200" '{"event":"page_view","properties":{}}'

echo ""
echo "============================================"
echo "SUMMARY"
echo "============================================"
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Please check the output above.${NC}"
  exit 1
fi
