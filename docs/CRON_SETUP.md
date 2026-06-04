# Agent Heartbeat Cron Setup

This guide configures the single heartbeat trigger endpoint used by the agent system.

- Endpoint: `/api/agents/heartbeat`
- Route file: `src/app/api/agents/heartbeat/route.ts`
- Auth behavior: `src/lib/cron-auth.ts`

For the full cron catalog (all cron endpoints, not just agent heartbeat), use `docs/CRON_JOBS_COMPLETE.md` as the source of truth.

## Current Auth Model

The heartbeat endpoint accepts either:

1. Vercel native cron header (`x-vercel-cron: 1`)
2. `Authorization: Bearer <CRON_SECRET>`

If your scheduler is not Vercel-native, you must send the Bearer header.

## Quick Setup (cron-job.org)

1. Create cron job with:
   - URL: `https://your-domain.com/api/agents/heartbeat`
   - Method: `POST` (or `GET`; both are supported)
   - Schedule: every 5 minutes
2. Add header:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

3. Save and enable.

## Vercel Native Cron Setup

If deployed on Vercel, you can use native cron without a Bearer token.

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

## Required Environment Variables

```env
AGENTS_ENABLED=true
CRON_SECRET=your-secure-random-string
OPENAI_API_KEY=sk-...
```

Optional (alerts):

```env
TELEGRAM_ADMIN_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## Verification Commands

Bearer auth check:

```bash
curl -X POST https://your-domain.com/api/agents/heartbeat \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Local check:

```bash
curl -X GET http://localhost:3000/api/agents/heartbeat \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Expected Response Shape

```json
{
  "success": true,
  "message": "Heartbeat completed for N agents",
  "stats": {
    "agentsRun": 0,
    "totalActions": 0,
    "totalCost": 0
  },
  "results": [],
  "timestamp": "2026-06-03T00:00:00.000Z"
}
```

## Troubleshooting

1. 401 Unauthorized: missing/invalid Bearer token and request is not Vercel native cron.
2. success=false with disabled flag: set `AGENTS_ENABLED=true`.
3. Excess error alerts: check OpenAI quota and upstream integration status.
4. No activity: verify agent records are active and heartbeat-enabled in admin.
