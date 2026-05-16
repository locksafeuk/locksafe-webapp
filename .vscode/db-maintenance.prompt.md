---
mode: agent
description: Database maintenance — check Prisma schema health, indexes, model consistency, seeding for missing data
---

You are performing database maintenance for the LockSafe webapp at `/Users/piks/Projects/locksafe-webapp`.

## 1. Schema Health Check
- Read `prisma/schema.prisma` fully
- List all models and their field counts
- Flag any models that are referenced in relations but not defined
- Check for missing `@@index` on frequently queried fields:
  - `Job`: postcode, status, locksmithId, customerId, createdAt
  - `Locksmith`: coverageRadius (lat/lng), performanceScore, insuranceStatus
  - `VoiceCall`: createdAt, status
  - `Ad`: metaAdId, status

## 2. Missing GPS Geo Indexing
The `Job` model has GPS fields but they're stored as JSON, not geo-indexed.
- Identify all GPS fields on `Job` (latitude, longitude, etc.)
- Propose the best approach: MongoDB 2dsphere index or application-level distance filtering
- If the codebase uses application-level filtering already, verify the approach in `src/lib/locksmith-matcher.ts`

## 3. Seeding Gaps
- Read `prisma/seed-production.ts` to understand what data gets seeded
- Grep for `404` or "not found" patterns that relate to missing seed data
- From docs/QA_BUG_REPORT.md: `/emergency-locksmith-london` and `/intent/locked-out` return 404 — trace why and what seeding is needed
- Check `scripts/seed-intent-landings.ts` and `scripts/seed-keyword-templates.ts` — have they been run?

## 4. Stale Test Data
- From session memory: test job SW1-JOB110 (ID `6a05736760df1b90f550daa5`) was created during testing
- Remind user to delete this from the admin panel at `/admin/jobs`

## 5. Insurance Expiry Automation
- Check if `/api/cron/insurance-reminders` handles auto-expiry of policies
- If it only sends reminders (not expires), note that insurance should be auto-set to `EXPIRED` if expiry date passes

## 6. Indexes to Add
Based on the audit, propose specific Prisma schema index additions:
```prisma
// Example — do NOT add without review
@@index([status, createdAt])
@@index([locksmithId, status])
```
Show what to add and which model, but DO NOT modify the schema file unless explicitly asked.

## 7. Summary
Report:
- Models: N total
- Missing indexes: N
- Seeding gaps: list
- Stale data: list
- Recommended schema changes: list (but do not apply)
