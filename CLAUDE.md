# LockSafe webapp — working notes for Claude

## 🚀 Deployment — ONE path only (important)

There is a **single, agreed deploy path**:

```
./ship.sh "message"   →   git push   →   Vercel ↔ GitHub integration (piky-boy)   →   production
```

- **Deploy is automatic on push** via the **piky-boy** GitHub integration. That
  is the only deployer.
- **NEVER run `vercel --prod`** (and never add it back to `ship.sh`). It creates
  a **second, duplicate deployment** — the **"locksafeuk" CLI** one — for the
  exact same commit, alongside the piky-boy deploy. We removed it on 2026-06-10.
  One push = one deploy, from piky-boy.
- If you ever see two deployments per commit in Vercel again, something
  re-introduced a CLI/`vercel --prod` deploy — remove it.

Build command (in `vercel.json`): `npx prisma generate && next build`.

## Sandbox constraints (how Claude works here)

- Claude **edits files only**; the user runs `./ship.sh` to commit + push
  (Claude's sandbox can't push — no SSH key).
- **MongoDB Atlas SRV is blocked** from the sandbox — can't query the DB
  directly; use admin API endpoints (logged-in browser) or scripts run on the Mac.
- **Prisma engine can't download** in the sandbox. After a `schema.prisma`
  change, run `npx prisma generate` on the Mac **before** `./ship.sh` (the
  pre-push typecheck needs the regenerated client). Mongo needs no migration —
  generate is enough.

## Stack

Next.js 16 (Turbopack) · Prisma + MongoDB Atlas · Vercel (region lhr1) ·
local Ollama `qwen3:32b` on the Mac Studio (via Tailscale funnel, `OLLAMA_BASE_URL`)
as the primary LLM, OpenAI as opt-in fallback.

## Lockie (the AI assistant)

Lockie = one brain, two personas (locksmith + customer), across WhatsApp + SMS.
Full reference: **`docs/LOCKIE.md`**. Key feature flags: `CUSTOMER_SMS_AUTOREPLY`,
`CUSTOMER_WHATSAPP_AGENTIC`.

## Operational guardrails

- **Reasonable hours:** never broadcast/outreach to locksmiths' or customers'
  phones outside ~09:00–20:00 UK. The app-update broadcast enforces this; apply
  the same judgement to any new outbound.
- **Gated engines (Vercel env):** `SMS_OUTREACH_ENABLED`,
  `WHATSAPP_OUTREACH_ENABLED`, `LOCKSMITH_ACTIVATION_ENABLED`,
  `DEMAND_CALIBRATION_ENABLED` — confirm with the user before enabling anything
  that sends real messages.
