# Agent Heartbeat Cron Job Setup

The AI Agent Operating System requires periodic heartbeat triggers to run agent tasks. This document explains how to set up the cron job using [cron-job.org](https://cron-job.org) (free) or other scheduling services.

## Quick Setup (cron-job.org)

### 1. Create Account
Go to [cron-job.org](https://cron-job.org) and create a free account.

### 2. Create New Cron Job

Click "Create Cronjob" and configure:

| Field | Value |
|-------|-------|
| **Title** | LockSafe Agent Heartbeat |
| **URL** | `https://your-domain.com/api/agents/heartbeat` |
| **Schedule** | Every 5 minutes |
| **Request Method** | GET (or POST) |
| **Request Timeout** | 30 seconds |

### 3. Add Authorization Header

In the "Advanced" section, add a custom header:

```
Authorization: Bearer YOUR_CRON_SECRET
```

Replace `YOUR_CRON_SECRET` with the value of your `CRON_SECRET` environment variable.

### 4. Enable and Save

Enable the cron job and save. It will now run every 5 minutes.

---

## Environment Variables

Make sure these are set in your deployment:

```env
# Required for agent system
OPENAI_API_KEY=sk-your-openai-key
CRON_SECRET=your-secure-random-string

# Optional - for Telegram notifications
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

---

## Alternative Scheduling Options

### Netlify Scheduled Functions

If deployed to Netlify, you can use Scheduled Functions:

1. Create `netlify/functions/agent-heartbeat.mts`:

```typescript
import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  const response = await fetch(`${process.env.URL}/api/agents/heartbeat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    }
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), { status: 200 });
};

export const config: Config = {
  schedule: "*/5 * * * *"
};
```

2. Deploy - Netlify will automatically run this every 5 minutes.

### Vercel Cron

If using Vercel, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/agents/heartbeat",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### GitHub Actions

Create `.github/workflows/heartbeat.yml`:

```yaml
name: Agent Heartbeat
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  heartbeat:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Heartbeat
        run: |
          curl -X POST "${{ secrets.SITE_URL }}/api/agents/heartbeat" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## Testing the Endpoint

### Manual Test (no auth required in dev)

```bash
curl -X GET http://localhost:3000/api/agents/heartbeat
```

### With Authorization

```bash
curl -X POST https://your-domain.com/api/agents/heartbeat \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Expected Response

```json
{
  "success": true,
  "message": "Heartbeat completed for 3 agents",
  "stats": {
    "agentsRun": 3,
    "totalActions": 5,
    "totalCost": 0.0123
  },
  "results": [
    {
      "agentName": "CEO Agent",
      "success": true,
      "actionsExecuted": 2,
      "costUsd": 0.0045,
      "errors": []
    },
    {
      "agentName": "COO Agent",
      "success": true,
      "actionsExecuted": 2,
      "costUsd": 0.0041,
      "errors": []
    },
    {
      "agentName": "CMO Agent",
      "success": true,
      "actionsExecuted": 1,
      "costUsd": 0.0037,
      "errors": []
    }
  ],
  "timestamp": "2026-03-24T12:00:00.000Z"
}
```

---

## Monitoring

### Telegram Notifications

Agents automatically send Telegram notifications when:
- Heartbeat completes with errors
- Important actions are taken
- Issues require attention

### Admin Dashboard

Visit `/admin/agents` to see:
- Agent status (active/paused)
- Budget usage
- Pending tasks
- Execution history
- Pending approvals

### Telegram Commands

```
/agents        - View all agent statuses
/agent_ceo     - CEO agent details
/agent_coo     - COO agent details
/agent_cmo     - CMO agent details
/agent_budget  - Budget overview
/agent_run     - Manually trigger heartbeats
/weekly        - Generate weekly summary
```

---

## Troubleshooting

### Heartbeat Not Running

1. Check cron job is enabled
2. Verify URL is correct
3. Check authorization header
4. Look at cron-job.org execution logs

### Agents Not Executing

1. Run `/agent_run` in Telegram to manually trigger
2. Check agent status is "active"
3. Verify OpenAI API key is set
4. Check budget hasn't been exhausted

### High Costs

1. Review agent budgets in admin dashboard
2. Pause expensive agents temporarily
3. Reduce heartbeat frequency
4. Check for runaway executions

---

## Agent Heartbeat Schedules

| Agent | Default Schedule | Purpose |
|-------|-----------------|---------|
| CEO | Every 4 hours | Strategic oversight |
| COO | Every 5 minutes | Real-time operations |
| CMO | Every 2 hours | Campaign monitoring |

The heartbeat API triggers all due agents based on their individual schedules.

---

*Last updated: March 2026*
