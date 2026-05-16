---
mode: agent
description: Security audit — check webhook signatures, auth hardening, env vars, OWASP Top 10 for LockSafe
---

You are performing a security audit of the LockSafe webapp at `/Users/piks/Projects/locksafe-webapp`. Do NOT modify any files — report issues only.

## OWASP Top 10 Checklist for LockSafe

### A01 — Broken Access Control
- Read `src/middleware.ts` — are all admin/locksmith/customer routes protected?
- Check each `src/app/api/` route: does it call `verifyAuth()` or equivalent before returning data?
- Are there any routes that return other users' data without ownership checks?

### A02 — Cryptographic Failures
- Is `JWT_SECRET` enforced as min-length in `src/lib/env.ts`?
- Are passwords hashed with bcrypt? Check `src/lib/auth.ts`
- Is HTTPS enforced? Check `next.config.js` security headers

### A03 — Injection
- Are all Prisma queries using parameterized inputs (not raw string concat)?
- Are `$queryRaw` / `$executeRaw` calls in use anywhere? (`grep -rn "queryRaw\|executeRaw" src/`)
- Is user input sanitised before being passed to OpenAI prompts?

### A04 — Insecure Design
- Read `src/app/api/webhooks/resend/route.ts` — **is signature verification still TODO?** This is the #1 known issue.
- Read `src/app/api/webhooks/meta/route.ts` — is Meta webhook signature validated?
- Read `src/lib/retell-auth.ts` — is Retell HMAC verification in place?
- Are Stripe webhooks verified with `stripe.webhooks.constructEvent()`?

### A05 — Security Misconfiguration
- Read `next.config.js` — list all security headers (CSP, HSTS, X-Frame-Options, etc.)
- Is `NODE_ENV=production` enforced for strict env validation?
- Are any dev/debug endpoints exposed in production?

### A06 — Vulnerable & Outdated Components
- Run `npm audit 2>&1` — list any HIGH or CRITICAL vulnerabilities

### A07 — Authentication & Auth Failures
- Is there brute-force protection on `/api/auth/login`?
- Are rate limits applied? Check `src/middleware.ts` (100 req/60s — sufficient?)
- Is the token blacklist cron running? (`/api/cron/cleanup-blacklisted-tokens`)

### A08 — Software & Data Integrity
- Are cron endpoints protected by `CRON_SECRET`? Check 3 random cron files.
- Is the `CRON_SECRET` in the env schema?

### A09 — Security Logging & Monitoring
- Is Sentry configured on all 3 surfaces (client, server, edge)?
- Are auth failures logged?
- Are payment errors sent to Sentry?

### A10 — SSRF
- Does the app make outbound HTTP requests with user-controlled URLs?
- Check: postcode lookup, address autocomplete, any proxy routes

## Output Format

For each finding:
```
[SEVERITY: CRITICAL/HIGH/MEDIUM/LOW/INFO]
File: path/to/file.ts (line N)
Issue: <description>
Recommendation: <fix>
```

End with a **Security Score** (X/10) and top 3 fixes to implement immediately.
