# WhatsApp Webhook Setup - Complete Guide

This guide will walk you through setting up the WhatsApp Business API webhook step-by-step.

## Your Current Setup

From your screenshots, you have:
- **WhatsApp Business Account ID**: `841629772244797`
- **Business Name**: www.locksafe.uk
- **Phone Number**: +44 7818 333989
- **Meta App**: LockSafeUk (Published)

---

## Step 1: Get Your Phone Number ID

The **Phone Number ID** is different from your phone number itself. You need to find it in the Meta Developer Console.

1. Go to [Meta Developer Console](https://developers.facebook.com/apps)
2. Click on your **LockSafeUk** app
3. In the left sidebar, click **WhatsApp** > **API Setup** (or "Getting Started")
4. Look for **"Phone number ID"** - it's a long number like `123456789012345`
5. Copy this and paste it in your `.env` file as `WHATSAPP_PHONE_NUMBER_ID`

![Phone Number ID Location](https://i.imgur.com/example.png)

---

## Step 2: Generate Access Token

### Option A: Temporary Token (for testing - expires in 24 hours)

1. In **WhatsApp** > **API Setup**
2. Look for the **"Temporary access token"** section
3. Click **"Generate"** or copy the existing token
4. Paste in `.env` as `WHATSAPP_ACCESS_TOKEN`

### Option B: Permanent Token (for production - RECOMMENDED)

1. Go to [Business Settings](https://business.facebook.com/settings/system-users)
2. Click **System Users** in the left sidebar
3. Click **Add** to create a new system user
   - Name: `LockSafe WhatsApp Bot`
   - Role: **Admin**
4. Click **Add Assets** and add:
   - Your **WhatsApp Business Account** (841629772244797)
   - Enable **Full Control**
5. Click **Generate New Token**
6. Select your **LockSafeUk** app
7. Enable these permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
8. Click **Generate Token**
9. **COPY THE TOKEN IMMEDIATELY** - it only shows once!
10. Paste in `.env` as `WHATSAPP_ACCESS_TOKEN`

---

## Step 3: Add WhatsApp Product to Your App (if not already done)

1. Go to your [LockSafeUk app](https://developers.facebook.com/apps)
2. Click **Add Product** in the left sidebar
3. Find **WhatsApp** and click **Set Up**
4. Follow the prompts to connect your WhatsApp Business Account

---

## Step 4: Configure the Webhook

This is the crucial step!

### 4.1 Find the Webhook Configuration

1. Go to [Meta Developer Console](https://developers.facebook.com/apps)
2. Click your **LockSafeUk** app
3. Click **WhatsApp** > **Configuration** in the left sidebar

### 4.2 Enter Webhook Details

| Field | Value |
|-------|-------|
| **Callback URL** | `https://locksafe.uk/api/webhooks/whatsapp` |
| **Verify Token** | `locksafe_whatsapp_verify_2024` |

> ⚠️ **IMPORTANT**: The Callback URL MUST be your production domain (locksafe.uk), not a preview URL!

### 4.3 Click "Verify and Save"

When you click this button:
1. Meta sends a GET request to your callback URL
2. Your server must respond with the `hub.challenge` parameter
3. If verification succeeds, the webhook is active

**If verification fails**, check:
- Is your site deployed and accessible?
- Does the URL match exactly?
- Is the verify token spelled correctly?

### 4.4 Subscribe to Webhook Fields

After verification, click **Manage** and enable these fields:
- ✅ `messages` - Incoming messages from customers
- ✅ `message_status_updates` - Delivery/read receipts (optional)

---

## Step 5: Configure in App Dashboard

There's also a **Webhooks** section in the main app settings:

1. Click **Webhooks** in the left sidebar (under Add Product)
2. Select **WhatsApp Business Account** from the dropdown
3. Click **Subscribe to this object**
4. Enter the same callback URL and verify token
5. Subscribe to:
   - `messages`
   - `message_template_status_update` (optional)

---

## Step 6: Test Your Webhook

### Test 1: Verify the endpoint manually

```bash
curl "https://locksafe.uk/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=locksafe_whatsapp_verify_2024&hub.challenge=test123"
```

Should return: `test123`

### Test 2: Send a test message

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

Replace:
- `YOUR_PHONE_NUMBER_ID` with your Phone Number ID
- `YOUR_ACCESS_TOKEN` with your access token
- `447XXXXXXXXX` with your test phone number

### Test 3: Reply to your test message

1. On your phone, reply to the WhatsApp message
2. Check your server logs for the incoming webhook
3. You should see: `[WhatsApp Webhook] Received from 447...: "your message"`

---

## Environment Variables Summary

Add these to your `.env` file:

```env
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID="123456789012345"        # From API Setup
WHATSAPP_BUSINESS_ACCOUNT_ID="841629772244797"   # From your screenshot
WHATSAPP_ACCESS_TOKEN="EAAxxxxxxxxxxxx..."        # From System User
WHATSAPP_VERIFY_TOKEN="locksafe_whatsapp_verify_2024"
```

---

## Troubleshooting

### "Webhook verification failed"

1. **Check the URL is accessible**: Open `https://locksafe.uk/api/webhooks/whatsapp` in a browser
2. **Check HTTPS**: Meta requires HTTPS, not HTTP
3. **Check the verify token**: Must match exactly (case-sensitive)
4. **Check deployment**: Is the latest code deployed?

### "App not receiving messages"

1. **Subscribe to messages field**: Go to Configuration > Webhook fields
2. **Check phone number is linked**: The phone number must be connected to your app
3. **Check server logs**: Add console.log to see if requests are arriving

### "Cannot send messages"

1. **Token expired**: Regenerate if using temporary token
2. **Phone not verified**: Complete phone verification in WhatsApp settings
3. **24-hour window**: Can only send free-form messages within 24h of customer message
4. **Use templates**: For proactive messages, use approved templates

---

## Next Steps After Setup

1. ✅ Webhook configured and verified
2. ✅ Access token generated and saved
3. ⬜ Create message templates (for proactive notifications)
4. ⬜ Add your business number to production
5. ⬜ Test the full customer flow

---

## Quick Reference: Where to Find Things

| What | Where |
|------|-------|
| Phone Number ID | Meta Developers > Your App > WhatsApp > API Setup |
| Access Token | Business Settings > System Users > Generate Token |
| Webhook Config | Meta Developers > Your App > WhatsApp > Configuration |
| Message Templates | Business Suite > WhatsApp > Message Templates |
| Business Account ID | Business Settings > Accounts > WhatsApp accounts |

---

## Links

- [Meta Developer Console](https://developers.facebook.com/apps)
- [Business Settings](https://business.facebook.com/settings)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates](https://business.facebook.com/wa/manage/message-templates)
