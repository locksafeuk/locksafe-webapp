# OpenClaw Integration Setup Guide

> **LockSafe UK Admin Operations Agent**

This guide explains how to set up the OpenClaw AI agent integration for LockSafe UK, enabling intelligent admin operations via Telegram.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Telegram Bot Setup](#telegram-bot-setup)
5. [API Endpoints](#api-endpoints)
6. [Telegram Commands](#telegram-commands)
7. [Intelligent Dispatch](#intelligent-dispatch)
8. [OpenClaw Configuration](#openclaw-configuration)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The OpenClaw integration provides:

- **Admin Operations Agent**: Manage jobs, locksmiths, and stats via Telegram
- **Intelligent Dispatch**: AI-powered locksmith matching for jobs
- **Proactive Alerts**: Automatic notifications for urgent issues
- **Natural Language Interface**: Query the system conversationally

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT                             │
│  Admin sends commands: /jobs, /stats, /dispatch, etc.       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOCKSAFE API                             │
│  /api/agent/telegram  ←  Webhook receives Telegram updates  │
│  /api/agent/jobs      ←  List/filter jobs                   │
│  /api/agent/locksmiths ← List/manage locksmiths             │
│  /api/agent/stats     ←  Dashboard statistics               │
│  /api/agent/dispatch  ←  Intelligent job matching           │
│  /api/agent/alerts    ←  System alerts                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    OPENCLAW (Optional)                      │
│  For natural language understanding and autonomous tasks    │
│  Can call LockSafe API endpoints as tools                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **Telegram Account**: For creating the admin bot
2. **Server**: VPS or cloud server (for OpenClaw - optional)
3. **LockSafe Deployment**: Running instance at `https://your-domain.com`

---

## Environment Setup

Add these variables to your `.env` file:

```bash
# ============================================
# AGENT INTEGRATION
# ============================================

# API key for authenticating agent requests
# Generate a secure random string: openssl rand -hex 32
AGENT_API_KEY="your-secure-api-key-here"

# ============================================
# TELEGRAM BOT
# ============================================

# Bot token from @BotFather
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"

# Chat ID for main admin notifications
TELEGRAM_CHAT_ID="-1001234567890"

# Enable Telegram notifications
TELEGRAM_NOTIFICATIONS_ENABLED="true"

# Additional admin chat IDs (comma-separated)
# Users with these IDs can use bot commands
TELEGRAM_ADMIN_CHAT_IDS="-1001234567890,123456789"
```

---

## Telegram Bot Setup

### Step 1: Create the Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a name: `LockSafe Admin`
4. Choose a username: `locksafe_admin_bot`
5. Copy the API token

### Step 2: Configure Commands

Message @BotFather with `/setcommands` and choose your bot, then send:

```
help - Show available commands
stats - Quick dashboard statistics
jobs - List today's jobs
pending - Show pending jobs
locksmiths - List available locksmiths
alerts - Show pending alerts
dispatch - Find best locksmith for a job
assign - Assign job to locksmith
availability - Toggle locksmith availability
```

### Step 3: Get Your Chat ID

1. Add the bot to your admin group (or message it directly)
2. Send a message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
4. Find the `chat.id` in the response

### Step 4: Set Up Webhook

After deploying LockSafe, set the webhook:

```bash
curl "https://your-domain.com/api/agent/telegram?setup=true"
```

Or manually:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/agent/telegram"}'
```

### Step 5: Test the Bot

Send `/help` to your bot. You should receive the command list.

---

## API Endpoints

All agent endpoints require authentication via Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_AGENT_API_KEY" \
  https://your-domain.com/api/agent/jobs
```

### GET /api/agent/jobs

List and filter jobs.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (PENDING, ACCEPTED, active, urgent) |
| date | string | Filter by date (today, yesterday, week, month) |
| locksmithId | string | Filter by assigned locksmith |
| customerId | string | Filter by customer |
| postcode | string | Filter by postcode prefix |
| limit | number | Results per page (max 100) |
| skip | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "job_id",
      "jobNumber": "LS-2603-0001",
      "status": "PENDING",
      "problemType": "lockout",
      "postcode": "SW1A 1AA",
      "customer": { "name": "John Smith", "phone": "+44..." },
      "locksmith": null,
      "applicationCount": 3
    }
  ],
  "pagination": { "total": 50, "limit": 20, "skip": 0, "hasMore": true }
}
```

### GET /api/agent/locksmiths

List locksmiths with availability info.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| available | boolean | Filter by availability |
| verified | boolean | Filter by verification status |
| postcode | string | Find locksmiths near postcode |
| insuranceExpiring | boolean | Show expiring insurance only |

### PATCH /api/agent/locksmiths

Update locksmith availability.

**Request Body:**
```json
{
  "locksmithId": "locksmith_id",
  "isAvailable": true
}
```

### GET /api/agent/stats

Get dashboard statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "today": { "jobs": 5, "completed": 3, "revenue": 450.00 },
    "current": { "pendingJobs": 2, "activeJobs": 3 },
    "locksmiths": { "total": 25, "available": 12 },
    "alerts": { "total": 3, "critical": 1, "warning": 2 }
  }
}
```

### GET /api/agent/dispatch

Find best locksmiths for a job.

**Query Parameters:**
- `jobId`: Job ID to find matches for
- `maxCandidates`: Number of candidates (default 5)

**Response:**
```json
{
  "success": true,
  "candidates": [
    {
      "locksmithId": "ls_id",
      "locksmithName": "Mike Smith",
      "distanceMiles": 2.3,
      "rating": 4.8,
      "matchScore": 85,
      "estimatedEtaMinutes": 15,
      "reasons": ["Very close proximity", "Top-rated locksmith"]
    }
  ],
  "autoDispatchRecommended": true,
  "reason": "Strong match: Mike Smith (85% match)"
}
```

### POST /api/agent/dispatch

Auto-dispatch a job to a locksmith.

**Request Body:**
```json
{
  "jobId": "job_id",
  "locksmithId": "locksmith_id",
  "assessmentFee": 45.00,
  "etaMinutes": 20,
  "notifyLocksmith": true
}
```

### GET /api/agent/alerts

Get pending alerts and issues.

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert_id",
      "type": "urgent_job",
      "severity": "critical",
      "title": "Job LS-2603-0001 waiting 45 mins",
      "message": "Customer at SW1A - lockout",
      "actions": ["view_job", "find_locksmiths"]
    }
  ],
  "summary": { "total": 3, "critical": 1, "warning": 2, "info": 0 }
}
```

---

## Telegram Commands

### Dashboard Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/stats` | Quick dashboard statistics |
| `/today` | Today's job summary |
| `/alerts` | Show pending alerts |

### Job Commands

| Command | Description |
|---------|-------------|
| `/jobs` | List today's jobs |
| `/pending` | Show pending jobs only |
| `/job <number>` | View job details |

### Locksmith Commands

| Command | Description |
|---------|-------------|
| `/locksmiths` | List all locksmiths |
| `/locksmith <id>` | View locksmith details |
| `/availability <id> <on\|off>` | Toggle availability |

### Dispatch Commands

| Command | Description |
|---------|-------------|
| `/dispatch <job_number>` | Find best matches for job |
| `/assign <job> <locksmith>` | Assign job to locksmith |

---

## Intelligent Dispatch

The dispatch algorithm considers:

1. **Distance (35%)**: Closer locksmiths score higher
2. **Rating (25%)**: Higher ratings preferred
3. **Availability (15%)**: Currently available locksmiths prioritized
4. **Response Time (15%)**: Historically fast responders preferred
5. **Workload (10%)**: Fewer active jobs = higher score

### Auto-Dispatch Criteria

A job is recommended for auto-dispatch when:
- Match score ≥ 70%
- Locksmith is available
- Distance ≤ 5 miles
- Rating ≥ 4.0 stars

---

## OpenClaw Configuration

### Option 1: Direct Telegram (No OpenClaw)

The built-in Telegram bot handles commands directly without OpenClaw. This is the default setup and requires no additional configuration.

### Option 2: OpenClaw for Natural Language

For advanced natural language understanding:

1. **Deploy OpenClaw** on a VPS:
   ```bash
   git clone https://github.com/openclaw/openclaw.git
   cd openclaw
   docker-compose up -d
   ```

2. **Configure LockSafe Plugin**:

   Create `plugins/locksafe.json`:
   ```json
   {
     "name": "locksafe",
     "description": "LockSafe UK platform integration",
     "baseUrl": "https://your-domain.com/api/agent",
     "auth": {
       "type": "bearer",
       "token": "${AGENT_API_KEY}"
     },
     "tools": [
       {
         "name": "list_jobs",
         "description": "List jobs with optional filters",
         "endpoint": "GET /jobs",
         "parameters": {
           "status": { "type": "string", "description": "Filter by status" },
           "date": { "type": "string", "description": "today, week, month" }
         }
       },
       {
         "name": "list_locksmiths",
         "description": "List available locksmiths",
         "endpoint": "GET /locksmiths",
         "parameters": {
           "available": { "type": "boolean" },
           "postcode": { "type": "string" }
         }
       },
       {
         "name": "dispatch_job",
         "description": "Find best locksmith for a job",
         "endpoint": "GET /dispatch",
         "parameters": {
           "jobId": { "type": "string", "required": true }
         }
       },
       {
         "name": "assign_job",
         "description": "Assign a job to a locksmith",
         "endpoint": "POST /dispatch",
         "parameters": {
           "jobId": { "type": "string", "required": true },
           "locksmithId": { "type": "string", "required": true }
         }
       }
     ]
   }
   ```

3. **Connect Telegram** in OpenClaw:
   - Add your bot token
   - Set allowed chat IDs
   - Enable the locksafe plugin

---

## Testing

### Test Telegram Webhook

```bash
# Check webhook status
curl "https://your-domain.com/api/agent/telegram"

# Set webhook
curl "https://your-domain.com/api/agent/telegram?setup=true"

# Test with Telegram
# Send /stats to your bot
```

### Test API Endpoints

```bash
# Test authentication
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-domain.com/api/agent/stats

# Test dispatch
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/agent/dispatch?jobId=JOB_ID"
```

### Test from Admin Page

Visit: `https://your-domain.com/admin`

Navigate to the Telegram section and click "Test Connection".

---

## Troubleshooting

### Bot Not Responding

1. Check webhook is set:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

2. Verify chat ID is in `TELEGRAM_ADMIN_CHAT_IDS`

3. Check server logs for errors

### Webhook Errors

1. Ensure HTTPS is configured correctly
2. Check the webhook URL is accessible
3. Verify the bot token is correct

### Authentication Errors

1. Verify `AGENT_API_KEY` is set
2. Check the Authorization header format: `Bearer <key>`
3. Ensure the API key matches

### Dispatch Not Working

1. Check locksmiths have location set (baseLat, baseLng)
2. Verify locksmiths are active and verified
3. Ensure job has coordinates (latitude, longitude)

---

## Security Best Practices

1. **Rotate API Key**: Change `AGENT_API_KEY` periodically
2. **Limit Chat IDs**: Only add trusted admin chat IDs
3. **Monitor Logs**: Check for unauthorized access attempts
4. **Use HTTPS**: Never expose webhook on HTTP
5. **Rate Limiting**: Built-in rate limiting protects against abuse

---

## Cost Estimates

| Component | Monthly Cost |
|-----------|--------------|
| Telegram Bot API | Free |
| LockSafe Server | (existing) |
| OpenClaw VPS (optional) | £20-40 |
| LLM API (if using OpenClaw) | £50-200 |

**Total without OpenClaw**: £0 additional
**Total with OpenClaw**: £70-240/month

---

*Document Version: 1.0*
*Last Updated: March 2026*
