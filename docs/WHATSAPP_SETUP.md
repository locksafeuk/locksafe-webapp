# WhatsApp Business API Setup Guide

## Overview

LockSafe UK uses the **WhatsApp Business Cloud API** to provide customer support via WhatsApp. This enables:

- Automated customer verification
- Job status queries
- Real-time updates
- Escalation workflows
- Proactive notifications

---

## Prerequisites

1. **Meta Developer Account**: https://developers.facebook.com
2. **Facebook Business Account**: https://business.facebook.com
3. **WhatsApp Business Account** (WABA)
4. **Verified Business** in Meta Business Manager

---

## Step 1: Create Meta App

1. Go to [Meta Developer Console](https://developers.facebook.com/apps)
2. Click **Create App**
3. Select **Business** type
4. Enter app name: `LockSafe UK WhatsApp`
5. Connect to your Business Account
6. Click **Create App**

---

## Step 2: Add WhatsApp Product

1. In your app dashboard, click **Add Product**
2. Find **WhatsApp** and click **Set Up**
3. Select your WhatsApp Business Account (or create one)
4. Follow the guided setup

---

## Step 3: Configure Phone Number

### Option A: Use Test Number (Development)
1. In WhatsApp > Getting Started
2. Use the provided test phone number
3. Add your personal number as a test recipient

### Option B: Add Business Number (Production)
1. Go to WhatsApp > Phone Numbers
2. Click **Add Phone Number**
3. Enter your UK business phone number
4. Complete verification via SMS or voice call
5. Set up a business profile (name, description, logo)

---

## Step 4: Generate Access Token

### Temporary Token (Development)
1. Go to WhatsApp > Getting Started
2. Copy the **Temporary access token**
3. Note: Expires in 24 hours

### Permanent System User Token (Production)
1. Go to [Business Settings](https://business.facebook.com/settings/system-users)
2. Create a **System User** with Admin role
3. Assign the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Click **Generate Token**
5. Select your WhatsApp Business Account
6. Copy and save the token securely

---

## Step 5: Configure Webhook

### In Meta Developer Console:

1. Go to WhatsApp > Configuration
2. Click **Edit** next to Webhook
3. Enter the following:
   - **Callback URL**: `https://YOUR_DOMAIN/api/webhooks/whatsapp`
   - **Verify Token**: Your custom token (e.g., `locksafe_whatsapp_verify_2024`)
4. Click **Verify and Save**
5. Subscribe to these webhook fields:
   - `messages`
   - `message_status_updates`

### Webhook Verification

When you save the webhook, Meta will send a GET request:
```
GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
```

Our endpoint returns the challenge if the token matches.

---

## Step 6: Set Environment Variables

Add to your `.env` file:

```env
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID="123456789012345"
WHATSAPP_ACCESS_TOKEN="EAAxxxxxx..."
WHATSAPP_VERIFY_TOKEN="locksafe_whatsapp_verify_2024"
WHATSAPP_BUSINESS_ACCOUNT_ID="987654321098765"
```

### Finding Your IDs:

| Variable | Where to Find |
|----------|---------------|
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp > Getting Started > Phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | System User token (see Step 4) |
| `WHATSAPP_VERIFY_TOKEN` | Your custom string (set in Step 5) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp > Getting Started > WhatsApp Business Account ID |

---

## Step 7: Create Message Templates

WhatsApp requires pre-approved templates for proactive outbound messages (messages sent outside the 24-hour customer service window).

### Go to Template Manager:
1. [Meta Business Suite](https://business.facebook.com/wa/manage/message-templates)
2. Select your WhatsApp Business Account
3. Click **Create Template**

### Required Templates for LockSafe:

#### 1. `job_status_update`
- **Category**: Utility
- **Language**: English (UK)
- **Header**: Text - "Job Update: {{1}}"
- **Body**:
  ```
  Your locksmith job {{1}} has been updated.

  Status: {{2}}
  {{3}}

  Track your job: {{4}}
  ```
- **Footer**: "LockSafe UK"
- **Buttons**:
  - Quick Reply: "Track Job"
  - URL: `https://locksafe.uk/customer/job/{{1}}`

#### 2. `locksmith_en_route`
- **Category**: Utility
- **Body**:
  ```
  🚗 Your locksmith is on the way!

  Job: {{1}}
  Locksmith: {{2}}
  ETA: {{3}}

  They will contact you when they arrive.
  ```

#### 3. `quote_ready`
- **Category**: Utility
- **Body**:
  ```
  💬 A quote is ready for your locksmith job {{1}}.

  Amount: £{{2}}

  Please review and approve in the app to proceed.
  ```
- **Buttons**:
  - URL: `https://locksafe.uk/customer/job/{{1}}/quote`

#### 4. `signature_reminder`
- **Category**: Utility
- **Body**:
  ```
  ✍️ Your locksmith has completed the work for job {{1}}.

  Please confirm and sign to complete the job.

  This helps protect both you and the locksmith.
  ```

#### 5. `job_completed`
- **Category**: Utility
- **Body**:
  ```
  ✅ Your locksmith job {{1}} is now complete!

  Thank you for using LockSafe UK.

  We'd love to hear your feedback. Please leave a review!
  ```
- **Buttons**:
  - URL: `https://locksafe.uk/review/{{1}}`

---

## Step 8: Testing

### 1. Send Test Message
```bash
curl -X POST "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "447XXXXXXXXX",
    "type": "text",
    "text": {"body": "Hello from LockSafe UK!"}
  }'
```

### 2. Test Webhook
Send a WhatsApp message to your business number and check:
- Server logs for incoming webhook
- Response handling

### 3. Test Templates
```bash
curl -X POST "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "447XXXXXXXXX",
    "type": "template",
    "template": {
      "name": "job_status_update",
      "language": {"code": "en_GB"},
      "components": [
        {
          "type": "body",
          "parameters": [
            {"type": "text", "text": "LS-2026-0001"},
            {"type": "text", "text": "En Route"},
            {"type": "text", "text": "Your locksmith John will arrive in 15 minutes"},
            {"type": "text", "text": "https://locksafe.uk/customer/job/xyz"}
          ]
        }
      ]
    }
  }'
```

---

## Usage in Code

### Sending Messages

```typescript
import {
  sendTextMessage,
  sendButtonMessage,
  sendTemplateMessage
} from "@/lib/whatsapp-business";

// Simple text
await sendTextMessage("447123456789", "Hello!");

// Interactive buttons
await sendButtonMessage(
  "447123456789",
  "How can I help?",
  [
    { id: "track_job", title: "Track Job" },
    { id: "new_request", title: "New Request" }
  ]
);

// Template (for proactive messages)
await sendTemplateMessage(
  "447123456789",
  "job_status_update",
  ["LS-2026-0001", "En Route", "ETA: 15 minutes", "https://..."]
);
```

### Handling Incoming Messages

Messages are processed in `/api/webhooks/whatsapp`:

```typescript
// Automatic routing based on conversation state:
// - Greeting -> Verification -> Job queries
// - Escalation workflows
// - Natural language processing (via OpenAI)
```

---

## Customer Conversation Flow

```
1. Customer sends message
   ↓
2. Check if verified
   ├─ No → Send verification code
   └─ Yes → Continue
   ↓
3. Parse intent
   ├─ "track job" → Show job list
   ├─ "new request" → Redirect to website
   ├─ "speak to agent" → Create escalation
   └─ Job number → Show job details
   ↓
4. Handle actions
   ├─ Contact locksmith
   ├─ Report issue
   └─ Request callback
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Webhook not receiving | Check URL is HTTPS, verify token matches |
| Messages not sending | Check access token hasn't expired |
| Template rejected | Review Meta's template guidelines |
| Rate limited | Implement backoff, check quality rating |

### Debug Logging

Enable verbose logging:
```typescript
console.log(`[WhatsApp] Received from ${phone}: "${messageText}"`);
console.log(`[WhatsApp] Message sent to ${to}`);
```

### Quality Rating

Monitor your quality rating in [Business Suite](https://business.facebook.com/wa/manage/phone-numbers). Low quality can result in:
- Reduced messaging limits
- Account restrictions

Maintain quality by:
- Only messaging opted-in users
- Responding within 24 hours
- Not sending spam

---

## Production Checklist

- [ ] Business verified in Meta Business Manager
- [ ] Production phone number added and verified
- [ ] Permanent access token generated (System User)
- [ ] Webhook configured with HTTPS endpoint
- [ ] All required templates created and approved
- [ ] Environment variables set in production
- [ ] Error handling and logging implemented
- [ ] Customer opt-in mechanism in place
- [ ] Privacy policy updated to mention WhatsApp

---

## Related Documentation

- [Meta WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
