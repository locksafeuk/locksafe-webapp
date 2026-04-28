# CMO Autonomy — Operator Runbook (Phase 3)

This is the **only** doc you need to switch the CMO agent from "advisor" to
"autonomous operator". It explains, step-by-step, what to deploy, click,
and verify so the agent can:

1. Draft Google Ads campaigns from analytics signals.
2. Auto-approve drafts that fall inside policy.
3. Publish them PAUSED and let you (or a follow-up cron) flip them live.
4. Run a maintenance loop that adds wasteful queries as negative keywords
   and pauses persistently-underperforming campaigns.
5. Send you a weekly Telegram report.

> **Default posture: SAFE.** Every new install starts with `autonomyEnabled = false`.
> Nothing autonomous happens until you flip the switch in the UI.

---

## 0. Prerequisites

Before turning anything on, confirm:

| Item | How to check |
|---|---|
| Google Ads account already connected and syncing | `/admin/integrations/google-ads` shows campaigns and metrics |
| `CRON_SECRET` set in env | `echo $CRON_SECRET` (already set in `.env`) |
| Telegram bot working | `TELEGRAM_NOTIFICATIONS_ENABLED=true`, you receive Telegram on test events |
| `prisma` client up to date | `npx prisma generate` in the project root |
| TypeScript clean | `npx tsc --noEmit` exits 0 |

---

## 1. Push the new schema to MongoDB

Two new collections are added: `MarketingPolicy` and `DailySpendLedger`.

```bash
npx prisma db push
```

This is non-destructive. It only **adds** collections / indexes; it does not
alter your existing data. Confirm output ends with `🚀 Your database is now in sync with your Prisma schema.`

---

## 2. Deploy the code

```bash
git add -A
git commit -m "Phase 3: CMO autonomy with MarketingPolicy + spend guard"
git push
```

Wait for the Vercel build to go green. The new endpoints are:

| Route | Purpose |
|---|---|
| `GET/POST /api/admin/agents/policy` | Read or update marketing policy |
| `GET /admin/agents/policy` | UI page with kill switch |
| `GET/POST /api/cron/cmo-autonomous` | Optimisation cron (negatives + pause) |
| `GET/POST /api/cron/agents-weekly-report` | Telegram weekly summary |

---

## 3. Set initial policy (still SAFE — autonomy off)

1. Visit **[/admin/agents/policy](https://locksafe.uk/admin/agents/policy)**.
2. Three rows are shown: `global`, `google`, `meta`. All start with
   `autonomyEnabled = false`.
3. **Recommended starting caps** (both `global` and `google`):
   - Max daily spend: **£15**
   - Max monthly spend: **£300**
   - Max per-campaign daily: **£10**
   - Min per-campaign daily: **£2**
   - Auto-approve max (£/day): **£5**  ← deliberately low for week 1
   - Auto-approve weekly cap: **£25**  ← deliberately low for week 1
   - Pause ROAS threshold: **0.5**
   - Pause grace days: **3**
   - Min impressions to pause: **500**
   - Notify on auto-action: **on**
4. Press **Save** on `global`, then **Save** on `google`.
5. Leave `autonomyEnabled` **OFF**. Done — caps are in place if anything
   later flips on.

> Save `meta` too, even though Phase 3 only operates Google Ads autonomously.
> The `global` kill switch reads it as a sanity check.

---

## 4. Add the new cron schedules

### On Vercel (recommended)

Edit `vercel.json` and add the two crons under a `"crons"` array:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/sync-google-ads-performance", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/cmo-autonomous",              "schedule": "30 */6 * * *" },
    { "path": "/api/cron/agents-weekly-report",        "schedule": "0 9 * * 1" }
  ]
}
```

> Vercel sends an `x-vercel-cron` header, so no `Authorization` is needed for
> Vercel-triggered hits.

### On any other scheduler (cron-job.org, GitHub Actions, etc.)

```bash
# Every 6 hours, 30 min offset to let the perf-sync cron land first
0 */6 * * *   curl -X POST https://locksafe.uk/api/cron/sync-google-ads-performance -H "Authorization: Bearer $CRON_SECRET"
30 */6 * * *  curl -X POST https://locksafe.uk/api/cron/cmo-autonomous              -H "Authorization: Bearer $CRON_SECRET"
0 9 * * 1     curl -X POST https://locksafe.uk/api/cron/agents-weekly-report        -H "Authorization: Bearer $CRON_SECRET"
```

While autonomy is OFF, `cmo-autonomous` will return `{ ok: true, skipped: "autonomy disabled" }` — safe to leave running.

---

## 5. Smoke test (autonomy still OFF)

While the kill switch is on, every autonomous path should refuse to act.
Run these to verify the rails work BEFORE you trust the agent:

```bash
# Should return autonomy disabled
curl -X POST https://locksafe.uk/api/cron/cmo-autonomous \
     -H "Authorization: Bearer $CRON_SECRET"

# Should still send a Telegram weekly summary regardless of autonomy
curl -X POST https://locksafe.uk/api/cron/agents-weekly-report \
     -H "Authorization: Bearer $CRON_SECRET"
```

Confirm:
- The `cmo-autonomous` response says `skipped: "autonomy disabled"`.
- A Telegram message titled **"CMO weekly report"** lands in your channel.

---

## 6. First supervised draft (still autonomy OFF)

Even with autonomy off, you can hand-trigger the agent to file a draft for
your review.

1. From the AI command line / agents console (or wherever you run agent
   tools), call **`createGoogleAdsDraft`** with a small budget, e.g.
   `dailyBudget: 5`, `theme: "emergency-locksmith-london"`, `keywords: [...]`.
2. The tool will:
   - Generate the RSA + keywords + negatives via OpenAI.
   - Create a `GoogleAdsCampaignDraft` row with `status = PENDING_APPROVAL`.
   - Create a paired `AgentApproval` row.
3. Visit **[/admin/integrations/google-ads/drafts](https://locksafe.uk/admin/integrations/google-ads/drafts)**.
4. Open the draft, sanity-check headlines/descriptions/keywords, click
   **Approve**. The status flips to `APPROVED`.
5. Click **Publish**. The publish route runs the spend-guard check first
   (`platform: google`, `action: publish_draft`, `initiator: admin`) and
   then writes the campaign to Google Ads in **PAUSED** state. Review it
   inside Google Ads itself before un-pausing.

If anything in this flow fails, fix it BEFORE enabling autonomy.

---

## 7. Turn autonomy ON (gradually)

This is the only step that gives the agent real budget.

1. **[/admin/agents/policy](https://locksafe.uk/admin/agents/policy)**.
2. On the `google` row, tick **Autonomy enabled** → **Save google**.
3. On the `global` row, tick **Autonomy enabled** → **Save global**.

   Both must be on; either one off is treated as the kill switch.

From this moment on:

- New `createGoogleAdsDraft` calls inside `autoApproveMaxBudget` (£5/day in
  the recommended config) auto-resolve their approval row and flip the
  draft to `APPROVED` — visible in the drafts UI as `approvedBy: system:auto-approve`.
- Drafts above that budget stay `PENDING_APPROVAL` for you.
- The `cmo-autonomous` cron starts adding negative keywords (search terms
  with ≥5 clicks and 0 conversions) and pausing campaigns where the policy's
  ROAS / grace-day / impression thresholds are all exceeded.
- Each auto-action sends a Telegram alert if `notifyOnAutoAction = true`.

---

## 8. The kill switch

If anything looks wrong:

1. **[/admin/agents/policy](https://locksafe.uk/admin/agents/policy)**.
2. Click the red **Stop everything** button at the top.
3. Confirm the dialog.

This sets `autonomyEnabled = false` on every row in `MarketingPolicy`.
Within seconds:
- `cmo-autonomous` cron will skip on its next tick.
- `createGoogleAdsDraft` auto-approve path is closed; new drafts file as
  `PENDING_APPROVAL`.
- `publishGoogleAdsDraft` (admin click) still works because admin ops are
  not gated on `autonomyEnabled` — they are still gated on hard caps.

> The kill switch does **NOT** pause already-live Google Ads campaigns.
> If you also want to pause them, do it manually via
> `/admin/integrations/google-ads/drafts` (use **Pause** on each
> `PUBLISHED` draft) or directly in the Google Ads UI.

---

## 9. Tuning after week 1

Once you trust the agent:

| Knob | Default | Suggestion after week 1 |
|---|---|---|
| `autoApproveMaxBudget` | £5/day | raise to £10/day |
| `maxWeeklyAutoApproveSpend` | £25 | raise to £50 |
| `maxDailySpend` (google) | £15 | raise as ROAS allows |
| `pauseRoasThreshold` | 0.5 | raise to 0.8 once volume is healthy |
| `pauseGraceDays` | 3 | drop to 2 once you trust the data |

Edit those values on `/admin/agents/policy` and click **Save google**.
Changes take effect on the next cron tick.

---

## 10. What gets logged where

| Surface | Contents |
|---|---|
| `GoogleAdsCampaignDraft` | One row per draft. `approvedBy = system:auto-approve` for autonomous approvals. `pausedAt` set when optimiser pauses a campaign. |
| `AgentApproval` | One row per draft. `resolution` text records why it was auto-approved. |
| `AgentExecution` | One row per tool invocation. Costs and errors live here. |
| `DailySpendLedger` | Best-effort daily snapshot per platform. Cached; spend-guard reads `AdPerformanceSnapshot` first and falls back to this. |
| `MarketingPolicy` | The live caps and kill-switch state. `updatedBy` records who last edited. |
| Telegram channel `$TELEGRAM_CHAT_ID` | Auto-action alerts + weekly report. |
| Vercel logs | All cron and route logs are prefixed `[policy]`, `[cron:cmo-autonomous]`, `[optimise]`, `[CMO]`. |

---

## 11. Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `Spend guard blocked publish` 403 | Daily/monthly cap reached, or campaign daily > policy max | Raise the matching cap on `/admin/agents/policy`, or wait for next day. |
| `Autonomy disabled for google` | Either `global` or `google` row has `autonomyEnabled = false` | Tick both on the policy page. |
| Drafts file but never auto-approve | Daily budget > `autoApproveMaxBudget`, or projected weekly > `maxWeeklyAutoApproveSpend` | Lower the requested `dailyBudget` OR raise the auto-approve caps. |
| Optimiser logs `failed pausing campaign …` | Google Ads OAuth scope expired, or the campaign was deleted out-of-band | Reconnect Google Ads OAuth at `/admin/integrations/google-ads`. |
| No Telegram on auto-action | `notifyOnAutoAction = false`, or `TELEGRAM_NOTIFICATIONS_ENABLED != true` | Tick **Notify on auto-action** on the policy page; check `.env`. |

---

## TL;DR for the impatient

```bash
# 1. push schema
npx prisma db push

# 2. deploy
git add -A && git commit -m "Phase 3 autonomy" && git push

# 3. configure
# open https://locksafe.uk/admin/agents/policy → save policy with autonomy OFF

# 4. add crons (Vercel: vercel.json crons block, or any external scheduler)

# 5. smoke test
curl -X POST https://locksafe.uk/api/cron/cmo-autonomous -H "Authorization: Bearer $CRON_SECRET"
curl -X POST https://locksafe.uk/api/cron/agents-weekly-report -H "Authorization: Bearer $CRON_SECRET"

# 6. once happy → flip autonomy ON for global + google on the policy page
# 7. if anything goes wrong → "Stop everything" button on the same page
```
