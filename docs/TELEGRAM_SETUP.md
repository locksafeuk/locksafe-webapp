# Telegram Bot Setup Guide

## Overview

LockSafe UK uses two Telegram bots:

1. **Admin Agent Bot** (`/api/agent/telegram`) - For admin notifications and management
2. **Locksmith Bot** (`/api/locksmith/bot`) - For individual locksmith interactions

---

## Step 1: Create Bot with BotFather

### Create Admin Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Enter bot name: `LockSafe Admin`
4. Enter username: `locksafe_admin_bot` (must be unique)
5. **Save the API token** provided

### Create Locksmith Bot (Optional - Same Bot)

You can use the same bot for both admin and locksmith features, or create a separate one:

1. Send `/newbot` to BotFather again
2. Enter bot name: `LockSafe Locksmith`
3. Enter username: `locksafe_locksmith_bot`
4. **Save the API token**

---

## Step 2: Configure Bot Settings

With BotFather, configure your bot:

```
/setdescription - LockSafe UK notification and management bot
/setabouttext - Official LockSafe UK bot for locksmiths and admins
/setuserpic - Upload your logo
/setcommands - Set available commands
```

### Set Commands for Admin Bot:
```
status - Get platform status
jobs - View recent jobs
alerts - Manage alerts
dispatch - Dispatch a locksmith
help - Show available commands
```

### Set Commands for Locksmith Bot:
```
start - Register with LockSafe
status - Your current status
toggle - Toggle availability
jobs - Your active jobs
earnings - View earnings
help - Show available commands
```

---

## Step 3: Get Chat ID

### For Admin Group:

1. Create a Telegram group (e.g., "LockSafe Admin")
2. Add your bot to the group
3. Make the bot an admin (for message access)
4. Send any message in the group
5. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
6. Find the chat ID (negative number for groups)

### For Individual Users:

1. Start a chat with the bot
2. Send any message
3. Visit the getUpdates URL
4. Find your user ID (positive number)

---

## Step 4: Set Environment Variables

Add to your `.env`:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="8751497268:AAGFHuAUplfHM6AFoFkVn_-QbYz3vGRlBN0"
TELEGRAM_CHAT_ID="-1002198420159"
TELEGRAM_NOTIFICATIONS_ENABLED="true"
```

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot API token from BotFather |
| `TELEGRAM_CHAT_ID` | Admin group/chat ID for notifications |
| `TELEGRAM_NOTIFICATIONS_ENABLED` | Enable/disable notifications |

---

## Step 5: Set Up Webhooks

Telegram needs to know where to send incoming messages.

### Admin Bot Webhook

**Option 1: Via Browser**
```
https://YOUR_DOMAIN/api/agent/telegram?setup=true
```

**Option 2: Via curl**
```bash
curl "https://YOUR_DOMAIN/api/agent/telegram?setup=true"
```

**Option 3: Direct Telegram API**
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR_DOMAIN/api/agent/telegram",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }'
```

### Locksmith Bot Webhook

```
https://YOUR_DOMAIN/api/locksmith/bot?setup=true
```

### Verify Webhook is Set

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "https://YOUR_DOMAIN/api/agent/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null
  }
}
```

---

## Step 6: Test the Bots

### Test Admin Bot

1. Send `/status` in your admin group
2. You should receive a response with platform stats

### Test Locksmith Bot

1. Start a chat with the locksmith bot
2. Send `/start`
3. You should receive a welcome message

### Test Notifications

Trigger a test notification:
```bash
curl -X POST "https://YOUR_DOMAIN/api/admin/telegram/test" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test notification"}'
```

---

## Available Commands

### Admin Bot (`/api/agent/telegram`)

| Command | Description |
|---------|-------------|
| `/status` | Platform statistics (jobs, earnings, locksmiths) |
| `/jobs` | List recent jobs with status |
| `/jobs active` | Active jobs only |
| `/alerts` | Manage alert settings |
| `/dispatch <jobId>` | Manually dispatch a job |
| `/locksmith <id>` | View locksmith details |
| `/help` | Show all commands |

### Admin Bot Callback Buttons

| Action | Description |
|--------|-------------|
| `view_job_<id>` | View job details |
| `assign_<jobId>_<locksmithId>` | Assign locksmith to job |
| `toggle_alerts` | Toggle notifications |
| `refresh_status` | Refresh dashboard |

### Locksmith Bot (`/api/locksmith/bot`)

| Command | Description |
|---------|-------------|
| `/start` | Register/welcome |
| `/status` | Current availability and stats |
| `/toggle` | Toggle availability |
| `/jobs` | View active jobs |
| `/job <id>` | View specific job |
| `/earnings` | View earnings summary |
| `/help` | Show all commands |

### Locksmith Bot Callbacks

| Action | Description |
|--------|-------------|
| `accept_<jobId>` | Accept a job |
| `decline_<jobId>` | Decline a job |
| `arrived_<jobId>` | Mark as arrived |
| `complete_<jobId>` | Mark job complete |
| `toggle_availability` | Toggle on/off |

---

## Automated Notifications

### Admin Notifications

The admin bot sends alerts for:

- 🆕 New job requests
- ✅ Jobs accepted/completed
- ⚠️ Jobs without applications (after 5 min)
- 💳 Payment received/failed
- 🔔 Insurance expiring
- 📱 New locksmith registrations

### Locksmith Notifications

Locksmiths receive:

- 📍 New jobs in their area
- 💬 Quote accepted/declined
- ⏰ Signature reminders
- 💰 Payment confirmations
- 📅 Availability schedule reminders

---

## NLP Features (OpenAI Integration)

When `OPENAI_API_KEY` is configured, bots support natural language queries:

### Example Queries:

**Admin:**
- "How many jobs today?"
- "Show pending jobs in London"
- "Which locksmiths are available?"

**Locksmith:**
- "What are my earnings this week?"
- "Any jobs near me?"
- "Turn off notifications"

### Implementation

NLP processing happens in `/lib/openclaw-nlp.ts`:

```typescript
import { processNaturalLanguageQuery } from "@/lib/openclaw-nlp";

const result = await processNaturalLanguageQuery(
  text,           // User message
  "locksmith",    // Context type
  locksmithId     // User ID
);

// result.response contains the AI-generated answer
```

---

## Registering Locksmiths with Bot

Locksmiths connect their Telegram account in their settings:

1. Go to `/locksmith/settings`
2. Click "Connect Telegram"
3. Click the link to start chat with bot
4. Bot captures their chat ID
5. Save in `Locksmith.telegramChatId`

### Registration Endpoint

The bot registration happens via:
```
https://YOUR_DOMAIN/locksmith/settings?telegram=CHAT_ID
```

Or locksmith sends `/start` and the bot guides them.

---

## Troubleshooting

### Webhook Not Receiving Messages

1. **Check SSL**: Webhook URL must be HTTPS
2. **Check Bot Privacy**:
   - BotFather: `/setprivacy` → Disable (to receive all group messages)
3. **Check Group Admin**: Bot must be admin in groups
4. **Check webhook info**: `getWebhookInfo` for errors

### Bot Not Responding

1. Check server logs for errors
2. Verify `TELEGRAM_BOT_TOKEN` is correct
3. Ensure webhook is set to correct URL
4. Check if bot is authorized for the chat

### Messages Delayed

1. Check `pending_update_count` in webhook info
2. Drop pending updates: `?drop_pending_updates=true`
3. Verify server is responding within 60 seconds

### Delete Webhook (if needed)

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

---

## Security Considerations

### Chat Authorization

Only authorized chats receive responses:

```typescript
// In /lib/agent-auth.ts
const AUTHORIZED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export function verifyTelegramWebhook(update: TelegramUpdate) {
  const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;

  if (chatId?.toString() !== AUTHORIZED_CHAT_ID) {
    return { authenticated: false, error: "Unauthorized chat" };
  }

  return { authenticated: true, chatId: chatId.toString() };
}
```

### Locksmith Verification

Locksmiths must be registered to use bot features:

```typescript
const locksmith = await getLocksmithByChatId(chatId, "telegram");

if (!locksmith) {
  // Send registration instructions
}
```

---

## Production Checklist

- [ ] Bot created with BotFather
- [ ] Bot commands configured
- [ ] Webhook URL set (HTTPS)
- [ ] Environment variables configured
- [ ] Admin chat ID obtained
- [ ] Notifications tested
- [ ] Locksmith registration flow tested
- [ ] Error handling verified
- [ ] Privacy settings configured (if using groups)

---

## API Reference

### Send Notification (Internal)

```typescript
import { sendTelegramNotification } from "@/lib/telegram";

await sendTelegramNotification({
  title: "New Job",
  message: "Job LS-2026-0001 created",
  type: "info", // info, warning, error, success
  jobId: "optional_job_id"
});
```

### Send Custom Message

```typescript
import { sendTelegramMessage } from "@/lib/telegram-bot";

await sendTelegramMessage(chatId, "Hello!", [
  { text: "Button 1", callbackData: "action_1" },
  { text: "Website", url: "https://locksafe.uk" }
]);
```

---

## Related Documentation

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [OPENCLAW_SETUP.md](./OPENCLAW_SETUP.md) - NLP integration
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Overall system
