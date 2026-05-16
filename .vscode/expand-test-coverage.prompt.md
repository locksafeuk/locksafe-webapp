---
mode: agent
description: Write integration tests for untested LockSafe API routes — auth, jobs, payments, locksmiths
---

You are expanding test coverage for the LockSafe webapp at `/Users/piks/Projects/locksafe-webapp`.

## Context
- Framework: Next.js 16 App Router, MongoDB/Prisma, custom JWT auth
- Test framework: Jest with `src/setupTests.ts` and `jest.config.ts`
- Existing tests: `src/lib/__tests__/`, `src/app/api/retell/__tests__/`
- Mocks: `src/__mocks__/` directory exists
- Auth: custom JWT with `auth_token` cookie (not NextAuth)

## Current coverage gaps (do these in priority order)
1. **Auth routes** — `src/app/api/auth/` (login, register, verify, logout, reset-password)
2. **Job routes** — `src/app/api/jobs/` (create, list, accept, update-status)
3. **Payment routes** — `src/app/api/payments/` (intent, checkout)
4. **Locksmith routes** — `src/app/api/locksmiths/` (profile, availability)
5. **Cron jobs** — `src/app/api/cron/` (signature-reminders, generate-payouts)

## Instructions

Before writing any test:
1. Read the route file fully to understand the handler logic
2. Read `src/__mocks__/` to see existing mocks
3. Read `src/lib/auth.ts` to understand JWT validation
4. Read `jest.config.ts` for module name mappings

For each route test:
- Mock Prisma using `jest.mock('../../lib/db')`
- Mock `src/lib/auth.ts` `verifyAuth()` for protected routes
- Test: happy path, auth failure (401), validation failure (400), not found (404)
- Use `next/server` `NextRequest` to construct requests

## Output
Create test files at `src/app/api/[path]/__tests__/[route-name].test.ts`
After writing, run `npm test` and fix any failures before finishing.
Report: files created, tests written, final pass/fail count.
