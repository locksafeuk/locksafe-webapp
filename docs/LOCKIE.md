# Lockie — LockSafe's AI Assistant

Lockie is LockSafe's conversational AI assistant. It is **one brain (the local
`qwen3:32b` model on the Mac Studio) with two personas**, working across both
**WhatsApp** and **two-way SMS**. It replaces all menu/keyword bots with a
natural, ChatGPT-style conversation that can both *answer* and *act*.

---

## At a glance

| | Locksmith Lockie | Customer Lockie |
|---|---|---|
| **Who** | Vetted locksmiths on the platform | Members of the public |
| **Channels** | WhatsApp, SMS | WhatsApp, SMS |
| **Purpose** | Manage their jobs, earnings, availability, profile | Book a locksmith, track a job, get support |
| **Code** | `src/lib/locksmith-whatsapp-adapter.ts` → `handleLocksmithAIChat` | `src/lib/customer-lockie.ts` → `handleCustomerLockie` |

Inbound messages are routed by phone number (`identifyInboundPhone`): registered
**locksmiths** → Locksmith Lockie; recruitment **leads** → recruitment flow;
everyone else (**customers**) → Customer Lockie.

### Numbers

- **WhatsApp:** +44 7446 588587 (`TWILIO_WHATSAPP_NUMBER`)
- **Two-way SMS:** +44 7862 134213 (`TWILIO_SMS_PHONE_NUMBER`)
- **Support (voice):** +44 20 4577 1989
- **Locksmith line (voice):** 07818 333989

---

## Locksmith Lockie

A warm, sharp colleague helping locksmiths run their LockSafe work by message.

**Tools it can use:**

- `get_active_jobs` — current accepted / en-route / in-progress jobs
- `get_pending_jobs` — job offers not yet accepted
- `get_earnings` — today / week / month / pending payout / lifetime
- `get_profile_status` — what's missing, and whether they're blocked from jobs
- `set_availability` — go Available / Offline
- `accept_job` / `decline_job` — act on an offer (**confirm-gated**)
- `escalate_to_human` — hand off to a teammate (sends a real Telegram alert with name + message)
- `app_help` — gives the **install** link if they don't have the app, or the **update** notice if they do

**Key behaviours:**

- **Required vs optional onboarding.** Only these block a locksmith from
  receiving jobs: accept T&Cs, set base location, set call-out fee, connect
  Stripe, valid insurance, and a real profile photo. **DBS check and app install
  are optional** (trust/ranking boosters). Lockie never tells a locksmith they
  *must* have a DBS to get jobs.
- **Availability guard.** Can't go Available until all required items are done.
- **Confirm-gating.** Won't accept/decline a job without explicit confirmation.

---

## Customer Lockie

A calm, capable assistant for the public — books jobs *and* supports existing
ones, entirely conversationally (no forms, no menus).

**Tools it can use:**

- `create_job` — book a brand-new job and alert nearby locksmiths
  (**confirm-gated**; needs at least full name + postcode). Uses the same
  `createEmergencyJob` pipeline as the website and voice agent.
- `get_my_job` — status, assigned locksmith, ETA, fee of their current job
- `relay_to_locksmith` — pass a note to the assigned locksmith ("running late", access notes)
- `escalate_to_human` — refunds, complaints, cancellations, safety, "speak to a person"

**Key behaviours:**

- **Conversational booking.** "I'm locked out in NR2" → Lockie gathers name,
  postcode and problem one step at a time, reads it back to confirm, then books.
- **Escalation safety net.** If Lockie's reply *implies* a human handoff but the
  tool wasn't called, the escalation fires automatically — a customer is never
  told "someone will be in touch" while nobody is notified.
- **Price discipline.** Only quotes the call-out fee from live data; never
  invents a total (the locksmith confirms on site).
- **Cross-channel memory.** History is keyed by phone, so SMS and WhatsApp share
  one thread — Lockie picks up context whichever channel the customer uses.

---

## Two-way SMS & the WhatsApp hand-off

- A customer texting +44 7862 134213 is recorded in the admin inbox (never
  vanishes) and answered by Lockie.
- Transactional customer SMS send **from the two-way number** (replyable);
  marketing/outreach keeps the "LockSafe UK" alphanumeric sender.
- After a couple of SMS exchanges, Lockie offers to continue on **WhatsApp**
  (cheaper for us, richer for them) — they tap a `wa.me` link, and Lockie picks
  up on WhatsApp with full SMS history.

---

## Feature flags (Vercel env)

| Flag | Effect |
|---|---|
| `CUSTOMER_SMS_AUTOREPLY=true` | Lockie auto-replies to inbound customer SMS (else: record + Telegram alert only) |
| `CUSTOMER_WHATSAPP_AGENTIC=true` | Customer WhatsApp runs agentic Lockie (booking + support), retiring the old menu; also enables the SMS→WhatsApp hand-off invite |
| `OLLAMA_BASE_URL` | Points production at the Mac Studio's Ollama (`…ts.net:8443`) |

---

## Safety & guardrails

- **Dry-run mode** on all agentic handlers for safe testing (read tools run for
  real; mutating tools — book/accept/decline/availability/escalate — only report
  intent). Exercised via the admin endpoint `/api/admin/agents/bot-trial`.
- **Quiet hours** — broadcasts to locksmiths' phones are blocked outside
  09:00–20:00 UK unless `force:true`.
- **Confirm-gating** on all side-effecting actions (book, accept, decline).
- **Graceful fallback** — if Lockie can't respond, the legacy flow catches it
  rather than going silent.

---

## Where things live

- Locksmith Lockie: `src/lib/locksmith-whatsapp-adapter.ts`
- Customer Lockie: `src/lib/customer-lockie.ts`
- Inbound SMS webhook: `src/app/api/webhooks/twilio-sms/route.ts`
- Inbound WhatsApp webhook: `src/app/api/webhooks/twilio-whatsapp/route.ts`
- Admin trial harness: `src/app/api/admin/agents/bot-trial/route.ts`
- Unified inbox (SMS + WhatsApp, channel-badged): `/admin/whatsapp`
- App broadcast (segmented install/update): `src/app/api/admin/broadcast/app-update/route.ts`
