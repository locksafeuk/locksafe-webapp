# Complete Cron Jobs Setup Guide

## Overview

LockSafe UK requires **7 cron jobs** to be fully operational, plus several optional automation jobs. Endpoints are protected by cron auth (`Authorization: Bearer CRON_SECRET`) or Vercel native cron header (`x-vercel-cron: 1`).

---

## Quick Reference Table

| # | Cron Job | Endpoint | Frequency | Priority |
|---|----------|----------|-----------|----------|
| 1 | Signature Reminders | `/api/cron/signature-reminders` | Every 15 min | **CRITICAL** |
| 2 | Availability Schedule | `/api/cron/availability-schedule` | Every 5 min | **HIGH** |
| 3 | Generate Payouts | `/api/cron/generate-payouts` | Weekly (Mon 2AM) | **HIGH** |
| 4 | Insurance Reminders | `/api/cron/insurance-reminders` | Daily (9AM) | **MEDIUM** |
| 5 | Publish Organic Posts | `/api/cron/publish-organic` | Every 5 min | OPTIONAL |
| 6 | Generate Organic Content | `/api/cron/generate-organic` | Daily (6AM) | OPTIONAL |
| 7 | Sync Meta Performance | `/api/cron/sync-meta-performance` | Every 6 hours | OPTIONAL |
| 8 | Sync Google Ads Performance | `/api/cron/sync-google-ads-performance` | Every 6 hours | OPTIONAL (CMO autonomous loop) |
| 9 | CMO Autonomous Optimisation | `/api/cron/cmo-autonomous` | Every 6 hours | OPTIONAL (Phase 3 — adds negative keywords, pauses bad campaigns) |
| 10 | Agents Weekly Report | `/api/cron/agents-weekly-report` | Mondays 9AM | OPTIONAL (Phase 3 — Telegram weekly summary) |
| 11 | Sync Google Ads Geo Targets | `/api/cron/sync-google-ads-geo-targets` | Daily (3AM UTC) | OPTIONAL (auto-adjusts location targeting to active locksmith coverage) |

---

## Step 1: Set Environment Variable

First, add `CRON_SECRET` to your environment:

```bash
# Generate a secure secret
openssl rand -hex 32
```

Add to your `.env` (and Netlify environment variables):
```env
CRON_SECRET="your-64-character-hex-string-here"
```

> Security note: never paste your real `CRON_SECRET` into docs, screenshots, or logs.

---

## Step 2: Choose a Cron Service

### Option A: cron-job.org (Recommended - Free)
- **URL:** https://cron-job.org
- **Free tier:** Unlimited jobs, 1 request/minute minimum
- **Pros:** Easy setup, email notifications, execution logs

### Option B: EasyCron
- **URL:** https://www.easycron.com
- **Free tier:** 200 executions/month

### Option C: UptimeRobot
- **URL:** https://uptimerobot.com
- **Free tier:** 50 monitors, 5-minute intervals

### Option D: Vercel Cron (if using Vercel)
Add to `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/signature-reminders", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/availability-schedule", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/generate-payouts", "schedule": "0 2 * * 1" },
    { "path": "/api/cron/insurance-reminders", "schedule": "0 9 * * *" }
  ]
}
```

---

## Step 3: Create Each Cron Job

### Cron Job 1: Signature Reminders ⭐ CRITICAL

**Purpose:** Sends reminders to customers who haven't signed completed jobs, auto-completes after 24 hours.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Signature Reminders |
| **URL** | `https://YOUR_DOMAIN/api/cron/signature-reminders` |
| **Method** | GET |
| **Schedule** | Every 15 minutes |
| **Cron Expression** | `*/15 * * * *` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |

**Reminder Schedule:**
| Reminder # | Time After Work Complete | Urgency |
|------------|-------------------------|---------|
| 1 | 1 hour | Normal |
| 2 | 4 hours | Normal |
| 3 | 12 hours | Medium |
| 4 | 20 hours | **Urgent** |
| Auto-Complete | 24 hours | - |

---

### Cron Job 2: Availability Schedule ⭐ HIGH

**Purpose:** Automatically toggles locksmith availability based on their working hours schedule.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Availability Schedule |
| **URL** | `https://YOUR_DOMAIN/api/cron/availability-schedule` |
| **Method** | GET |
| **Schedule** | Every 5 minutes |
| **Cron Expression** | `*/5 * * * *` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |

---

### Cron Job 3: Generate Payouts ⭐ HIGH

**Purpose:** Creates pending payout records for locksmiths from completed jobs.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Weekly Payouts |
| **URL** | `https://YOUR_DOMAIN/api/cron/generate-payouts` |
| **Method** | POST |
| **Schedule** | Weekly - Monday at 2:00 AM |
| **Cron Expression** | `0 2 * * 1` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |
| **Body** | `{}` (empty JSON) |

---

### Cron Job 4: Insurance Reminders ⭐ MEDIUM

**Purpose:** Sends email reminders to locksmiths about expiring insurance certificates.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Insurance Reminders |
| **URL** | `https://YOUR_DOMAIN/api/cron/insurance-reminders?secret=YOUR_CRON_SECRET` |
| **Method** | GET |
| **Schedule** | Daily at 9:00 AM |
| **Cron Expression** | `0 9 * * *` |

**Note:** This endpoint uses query param `?secret=` instead of header.

**Reminder Thresholds:**
- 30 days before expiry
- 14 days before expiry
- 7 days before expiry
- 3 days before expiry
- 1 day before expiry
- Day of expiry
- 1 day after (expired)
- Weekly after that

---

### Cron Job 5: Publish Organic Posts (Optional)

**Purpose:** Auto-publishes scheduled social media posts to Facebook/Instagram.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Publish Organic |
| **URL** | `https://YOUR_DOMAIN/api/cron/publish-organic` |
| **Method** | GET |
| **Schedule** | Every 5 minutes |
| **Cron Expression** | `*/5 * * * *` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |

**Requires:** Meta/Facebook API configured

---

### Cron Job 6: Generate Organic Content (Optional)

**Purpose:** Uses AI to generate social media posts for the content pipeline.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Generate Organic |
| **URL** | `https://YOUR_DOMAIN/api/cron/generate-organic` |
| **Method** | GET |
| **Schedule** | Daily at 6:00 AM |
| **Cron Expression** | `0 6 * * *` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |

**Requires:** OpenAI API key, Autopilot enabled in admin

---

### Cron Job 7: Sync Meta Performance (Optional)

**Purpose:** Syncs ad performance metrics from Meta Ads API.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Meta Sync |
| **URL** | `https://YOUR_DOMAIN/api/cron/sync-meta-performance` |
| **Method** | POST |
| **Schedule** | Every 6 hours |
| **Cron Expression** | `0 */6 * * *` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |
| **Body** | `{"includeSnapshots": true}` |

**Requires:** Meta Marketing API configured

---

### Cron Job 8: Sync Google Ads Performance (Optional)

**Purpose:** Pulls daily campaign metrics from every connected Google Ads account into the local DB for CMO agent reporting.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Google Ads Performance Sync |
| **URL** | `https://YOUR_DOMAIN/api/cron/sync-google-ads-performance` |
| **Method** | POST |
| **Schedule** | Every 6 hours |
| **Cron Expression** | `0 */6 * * *` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |

**Requires:** Google Ads account connected at `/admin/integrations/google-ads`

---

### Cron Job 9: CMO Autonomous Optimisation (Optional)

**Purpose:** AI-driven campaign hygiene — adds negative keywords from wasted search terms, pauses persistently underperforming campaigns. No-ops when autonomy is disabled in MarketingPolicy.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe CMO Autonomous |
| **URL** | `https://YOUR_DOMAIN/api/cron/cmo-autonomous` |
| **Method** | POST |
| **Schedule** | Every 6 hours |
| **Cron Expression** | `0 */6 * * *` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |

**Requires:** Google Ads account connected, `MarketingPolicy.autonomyEnabled = true`

---

### Cron Job 10: Agents Weekly Report (Optional)

**Purpose:** Sends a Telegram summary of all agent activity, ad spend, and campaign performance over the past 7 days.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Agents Weekly Report |
| **URL** | `https://YOUR_DOMAIN/api/cron/agents-weekly-report` |
| **Method** | POST |
| **Schedule** | Mondays at 9:00 AM |
| **Cron Expression** | `0 9 * * 1` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |

**Requires:** Telegram bot configured

---

### Cron Job 11: Sync Google Ads Geo Targets (Optional)

**Purpose:** Daily safety-net that re-syncs location targeting on all live Google Ads campaigns to match the current active locksmith coverage. Automatically **adds** cities where new locksmiths are based and **removes** cities where coverage has dropped.

This complements the real-time trigger that fires whenever a locksmith completes onboarding — the cron catches any drift from manual DB changes or locksmiths who deactivated between onboarding events.

| Setting | Value |
|---------|-------|
| **Title** | LockSafe Google Ads Geo Sync |
| **URL** | `https://YOUR_DOMAIN/api/cron/sync-google-ads-geo-targets` |
| **Method** | POST |
| **Schedule** | Daily at 3:00 AM UTC |
| **Cron Expression** | `0 3 * * *` |
| **Header** | `Authorization: Bearer YOUR_CRON_SECRET` |

**Expected response:**
```json
{
  "success": true,
  "campaignsSynced": 3,
  "coverageSummary": ["London", "Manchester", "Birmingham"],
  "errors": [],
  "durationMs": 1240,
  "timestamp": "2026-05-13T03:00:01.000Z"
}
```

**Requires:** Google Ads account connected at `/admin/integrations/google-ads`

**How it works:**
1. Queries all `Locksmith` records where `isActive=true` and `onboardingCompleted=true`
2. Resolves each locksmith's `baseAddress` / lat+lng to a Google Ads GeoTargetConstant ID
3. For every PUBLISHED campaign: removes old location criteria, adds the new set
4. Sends a Telegram admin alert with the updated coverage summary
5. Delegates a CMO agent task if coverage changed significantly

> **Note:** Also triggered automatically (real-time) when a locksmith hits `/api/locksmith/accept-terms`. The cron is a reconciliation safety net, not the primary trigger.

---

## Step 4: Verify Setup

### Test Each Endpoint Manually

```bash
# Replace YOUR_DOMAIN and YOUR_CRON_SECRET

# 1. Signature Reminders
curl -X GET "https://YOUR_DOMAIN/api/cron/signature-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 2. Availability Schedule
curl -X GET "https://YOUR_DOMAIN/api/cron/availability-schedule" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 3. Generate Payouts
curl -X POST "https://YOUR_DOMAIN/api/cron/generate-payouts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Insurance Reminders
curl -X GET "https://YOUR_DOMAIN/api/cron/insurance-reminders?secret=YOUR_CRON_SECRET"

# 5. Publish Organic
curl -X GET "https://YOUR_DOMAIN/api/cron/publish-organic" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 6. Generate Organic
curl -X GET "https://YOUR_DOMAIN/api/cron/generate-organic" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 7. Sync Meta
curl -X POST "https://YOUR_DOMAIN/api/cron/sync-meta-performance" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"includeSnapshots": true}'

# 8. Sync Google Ads Performance
curl -X POST "https://YOUR_DOMAIN/api/cron/sync-google-ads-performance" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 9. CMO Autonomous
curl -X POST "https://YOUR_DOMAIN/api/cron/cmo-autonomous" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 10. Agents Weekly Report
curl -X POST "https://YOUR_DOMAIN/api/cron/agents-weekly-report" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 11. Sync Google Ads Geo Targets
curl -X POST "https://YOUR_DOMAIN/api/cron/sync-google-ads-geo-targets" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Expected Responses

**Successful response:**
```json
{
  "success": true,
  "results": {...},
  "timestamp": "2026-03-15T12:00:00.000Z"
}
```

**Unauthorized (wrong secret):**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## Step-by-Step: cron-job.org Setup

### 1. Create Account
1. Go to https://cron-job.org
2. Click "Sign Up"
3. Create free account & verify email

### 2. Create First Cron Job
1. Click "CREATE CRONJOB"
2. Fill in:
   - **Title:** LockSafe Signature Reminders
   - **URL:** `https://locksafe.uk/api/cron/signature-reminders`
   - **Schedule:** Custom → Minutes: `0,15,30,45` → Hours: `*`
   - **Request Method:** GET

3. Click "Show Advanced Settings"
4. Add header:
   - **Name:** `Authorization`
   - **Value:** `Bearer c4bcc756c1e53c197c9772ae60fdb0f4a6ebcb726b5db47f6c4c6d92307ddd42`

5. Click "CREATE"
6. Ensure "Enabled" is checked

### 3. Repeat for All Critical Jobs

Create these 4 essential cron jobs:

| Job | Schedule |
|-----|----------|
| Signature Reminders | `*/15 * * * *` |
| Availability Schedule | `*/5 * * * *` |
| Generate Payouts | `0 2 * * 1` (Mondays 2AM) |
| Insurance Reminders | `0 9 * * *` (Daily 9AM) |

---

## Monitoring & Troubleshooting

### Check Logs
- cron-job.org shows execution history
- View server logs in Netlify dashboard
- Check email for failure notifications

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check CRON_SECRET matches |
| Timeout | Endpoint may be slow, check server |
| No jobs processed | Verify database has eligible records |
| Rate limiting | Reduce frequency or batch operations |

### Health Check Endpoints

Some endpoints have GET health checks:
```bash
# Payouts status
curl "https://YOUR_DOMAIN/api/cron/generate-payouts"

# Meta sync status
curl "https://YOUR_DOMAIN/api/cron/sync-meta-performance"
```

---

## Minimum Required Setup

For the system to work properly, you **MUST** configure:

| Priority | Cron Job | Why |
|----------|----------|-----|
| 🔴 CRITICAL | Signature Reminders | Auto-completes jobs, ensures payments |
| 🟠 HIGH | Availability Schedule | Auto on/off for locksmiths |
| 🟠 HIGH | Generate Payouts | Creates locksmith earnings |
| 🟡 MEDIUM | Insurance Reminders | Compliance/safety |

The other 3 (organic content, meta sync) are **optional** and only needed if you're using those features.

---

## Quick Setup Checklist

- [ ] `CRON_SECRET` set in Netlify environment variables
- [ ] Account created on cron-job.org (or alternative)
- [ ] Signature Reminders cron created (every 15 min)
- [ ] Availability Schedule cron created (every 5 min)
- [ ] Generate Payouts cron created (weekly Monday)
- [ ] Insurance Reminders cron created (daily)
- [ ] All cron jobs tested manually
- [ ] Execution logs verified in cron service
- [ ] Email notifications enabled for failures
- [ ] Google Ads Geo Sync cron created (daily 3AM UTC) — if Google Ads is connected
