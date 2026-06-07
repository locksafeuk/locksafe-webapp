# Locksmith Engagement Engine — Master Plan ("God Mode")

**Date:** 2026-06-07 · **Status:** Approved direction, phased build
**Goal:** One autonomous, multi-channel engagement system for locksmiths — onboarding, profile completion, compliance (DBS/insurance), job hygiene (photos), and recruitment — with WhatsApp as the primary conversational channel and customers receiving job updates only.

---

## 1. What exists today (audit summary)

### Crons (vercel.json)
| Cron | Schedule | Channel | Dedupe mechanism |
|---|---|---|---|
| `dbs-reminders` | daily 10:00 | email only | threshold days + `dbsReminderSent` bool |
| `insurance-reminders` | daily 10:00 | email only | threshold days + `insuranceReminderSent` bool |
| `onboarding-nudge` (3-stage + auto-delete day 30) | daily 09:00 | email only | `StripeReminderLog` tags |
| `lead-outreach-sequence` | weekdays 08:00 | email + gated SMS + gated WhatsApp template | `LocksmithLead.status` |
| `enrich-leads` | every 4h | none (data) | sentinel email |
| `photo-upload-reminder` | hourly | SMS + email | 30min–3h time window |
| `morning-briefing` | daily 08:00 | Telegram (admin) | n/a |

### Channels available
- **WhatsApp** — Twilio sender +447446588587 "LockSafe UK" (Online), webhook `/api/webhooks/twilio-whatsapp`, bot flows + numbered-reply mapping, admin inbox (`WhatsAppConversation`).
- **SMS** — Twilio primary, "LockSafe UK" alpha sender, links allowed; Zadarma fallback (strips URLs).
- **Email** — Resend, rich templates (DBS, insurance, Stripe onboarding, app-install, base-location), delivery/open/click tracking via Resend webhook → `AppInstallReminderLog`.
- **Push** — PWA web-push + native APNs/FCM (`nativeDeviceToken`, `webPushSubscription`).
- **Telegram (admin)** — MATURE: 10 forum topics (NEW_JOBS, LOCKSMITHS, CUSTOMERS, JOB_UPDATES, PAYMENTS, AGENTS, SOCIAL, APPLICATIONS, QUOTES, REVIEWS), severity cooldowns, quiet hours 22:00–07:00, content-fingerprint dedupe, SMS fallback for P1. `src/lib/telegram.ts` + `telegram-bot.ts` (admin command bot with OpenClaw NLP).
- **Telegram (locksmith personal bot)** — EXISTS & WIRED: `src/lib/locksmith-bot.ts` + webhook `/api/locksmith/bot`. Commands: /start (links `telegramChatId`), /status, /available, /offline, /toggle, /jobs, /pending, /earnings, /stats, /accept, /decline, /quote_help. Used by job auctions (push → web-push → Telegram). FREE channel.

### Telegram coexistence rules (do NOT overcrowd what works)
1. **Admin alerts stay 100% Telegram** — topic routing, dedupe, quiet hours are mature. No WhatsApp mirror. WhatsApp's admin surface remains the conversation inbox only.
2. **One bot brain, two transports** — the WhatsApp Locksmith Assistant reuses `locksmith-bot.ts` command handlers (`handleLocksmithCommand`) via a thin WhatsApp adapter; `registerLocksmithChat(locksmithId, chatId, "whatsapp")` already supports the platform param. Do not build a second bot brain in whatsapp-business.ts.
3. **`preferredBotPlatform` finally gets wired** — the dispatcher reads it (telegram | whatsapp); both `telegramChatId` and `whatsappChatId` populated via each platform's linking flow.
4. **Job auctions keep their proven order** (native push → web-push → bot) — we only swap "Telegram" for "preferred bot platform" in the third slot.
5. **Reuse policy patterns** — quiet hours / cooldown / fingerprint dedupe logic mirrors `telegram.ts` conventions (extract shared helpers, don't reinvent).

### Key model fields (Locksmith)
Onboarding: `onboardingCompleted`, `onboardingLastInteractionAt`, `termsAcceptedAt`, `tourCompletedAt`, `firstLocksmithLoginAt`
Location: `baseAddress`, `baseLat/baseLng`, `coverageRadius`
Payout: `stripeConnectId/Onboarded/Verified` · Pricing: `defaultAssessmentFee`
Compliance: `dbsStatus/ExpiryDate`, `insuranceStatus/ExpiryDate`, `profilePhotoVerified`
Prefs: `smsNotifications`, `emailNotifications`, `pushNotifications`, **`whatsappChatId`**, **`preferredBotPlatform`** (already in schema!)

### Gaps (the calibration targets)
1. **Email-only lifecycle nudges** — WhatsApp/SMS unused for DBS, insurance, onboarding stages.
2. **Fragmented dedupe** — booleans, tag logs, time windows; three separate log tables + three admin log viewers.
3. **No channel intelligence** — no waterfall, no engagement-based channel choice, no quiet hours policy shared across crons (only lead-outreach has a send window).
4. **No unified profile-completeness function** — checklist logic duplicated in `onboarding-nudge` cron and `SetupChecklist.tsx`.
5. **Agents can't engage locksmiths** — COO has no nudge/outreach tools; reminders are dumb timers.
6. **WhatsApp bot is customer-shaped** — no identity routing; locksmiths get the booking menu.

---

## 2. Target architecture

```
                    ┌──────────────────────────────┐
   crons / agents → │  Engagement Orchestrator     │ → NudgeLog (unified)
   admin / bot    → │  sendLocksmithNudge()        │
                    │  - completeness engine       │    Channel waterfall:
                    │  - policy (quiet hrs, caps,  │    1. WhatsApp session (free, if <24h window)
                    │    cooldowns, priority)      │    2. WhatsApp template (approved, utility)
                    │  - channel selection         │    3. SMS (LockSafe UK, links OK)
                    └──────────────────────────────┘    4. Email (rich, tracked)
                                                        5. Push (job-time only)
```

### 2.1 Profile Completeness Engine — `src/lib/locksmith-completeness.ts`
Single pure function `getLocksmithCompleteness(locksmith)` returning:
```ts
{ score: 0-100, items: [{ key, label, done, deepLink, priority }], blockingDispatch: boolean }
```
Items: terms, base location (postcode+coords), call-out fee, Stripe onboarded/verified, profile photo (AI-verified), insurance doc + expiry, DBS doc + expiry, app installed (`nativeDeviceToken`), availability schedule set.
Consumers: SetupChecklist UI, onboarding-nudge cron, WhatsApp bot, admin dashboard, COO agent.

### 2.2 Unified `NudgeLog` model (Prisma)
```prisma
model NudgeLog {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  locksmithId  String?  @db.ObjectId
  leadId       String?  @db.ObjectId
  nudgeType    String   // dbs_expiring | insurance_expiring | onboarding_stage_1 | profile_incomplete | photo_reminder | app_install | base_location | lead_invite ...
  channel      String   // whatsapp_session | whatsapp_template | sms | email | push
  status       String   // sent | delivered | read | clicked | replied | failed
  messageId    String?  // provider id (Twilio SID / Resend id)
  meta         Json?
  sentAt       DateTime @default(now())
  @@index([locksmithId, nudgeType, sentAt])
}
```
Replaces (long-term) `StripeReminderLog`, `BaseLocationReminderLog`, `AppInstallReminderLog` reads; existing tables stay for history.

### 2.3 Orchestrator — `src/lib/locksmith-nudge.ts`
`sendLocksmithNudge({ locksmithId | leadId, nudgeType, context, priority })`:
1. **Policy gate**: quiet hours 07:30–20:30 Europe/London (critical exempt); max 1 non-critical nudge / locksmith / day; per-type cooldowns (configurable map, e.g. `profile_incomplete: 72h`, `dbs_expiring: threshold days as today`); respects channel prefs + STOP.
2. **Channel pick** (cheapest-first, preference-aware): **Telegram bot if `telegramChatId` linked (£0)** or WhatsApp session if last inbound < 24h (~£0.004) — order between these two decided by `preferredBotPlatform` → WhatsApp template if approved + valid mobile (~£0.021) → SMS (~£0.06) → email (≈£0). Engagement feedback: if 2 consecutive templates unread but emails clicked, flip `preferredBotPlatform`.
3. **Send + log** to `NudgeLog`; status updated by existing webhooks (Twilio status callback already hits `/api/webhooks/twilio-whatsapp`; Resend webhook exists).

### 2.4 WhatsApp bot identity routing (in `handleIncomingMessage`)
Lookup inbound phone → `Locksmith` → **Locksmith Assistant**; → `LocksmithLead` → recruitment flow (join link, FAQ, opt-out); → `Customer` with active job → job status flow; → unknown → minimal menu (request callback / book on site). Customer booking flow demoted to fallback.

**Locksmith Assistant flows** — thin WhatsApp adapter over the EXISTING `locksmith-bot.ts` handlers (availability toggle, jobs, pending, earnings, stats, accept/decline, quote help all already implemented for Telegram). New additions shared by both platforms:
- "status" → completeness card from the completeness engine: ✅/❌ checklist + deep links
- "install" → app install walkthrough (universal links, `/install`)
- DBS/insurance upload guidance → links to settings docs section
- escalation → admin WhatsApp inbox (exists)
- any nudge reply lands in admin inbox + opens 24h free session
Linking: first inbound WhatsApp from a known locksmith phone auto-populates `whatsappChatId` (Telegram equivalent: /start deep link — exists).

### 2.5 WhatsApp utility templates (submit early — Meta approval ~1 day)
| Template | Variables | Used by |
|---|---|---|
| `profile_incomplete_v1` | name, missing_count, top_item | onboarding/profile nudges |
| `dbs_expiring_v1` | name, days, renew_link | dbs-reminders |
| `insurance_expiring_v1` | name, days, link | insurance-reminders |
| `photo_reminder_v1` | name, job_number | photo-upload-reminder |
| `app_install_v1` | name, install_link | app-install campaign |
| `job_update_v1` (customer) | name, job_number, status | customer job updates |
| `locksmith_recruit_invite` (exists for Meta — port to Twilio Content API) | name, town | lead-outreach |

### 2.6 Cron calibration (keep schedules, swap engine)
- `dbs-reminders`, `insurance-reminders`, `onboarding-nudge`, `photo-upload-reminder`, base-location (currently manual-only → add to daily batch): all call `sendLocksmithNudge()` instead of bespoke email sends. Thresholds/stage logic unchanged.
- `lead-outreach-sequence`: SMS/WhatsApp legs route through orchestrator (gets logging + caps for free); now SMS links work (Twilio).
- NEW `locksmith-engagement` daily 09:30: completeness sweep for active-but-incomplete locksmiths older than onboarding window (the "long tail" the 3-stage nudge misses), max N/day, lowest-score-first.

### 2.7 Autonomy (agent layer)
- New agent tool `nudgeLocksmithTool` (COO): wraps orchestrator, goes through existing `AgentProposal` audit + budget tracker; shadow mode first.
- New agent tool `engagementReportTool`: NudgeLog aggregates (sent/read/replied per type+channel, completeness distribution) → weekly Telegram digest via morning-briefing pattern.
- COO heartbeat rule: locksmith available but `blockingDispatch=true` → propose nudge (cooldown-aware, 60-min alert cadence respected).
- Auto-calibration v1: simple per-locksmith channel preference flip based on engagement (no ML, just counters in `preferredBotPlatform`).

### 2.8 Admin dashboard
- Locksmiths table: completeness score column + filter ("missing fee", "missing location", "DBS expiring").
- Locksmith detail: unified nudge timeline (NudgeLog) replacing 3 separate log viewers.
- Manual "Send nudge" button → orchestrator (same caps apply; override flag for admins).

---

## 3. Build phases

| Phase | Scope | Est. effort | Depends on |
|---|---|---|---|
| **P1** | Completeness engine + NudgeLog model + orchestrator (policy, waterfall incl. free Telegram rung, wires `preferredBotPlatform`) + bot identity routing + WhatsApp adapter over existing `locksmith-bot.ts` handlers + "status"/"install" flows | 1 session | nothing |
| **P2** | Submit Twilio Content templates; wire dbs/insurance/onboarding/photo crons through orchestrator (email stays as final fallback so nothing regresses while templates pend approval) | 1 session | P1 |
| **P3** | New `locksmith-engagement` cron + lead-outreach via orchestrator + admin dashboard (score column, nudge timeline, manual send) | 1 session | P1 |
| **P4** | Agent tools (nudge + report, shadow mode → live), weekly digest, channel auto-calibration | 1 session | P1–P3 |
| **P5** | Customer side: `job_update_v1` template sends on job lifecycle (accepted/en-route/completed), booking menu demoted for unknown numbers | 0.5 session | P2 |

**Safety rails throughout:** dry-run env flags per phase (mirroring `ONBOARDING_LIFECYCLE_DRY_RUN`), shadow AgentProposals before live agent sends, all sends logged before dispatch, STOP/opt-out respected on every channel, quiet hours enforced centrally.

---

## 4. Cost model (verified 2026-06, Twilio + Meta UK rates)

Per-unit: UK number £1.89/mo · SMS ~£0.03/segment (job SMS with link ≈ 2 segments ≈ £0.06) · WhatsApp session msg ~£0.004 (Twilio fee only; Meta free in 24h window) · WhatsApp utility template ~£0.021 · WhatsApp marketing template ~£0.042 · inbound ~£0.004–0.0075.

| Scenario | Assumed volumes | ~£/month |
|---|---|---|
| Current | 100 jobs (~600 job SMS), light outreach, 500 WA msgs, 200 nudges | 25–40 |
| Growth | 300 jobs, SMS outreach at 40/day cap (~880/mo), 2k WA msgs, 800 nudges | 90–130 |
| 10× | 1,000 jobs, multi-city outreach, 8k WA msgs | 350–450 |

Cost levers built into the engine: **Telegram-linked locksmiths cost £0 per nudge — the waterfall's first rung**; utility WhatsApp nudge is ~3× cheaper than the 2-segment SMS it replaces; locksmiths active in the 24h WhatsApp session window cost £0.004/nudge; lead outreach SMS (largest single line, ~£40–53/mo at cap) can shift to WhatsApp marketing templates at equal cost but higher reply rates; Phase 5 customer job updates via WhatsApp roughly halve per-job messaging spend. Voice (Retell/Zadarma) and email (Resend) unaffected.

## 5. Decisions taken
- WhatsApp is locksmith-first; customers get job updates only (booking = fallback).
- Retell voice stays on Zadarma — engagement engine never touches voice routing.
- Keep existing cron schedules/thresholds in P2 (calibrate channels, not timing) — timing tuning comes after NudgeLog gives us real engagement data.
- Existing log tables are not migrated; NudgeLog is the going-forward source of truth.
