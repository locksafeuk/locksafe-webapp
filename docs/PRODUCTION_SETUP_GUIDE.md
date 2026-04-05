# Production Deployment Guide - Telegram & WhatsApp Integration

## Domain: locksafe.uk (Vercel)

This guide covers setting up Telegram webhooks and WhatsApp Business integration for your production deployment.

---

## Part 1: Telegram Webhook Setup

### Prerequisites
- Your bot token (from @BotFather)
- Your chat ID (admin group or user ID)
- Site deployed on Vercel at locksafe.uk

### Step 1: Set Environment Variables on Vercel

Go to your Vercel project settings → Environment Variables and add:

```env
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CHAT_ID=your-chat-id-here
TELEGRAM_NOTIFICATIONS_ENABLED=true
```

### Step 2: Configure Webhook

Run this command to set up the Telegram webhook pointing to your production domain:

```bash
# Set webhook for Admin Bot
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://locksafe.uk/api/agent/telegram",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }'
```

Or visit this URL in your browser (replacing YOUR_BOT_TOKEN):
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://locksafe.uk/api/agent/telegram&allowed_updates=["message","callback_query"]&drop_pending_updates=true
```

Alternatively, use the built-in setup endpoint:
```
https://locksafe.uk/api/agent/telegram?setup=true
```

### Step 3: Verify Webhook is Set

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "https://locksafe.uk/api/agent/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40,
    "ip_address": "...",
    "allowed_updates": ["message", "callback_query"]
  }
}
```

### Step 4: Test the Bot

1. Open Telegram and find your bot
2. Send `/help` or `/stats`
3. You should receive a response

**Test notification from admin panel:**
```bash
curl -X POST "https://locksafe.uk/api/admin/telegram/test" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test notification from production!"}'
```

---

## Part 2: WhatsApp Business Setup

### Prerequisites
- Meta Developer Account
- WhatsApp Business Account
- Business verified in Meta Business Manager

### Step 1: Set Environment Variables on Vercel

```env
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=locksafe_whatsapp_verify_2024
WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id
```

### Step 2: Configure Webhook in Meta Developer Console

1. Go to [Meta Developer Console](https://developers.facebook.com/apps)
2. Select your app
3. Go to WhatsApp → Configuration
4. Click "Edit" next to Webhook
5. Enter:
   - **Callback URL**: `https://locksafe.uk/api/webhooks/whatsapp`
   - **Verify Token**: `locksafe_whatsapp_verify_2024` (same as WHATSAPP_VERIFY_TOKEN)
6. Click "Verify and Save"
7. Subscribe to:
   - `messages`
   - `messaging_postbacks`

### Step 3: Test Webhook Verification

The endpoint should automatically handle Meta's verification challenge. Check your logs for:
```
[WhatsApp Webhook] Verified successfully
```

### Step 4: Send Test Message

```bash
curl -X POST "https://graph.facebook.com/v18.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "447XXXXXXXXX",
    "type": "text",
    "text": {"body": "Hello from LockSafe UK! 🔐"}
  }'
```

---

## Part 3: Manual API Endpoint Testing

### Core API Tests

#### 1. Health Check
```bash
# Check if site is responding
curl -I https://locksafe.uk
```

#### 2. Authentication
```bash
# Test admin login
curl -X POST "https://locksafe.uk/api/admin/auth" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@locksafe.uk", "password": "your-password"}'
```

#### 3. Jobs API
```bash
# Create a test job (requires authentication)
curl -X POST "https://locksafe.uk/api/jobs" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{
    "postcode": "SW1A 1AA",
    "address": "10 Downing Street, London",
    "problemType": "Locked out",
    "propertyType": "Residential",
    "isUrgent": true
  }'
```

#### 4. Telegram Test
```bash
# Test Telegram notification
curl -X POST "https://locksafe.uk/api/admin/telegram/test" \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=YOUR_TOKEN" \
  -d '{"message": "Test notification"}'
```

#### 5. Agent Endpoints (for Telegram Bot)
```bash
# Get platform stats
curl "https://locksafe.uk/api/agent/stats" \
  -H "X-Agent-Key: YOUR_AGENT_API_KEY"

# Get pending jobs
curl "https://locksafe.uk/api/agent/jobs?status=PENDING" \
  -H "X-Agent-Key: YOUR_AGENT_API_KEY"

# Get available locksmiths
curl "https://locksafe.uk/api/agent/locksmiths?available=true" \
  -H "X-Agent-Key: YOUR_AGENT_API_KEY"
```

#### 6. Webhook Endpoints
```bash
# Test WhatsApp webhook verification
curl "https://locksafe.uk/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=locksafe_whatsapp_verify_2024&hub.challenge=test123"
# Should return: test123

# Check Telegram webhook status
curl "https://locksafe.uk/api/agent/telegram"
```

---

## Part 4: Troubleshooting

### Telegram Issues

| Issue | Solution |
|-------|----------|
| Webhook not receiving | Check URL is HTTPS, verify bot token |
| 401 errors | Ensure TELEGRAM_CHAT_ID matches authorized chats |
| Bot not responding | Check Vercel function logs for errors |

**Delete and reset webhook:**
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
# Then set it again
```

### WhatsApp Issues

| Issue | Solution |
|-------|----------|
| Verification failed | Check WHATSAPP_VERIFY_TOKEN matches |
| Messages not sending | Check access token hasn't expired |
| 400 errors | Verify phone number format (no + prefix) |

---

## Part 5: Vercel Environment Variables Checklist

Ensure these are all set in Vercel:

```env
# Required for Telegram
TELEGRAM_BOT_TOKEN=✓
TELEGRAM_CHAT_ID=✓
TELEGRAM_NOTIFICATIONS_ENABLED=true

# Required for WhatsApp
WHATSAPP_PHONE_NUMBER_ID=✓
WHATSAPP_ACCESS_TOKEN=✓
WHATSAPP_VERIFY_TOKEN=✓
WHATSAPP_BUSINESS_ACCOUNT_ID=✓

# Other critical
DATABASE_URL=✓
NEXT_PUBLIC_SITE_URL=https://locksafe.uk
```

---

## Quick Setup Commands

### One-liner: Set Telegram Webhook
```bash
curl "https://locksafe.uk/api/agent/telegram?setup=true"
```

### One-liner: Check All Systems
```bash
# Create a quick health check
curl -s https://locksafe.uk/api/admin/env-status | jq
```

---

## Support

If you encounter issues:
1. Check Vercel Function logs
2. Test endpoints individually
3. Verify environment variables are set correctly
4. Contact support@locksafe.uk
