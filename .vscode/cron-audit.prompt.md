---
mode: agent
description: Monitor and validate all 22 LockSafe cron jobs — check auth, logic, scheduling, and missing jobs
---

You are auditing the LockSafe cron job system at `/Users/piks/Projects/locksafe-webapp/src/app/api/cron/`.

## 1. Inventory Check
List every directory under `src/app/api/cron/` and verify against this expected set:

| Expected Cron | Expected File |
|---|---|
| advance-auctions | route.ts |
| agents-weekly-report | route.ts |
| auto-redispatch | route.ts |
| availability-schedule | route.ts |
| cleanup-blacklisted-tokens | route.ts |
| cmo-autonomous | route.ts |
| dispatch-scheduled-jobs | route.ts |
| generate-invoices | route.ts |
| generate-organic | route.ts |
| generate-payouts | route.ts |
| insurance-reminders | route.ts |
| performance-scores | route.ts |
| publish-organic | route.ts |
| review-requests | route.ts |
| send-holding-metrics | route.ts |
| signature-reminders | route.ts |
| sla-monitor | route.ts |
| sync-commission-tiers | route.ts |
| sync-google-ads-performance | route.ts |
| sync-meta-performance | route.ts |
| win-back | route.ts |

Report: any extras (new crons added), any missing from the list.

## 2. Security Audit
For each cron route, verify it has `CRON_SECRET` authentication. Pattern should be:
```typescript
const secret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret')
if (secret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
Flag any cron routes missing this check.

## 3. Critical Cron Logic Review

**signature-reminders** — read fully:
- Does it query jobs in COMPLETED status awaiting signature?
- Does it send push notifications + email?
- Is there a max-resend guard (don't spam)?

**generate-payouts** — read fully:
- Does it calculate platform fee correctly?
- Does it use the locksmith's `commissionRate` or `LocksmithCompanyMember.locksmithSplit`?
- Is there a duplicate-payout guard?

**advance-auctions** — read fully:
- Does it advance `JobAuction.currentStep` from 0→3?
- Does it correctly reduce the commission rate (40%→25%)?
- Is there a guard against advancing past step 3?

**auto-redispatch** — read fully:
- What triggers redispatch? (timeout, no applications?)
- Does it notify new locksmiths after redispatch?

## 4. Scheduling Recommendations
Based on the logic, suggest optimal cron-job.org schedule for any crons that don't have one clearly documented in `docs/CRON_JOBS_COMPLETE.md`.

## 5. Summary Table

| Cron | Has Auth | Logic OK | Schedule Correct | Issues |
|------|----------|----------|------------------|--------|
| advance-auctions | ✅/❌ | ✅/⚠️/❌ | ✅/⚠️ | |
| ... | | | | |

End with: **Any crons that need immediate attention**.
