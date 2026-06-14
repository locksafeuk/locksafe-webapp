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

- **Webapp ships via `./ship.sh`.** It gates on (1) Prisma client regeneration,
  (2) the pre-push typecheck hook, and (3) the piky-boy ↔ Vercel deploy
  contract. Claude invokes it via the Mac (osascript), so there is no
  authentication problem — but the typecheck + Prisma gate must pass before the
  push lands.
- **Every other repo: Claude pushes directly.** Parent workspace
  (`piky-boy/locksafe-workspace`), `locksafe-social-automation`, daily-review
  edits — Claude runs `git commit && git push` via osascript on the Mac with
  the user's SSH keys. No `ship.sh`, no 2-second abort window, no ritual.
- **MongoDB Atlas SRV is blocked** from the Claude Linux sandbox — can't query
  the DB from there. Use admin API endpoints (via the logged-in browser) or
  scripts run on the Mac.
- **Prisma engine can't download** in the Linux sandbox. After a
  `schema.prisma` change, regenerate on the Mac (`npx prisma generate`) before
  `./ship.sh` runs the typecheck. Mongo needs no migration — generate is enough.

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
