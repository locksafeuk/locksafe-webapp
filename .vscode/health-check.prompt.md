---
mode: agent
description: Full LockSafe health check — TypeScript, tests, lint, integration status, open TODOs, and production readiness
---

You are performing a full health check of the LockSafe webapp (`/Users/piks/Projects/locksafe-webapp`). Work through every section below and report findings clearly. Do NOT modify any files.

## 1. Git Status
- Run `git log --oneline -10` and `git status`
- Report current branch, latest commits, any uncommitted changes

## 2. TypeScript & Lint
- Run `npx tsc --noEmit` — report any errors (zero = clean)
- Run `npx eslint src --max-warnings 0` — report warning/error count

## 3. Tests
- Run `npm test -- --passWithNoTests --coverage 2>&1`
- Report: suites, tests passed/failed, coverage %
- Flag any failing tests with file + error

## 4. Build (optional — only run if explicitly asked)
- `npm run build` — confirm 0 errors

## 5. Open TODOs
- Run: `grep -rn "TODO\|FIXME\|HACK" src/ scripts/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
- Group by severity (security TODOs first)

## 6. Known Recurring Issues (check these every run)
- **Resend webhook** — [src/app/api/webhooks/resend/route.ts](src/app/api/webhooks/resend/route.ts) line 37: Is signature verification still TODO?
- **Meta webhook admin notifications** — [src/app/api/webhooks/meta/route.ts](src/app/api/webhooks/meta/route.ts) lines 191, 277, 289: Still TODO?
- **SSE/polling** — [src/lib/useJobNotifications.ts or hooks] — still on polling fallback?
- **OSM tiles** — still failing? Mapbox switched in?
- **ModalSystem** — [src/components/marketing/ModalSystem.tsx](src/components/marketing/ModalSystem.tsx) line 9 — still disabled?

## 7. Cron Jobs
- Verify all 22 cron endpoints exist under `src/app/api/cron/`
- List any new or missing crons vs the reference list in `docs/CRON_JOBS_COMPLETE.md`
- Check for any crons without `CRON_SECRET` authentication

## 8. Dependency Health
- Run `npm outdated 2>&1 | head -30`
- Flag any packages with known security issues

## 9. Env Vars
- Read `src/lib/env.ts` and list all validated env vars
- Flag any vars used in code (grep) but NOT in the Zod schema

## 10. Summary
Present a table:

| Area | Status | Notes |
|------|--------|-------|
| TypeScript | ✅/⚠️/❌ | |
| Lint | ✅/⚠️/❌ | |
| Tests | ✅/⚠️/❌ | X/Y passing |
| Open TODOs | N found | Most critical: ... |
| Cron jobs | ✅/⚠️/❌ | |
| Deps | ✅/⚠️/❌ | |
| Known issues | N still open | |

End with: **Action items for today** (top 3 things to fix).
