# Session Recap — 2026-06-07 · Twilio + WhatsApp Platform Build

One day, full stack: new Twilio account → SMS switch → UK number → WhatsApp sender →
locksmith AI assistant → lead recruitment flow → SMS cost optimisation.

---

## 1. What is LIVE in production

### Twilio account & number
- **Account:** "My first Twilio account" (SID `ACf6e092…`), upgraded to pay-as-you-go, auto-recharge on. Old account (`AC0f…`, +44 7782 210264) fully retired.
- **UK number:** **+44 7446 588587** (mobile, Voice+SMS, £1.89/mo, regulatory bundle `BU2e7c24…`).
- Credentials updated in local `.env` AND Vercel (backup of old env: `.env.backup-pre-twilio-switch`, now gitignored — it contains an old OpenAI key that GitHub push-protection caught).

### SMS (all of the project)
- `SMS_PROVIDER=twilio` everywhere. Outbound SMS shows **"LockSafe UK"** (alphanumeric sender — one-way; STOP replies don't work on alpha senders, flagged trade-off).
- Links in SMS now deliver (Twilio). Zadarma stays configured as fallback (its sanitizer strips URLs).
- **Test verified:** delivered to +447377555299, From "LockSafe UK".
- **Cost pack:** `estimateSegments()` in `lib/sms.ts` logs segments/encoding on every send, warns on multi-segment/UCS-2. `/api/test-sms` returns segment info.
- **Branded short links:** `locksafe.uk/r/{code}` — `ShortLink` model + `/r/[code]` redirect, clicks logged. No Twilio shortener add-on needed.
- **Template fixes:** lead outreach SMS was silently UCS-2 (em dash) = 4 segments ≈ £0.12/lead → now 1 GSM-7 segment worst-case (158 chars). Base-location SMS = 1 segment with per-locksmith tracked short link.
- **House rule:** GSM-7 only in SMS (no emoji / em dashes / smart quotes). Emoji belong on WhatsApp.

### WhatsApp sender (production)
- **+44 7446 588587 "LockSafe UK" — Online** on WABA `1505490627954796` (Meta Business Manager `4485225595089726`), 80 MPS.
- Got there by: deleting the auto-created +1 555 test number, then removing the whole "Test WhatsApp Business Account" WABA (number cap on unverified business, Meta error #2388386).
- Profile: shield logo (cropped 640×640 from `Locksafe-Logo.jpeg`), address 71-75 Shelton Street, contact@locksafe.uk, locksafe.uk, about + description set.
- Webhook + status callback → `https://www.locksafe.uk/api/webhooks/twilio-whatsapp` (X-Twilio-Signature verified; base URL via `TWILIO_WEBHOOK_BASE_URL`).
- **Display name in chats:** shows number until Meta business verification completes (submitted, "In review") — profile/logo visible immediately.
- `WHATSAPP_PROVIDER=twilio`, `TWILIO_WHATSAPP_NUMBER=+447446588587` (local + Vercel).
- **Webhook latency fix:** processing is awaited (fire-and-forget freezes on serverless → replies took ~60s; now 2–3s).

### WhatsApp bot — identity routing (`handleIncomingMessage`)
Inbound phone → looked up with **format-agnostic matching** (exact variants + digit-sequence regex fallback — DB audit showed 64% of lead phones contain spaces; locksmith phones are mostly `0XXXXXXXXXX`, one bare `7XXXXXXXXX`):
1. **Locksmith** → Locksmith Assistant (below). First inbound auto-links `whatsappChatId`.
2. **LocksmithLead** → recruitment flow: marks `status="replied"`, YES → join pitch + `locksafe.uk/join`, STOP → `not_interested`, else pitch + human handoff. All messages land in admin WhatsApp inbox.
3. **Customer/unknown** → existing customer bot (booking flow = fallback only, per product decision: customers should mainly get job updates on WhatsApp; nobody books via WhatsApp).

### Locksmith Assistant (the priority feature)
- **Thin WhatsApp adapter** (`src/lib/locksmith-whatsapp-adapter.ts`) over the EXISTING `locksmith-bot.ts` handlers (same brain as the Telegram bot): `jobs`, `pending`, `earnings`, `stats`, `available`/`offline`, `accept/decline <job>`, `quote`. Telegram HTML → WhatsApp formatting; callback buttons → numbered replies.
- **New commands:** `profile` → completeness card (✅/❌ + deep links, % score, dispatch-blocking flags) from the new **completeness engine** (`src/lib/locksmith-completeness.ts` — single source of truth: terms, base location, call-out fee, Stripe, photo, insurance, DBS, app install). `install` → app install walkthrough.
- **AI chat:** any free-text message → conversational AI with live context (availability, completeness, active jobs, earnings) + last 10 inbox messages as history. **Models.HERMES = qwen3:30b-a3b local (Ollama-first)**; on Vercel serverless it currently uses the OpenAI emergency fallback (Ollama unreachable from Vercel — see "Decisions pending").
- `support`/`agent`/`human` → canned handoff; humans reply from the admin WhatsApp inbox.
- **Bug fixed along the way:** customer bot numbered menus now map "1/2/3" back to button ids (Twilio has no native buttons); greeting state routes agent/speak/human keywords to escalation.

### Templates (Twilio Content API — submitted, approval pending ~1 day)
- `locksmith_recruit_invite` (MARKETING) → `HX1d189f7964fee0492ece8f26e1c37f3a`
- `profile_incomplete_v1` (UTILITY) → `HX7806bb5188ef8a6a3ef7cd80b491d803`
- Env mapping convention: `TWILIO_CONTENT_SID_<TEMPLATE_NAME>` (set locally + Vercel). `sendTemplateMessage()` auto-routes via ContentSid on the twilio provider.
- Submission script: `scripts/submit-whatsapp-templates.sh`.

### Voice — untouched (hard rule)
**Retell receptionist stays on the Zadarma number.** No part of this migration touches voice routing.

---

## 2. Costs (verified 2026-06)
£1.89/mo number · SMS ~£0.03/segment (now mostly 1 segment) · WA session msg ~£0.004 · WA utility template ~£0.021 · WA marketing template ~£0.042. Current scale ≈ **£25–40/mo**. Biggest win today: lead SMS 4→1 segments (−75%).

---

## 3. TOMORROW / NEXT SESSION

1. **Check template approvals** (Twilio Console → Content Template Builder). When approved:
   - Set `WHATSAPP_OUTREACH_ENABLED=true` (+ confirm `SMS_OUTREACH_ENABLED` stance) on Vercel → redeploy. Lead outreach cron (weekdays 08:00, send-window 07:00–11:00 UK, capped) starts inviting leads via WhatsApp template; replies hit the recruitment flow automatically.
2. **Smoke test pending:** message the bot from a locksmith-registered number — expect locksmith menu, `profile` card, AI answers (user's number +447377555299 is on locksmith "Alexandru Iosif").
3. **Mac Studio Ollama tunnel decision:** expose Ollama to Vercel (Tailscale Funnel / Cloudflare tunnel as `OLLAMA_BASE_URL`) so WhatsApp AI chat runs on local qwen3 (£0) instead of OpenAI fallback. ~10 min + security review.
4. **Send the announcement** to existing locksmiths from the old 07818 333989 WhatsApp (drafts in chat: long + short version). 07818 stays on the engineers' phone — do NOT register it to the API (it would kick it off the app; coexistence only via 360dialog, parked).
5. Optional QoL: enable Romania in Twilio geo-permissions if testing SMS from RO numbers (error 21408 seen once).

## 4. BUILD B / C (committed roadmap, sequenced — full detail in LOCKSMITH_ENGAGEMENT_PLAN.md)
- **Build B:** NudgeLog model + `sendLocksmithNudge()` orchestrator (quiet hours, caps, cooldowns, channel waterfall: Telegram £0 → WA session → WA template → SMS → email) → wire dbs/insurance/onboarding/photo/base-location crons through it (email stays as fallback, dry-run flags). Admin: completeness score column + unified nudge timeline + manual send.
- **Build C:** COO agent tools (`nudgeLocksmith`, `engagementReport`) in shadow mode via AgentProposal → review → live. Weekly engagement digest to Telegram.
- Watch out: multiple parallel sessions caused git history rewrites + stash collisions today (two commit messages got swapped — content correct). Prefer one writing session at a time, or pull/rebase before pushing.

## 5. Key files touched today
`src/lib/locksmith-whatsapp-adapter.ts` (new) · `src/lib/locksmith-completeness.ts` (new) · `src/lib/short-link.ts` (new) · `src/app/r/[code]/route.ts` (new) · `src/app/api/webhooks/twilio-whatsapp/route.ts` (new, earlier) · `src/lib/whatsapp-business.ts` (twilio provider, identity routing, ContentSid templates, menu mapping) · `src/lib/sms.ts` (segment guard) · `src/lib/twilio-sender.ts` (alpha sender spaces) · `lead-outreach-sequence` + `send-base-location-sms` (1-segment templates) · `prisma/schema.prisma` (ShortLink) · `scripts/` (submit-whatsapp-templates.sh, check-phone-formats.ts, dedupe-leads.ts from parallel session) · `docs/LOCKSMITH_ENGAGEMENT_PLAN.md` (north-star plan + costs).
