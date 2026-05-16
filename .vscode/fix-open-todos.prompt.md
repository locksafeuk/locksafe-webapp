---
mode: agent
description: Fix all known open TODOs in the LockSafe codebase — implement missing features one by one
---

You are fixing open TODOs in the LockSafe webapp at `/Users/piks/Projects/locksafe-webapp`.

## Known Open TODOs (as of May 2026)

Work through these in priority order. For each TODO:
1. Read the surrounding file fully for context
2. Implement the missing feature
3. Run `npx tsc --noEmit` after each change to verify no type errors
4. Run `npm test` after all changes

---

### 🔴 HIGH — Security

**[1] Resend Webhook Signature Verification**
- File: `src/app/api/webhooks/resend/route.ts` line ~37
- Task: Implement HMAC signature verification for Resend webhooks
- Reference: https://resend.com/docs/dashboard/webhooks/introduction (see `svix-signature` header)
- Pattern: Use `svix` package or manual HMAC-SHA256 with `RESEND_WEBHOOK_SECRET` env var
- Add `RESEND_WEBHOOK_SECRET` to `src/lib/env.ts` Zod schema

---

### 🟡 MEDIUM — Notifications

**[2] Meta Ad Rejection Admin Notification (line 191)**
- File: `src/app/api/webhooks/meta/route.ts` line ~191
- Task: When a Meta ad is rejected, send a notification to admin
- Method: Use `src/lib/email.ts` to email the admin address from `src/lib/config.ts`
- Include: ad ID, rejection reason, timestamp

**[3] Meta Campaign Status Change Admin Notification (line 277)**
- File: `src/app/api/webhooks/meta/route.ts` line ~277
- Task: Notify admin when campaign status changes (active/paused/deleted)
- Same method as above — email + admin Telegram if configured

**[4] Meta Ad Delivery Issue Alert (line 289)**
- File: `src/app/api/webhooks/meta/route.ts` line ~289
- Task: Alert admin when ad delivery issues detected
- Same notification pattern

**[5] Organic Content Generation Email**
- File: `src/app/api/cron/generate-organic/route.ts` line ~227
- Task: Send email summary to admin after organic content batch generation
- Include: number of posts generated, social platform breakdown, next scheduled run

---

### 🟡 MEDIUM — Data Accuracy

**[6] avgResponseTime from Real Data**
- File: `src/lib/locksmith-bot.ts` line ~561
- Task: Replace hardcoded `15 min` with calculated average from actual `Job` records
- Query: find all completed jobs for this locksmith, calculate avg time from `PENDING` → `ACCEPTED` status transition
- Use `Job.statusHistory` or timestamps if available, otherwise calculate from `createdAt` → `acceptedAt`

---

### 🟢 LOW — UX

**[7] Re-enable Marketing Modals**
- File: `src/components/marketing/ModalSystem.tsx` line ~9
- Task: Review the TODO comment, understand why modals were disabled
- Re-enable with whatever fix is needed (likely: add impression tracking or rate-limiting to avoid showing on every page)

---

## After All Fixes

1. Run `npx tsc --noEmit` — must be 0 errors
2. Run `npm test -- --passWithNoTests` — all tests must pass
3. Run `git diff --stat` to summarise changes
4. Suggest a commit message for the changes
