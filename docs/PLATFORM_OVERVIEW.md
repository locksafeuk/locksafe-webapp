# LockSafe UK - Platform Overview

> **The Complete Emergency Locksmith Marketplace Platform**

---

## Table of Contents

1. [Platform at a Glance](#platform-at-a-glance)
2. [The LockSafe Difference](#the-locksafe-difference)
3. [Technology Stack](#technology-stack)
4. [Customer Journey](#customer-journey)
5. [Locksmith Journey](#locksmith-journey)
6. [Commission & Payments](#commission--payments)
7. [Anti-Fraud Protection](#anti-fraud-protection)
8. [AI & Automation](#ai--automation)
9. [Marketing System](#marketing-system)
10. [Communication Channels](#communication-channels)
11. [Notification System](#notification-system)
12. [Admin Operations](#admin-operations)
13. [Customer Guarantees](#customer-guarantees)
14. [Locksmith Dashboard](#locksmith-dashboard)
15. [Support & Resources](#support--resources)

---

## Platform at a Glance

LockSafe UK is a **full-stack emergency locksmith marketplace** connecting:

- **Customers** who need urgent locksmith services (web, phone, or app)
- **Verified locksmiths** who provide those services
- **Administrators** who manage operations via web dashboard and Telegram bot

### What We Handle

| Function | Technology |
|----------|------------|
| Customer Acquisition | Meta Ads, Google Ads, SEO, Organic Social |
| Phone Intake | Bland.ai Voice AI |
| Job Matching | Intelligent Dispatch Algorithm |
| Payments | Stripe Connect (instant payouts) |
| Documentation | GPS, Photos, Digital Signatures, PDF Reports |
| Notifications | SMS (Twilio), Email (Resend), Push, Telegram |
| Admin Ops | Web Dashboard + Telegram Bot |

### Commission at a Glance

| Payment Type | You Keep | Platform Takes |
|--------------|----------|----------------|
| **Assessment Fee** | 85% | 15% |
| **Work Quote** | 75% | 25% |

*No monthly fees. No signup fees. No lead fees. Only pay when you complete jobs.*

**You focus on your craft. We handle everything else.**

---

## The LockSafe Difference

### Traditional Locksmith Leads

| Problem | Impact |
|---------|--------|
| ❌ Pay per lead | Waste money on unconverted leads |
| ❌ No payment guarantee | Chase customers for payment |
| ❌ No documentation | Disputes without evidence |
| ❌ Manual invoicing | Paper-based, error-prone |
| ❌ No trust signals | Customers can't verify you |

### LockSafe UK

| Solution | Benefit |
|----------|---------|
| ✅ Commission on completed jobs only | Pay only when you earn |
| ✅ Pre-paid assessment fees | Guaranteed payment before you travel |
| ✅ GPS + Photo + Signature | Complete anti-fraud protection |
| ✅ Automatic Stripe payouts | Money in your bank in 1-2 days |
| ✅ PDF reports | Legal documentation for every job |
| ✅ Verified badge | Customers trust you instantly |
| ✅ Real-time notifications | Never miss a job |

---

## Technology Stack

### Core Platform

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 16, React, TypeScript, Tailwind CSS |
| **Backend** | Next.js API Routes, Node.js |
| **Database** | MongoDB (via Prisma ORM) |
| **Authentication** | JWT, Session-based |
| **Hosting** | Netlify (Dynamic) |

### Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| **Stripe Connect** | Payment processing & instant locksmith payouts | ✅ Live |
| **Twilio** | SMS notifications & Voice for Bland.ai | ✅ Live |
| **Resend** | Transactional & campaign emails | ✅ Live |
| **Mapbox** | Maps, geocoding, location services | ✅ Live |
| **Bland.ai** | AI voice agent for phone calls | ✅ Live |
| **Telegram** | Admin & locksmith bot operations | ✅ Live |
| **WhatsApp** | Customer support & notifications | ⏳ Pending |
| **Meta Marketing API** | Facebook/Instagram ad management | ⏳ Pending |
| **Google Ads** | Google advertising & conversion tracking | ⬚ Setup Required |
| **OpenAI** | AI content generation & NLP | ✅ Live |

### Analytics & Tracking

| Tool | Purpose |
|------|---------|
| **Google Analytics 4** | Website analytics |
| **Meta Pixel** | Facebook conversion tracking |
| **Google Ads Conversion** | Google conversion tracking |
| **Microsoft UET** | Bing ads tracking |
| **Custom Attribution** | Multi-touch attribution |

---

## Customer Journey

Customers can request a locksmith through **three channels**:

### 1. Web Request (locksafe.uk)

```
┌─────────────────────────────────────────────────────────────┐
│                     WEB JOURNEY                             │
├─────────────────────────────────────────────────────────────┤
│  1. Visit locksafe.uk                                       │
│  2. Select urgency (Locked out NOW / Need soon / Other)     │
│  3. Choose problem type (lockout, broken lock, etc.)        │
│  4. Enter postcode & address                                │
│  5. Provide contact details (email required)                │
│  6. See nearby locksmiths with ratings & ETAs               │
│  7. Select preferred locksmith                              │
│  8. Pay assessment fee (Stripe)                             │
│  9. Receive confirmation + tracking link                    │
└─────────────────────────────────────────────────────────────┘
```

### 2. Phone Request (AI Voice Agent)

```
┌─────────────────────────────────────────────────────────────┐
│                    PHONE JOURNEY                            │
├─────────────────────────────────────────────────────────────┤
│  1. Customer calls emergency number                         │
│  2. Bland.ai voice agent answers                            │
│  3. AI checks if customer is safe                           │
│  4. Collects: name, phone, email, postcode, problem         │
│  5. Creates account (if new customer)                       │
│  6. Registers emergency job request                         │
│  7. Sends SMS + email with link to complete booking         │
│  8. Customer clicks link, confirms address, pays            │
│  9. Locksmiths notified, job goes live                      │
└─────────────────────────────────────────────────────────────┘
```

### 3. Customer Dashboard (Returning Customers)

```
┌─────────────────────────────────────────────────────────────┐
│                  DASHBOARD FEATURES                         │
├─────────────────────────────────────────────────────────────┤
│  • View active and past jobs                                │
│  • Track locksmith location in real-time                    │
│  • Review and approve quotes                                │
│  • Sign off completed work                                  │
│  • Download PDF reports                                     │
│  • Leave reviews                                            │
│  • Manage profile & saved cards                             │
│  • View notifications                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Locksmith Journey

### Job Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCKSMITH WORKFLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. NOTIFICATION                                            │
│     • Receive SMS/email/push when job posted in your area   │
│     • Or: Auto-dispatched by intelligent matching system    │
│                                                             │
│  2. APPLICATION                                             │
│     • View job details (problem, location, urgency)         │
│     • Submit your assessment fee + ETA                      │
│     • Add optional message to customer                      │
│                                                             │
│  3. ACCEPTANCE                                              │
│     • Customer selects you                                  │
│     • Assessment fee charged to customer                    │
│     • You receive confirmation notification                 │
│                                                             │
│  4. EN ROUTE                                                │
│     • Mark yourself as "En Route"                           │
│     • Customer sees your live location (GPS tracking)       │
│     • ETA updates automatically                             │
│                                                             │
│  5. ARRIVAL                                                 │
│     • GPS check-in when you arrive                          │
│     • Location verified against job address                 │
│     • Customer notified of your arrival                     │
│                                                             │
│  6. DIAGNOSIS                                               │
│     • Take "before" photos (required)                       │
│     • Assess the problem                                    │
│     • Photos are GPS-tagged and timestamped                 │
│                                                             │
│  7. QUOTE                                                   │
│     • Create itemized quote (parts + labour)                │
│     • Select lock type, difficulty, defect                  │
│     • Customer can ACCEPT or DECLINE                        │
│     • If declined: you keep assessment fee, job closes      │
│                                                             │
│  8. WORK                                                    │
│     • Customer accepts quote                                │
│     • Complete the work                                     │
│     • Take "after" photos (required)                        │
│                                                             │
│  9. COMPLETION                                              │
│     • Mark work as complete                                 │
│     • GPS captured at completion location                   │
│     • Customer has 24 hours to sign off                     │
│                                                             │
│  10. SIGNATURE                                              │
│      • Customer signs digitally on their device             │
│      • Confirms work done + price agreed                    │
│      • If no signature in 24h: auto-completed               │
│                                                             │
│  11. PAYMENT                                                │
│      • Customer charged (minus assessment fee already paid) │
│      • Tiered commission: 15% on assessment, 25% on work    │
│      • Blended rate ~78% to your Stripe Connect account     │
│      • Money in your bank: 1-2 business days                │
│                                                             │
│  12. REPORT                                                 │
│      • PDF report auto-generated                            │
│      • Contains: timeline, GPS, photos, quote, signature    │
│      • Sent to customer, locksmith, and stored              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Availability Management

Locksmiths can control when they receive job notifications:

| Feature | Description |
|---------|-------------|
| **Manual Toggle** | Go online/offline instantly from dashboard |
| **Scheduled Hours** | Set working hours (e.g., Mon-Fri 8am-8pm) |
| **Coverage Radius** | Set how far you'll travel (miles from base) |
| **Auto-Schedule** | System toggles availability based on schedule |

---

## Commission & Payments

### Tiered Commission Structure

LockSafe uses a **tiered commission model** that reflects the value provided at each stage:

| Payment Type | Platform Commission | Locksmith Keeps |
|--------------|---------------------|-----------------|
| **Assessment Fee** | 15% | 85% |
| **Work Quote** | 25% | 75% |
| **Monthly Fee** | £0 | - |
| **Sign-up Fee** | £0 | - |
| **Lead Fee** | £0 | - |

### Why Tiered Commissions?

**Assessment Fee (15%)**
- Lower commission because locksmith sets their own fee
- Covers: customer acquisition, job matching, notifications
- Locksmith guaranteed payment for showing up

**Work Quote (25%)**
- Higher commission on the larger work portion
- Covers: payment processing, fraud protection, dispute resolution
- Includes: GPS tracking, photo storage, PDF reports, 24/7 support
- Platform takes more risk (refunds, chargebacks, etc.)

### What Commissions Cover

- Customer acquisition (Meta Ads, Google Ads, SEO)
- Payment processing (Stripe fees included)
- Platform infrastructure & maintenance
- SMS notifications (Twilio)
- Email notifications (Resend)
- AI phone agent (Bland.ai)
- Anti-fraud systems (GPS, photos, signatures)
- PDF report generation & storage
- Customer support
- Admin operations & dispute resolution

### Payment Flow Example

```
┌─────────────────────────────────────────────────────────────┐
│              PAYMENT EXAMPLE: £200 TOTAL JOB                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STEP 1: ASSESSMENT FEE (£50)                               │
│  ├── Customer pays £50 when selecting locksmith             │
│  ├── Platform commission: £50 × 15% = £7.50                 │
│  └── Locksmith earns: £50 × 85% = £42.50                    │
│                                                             │
│  STEP 2: WORK QUOTE (£150 additional)                       │
│  ├── Locksmith quotes £200 total for the job                │
│  ├── Customer already paid £50 assessment                   │
│  ├── Remaining to charge: £200 - £50 = £150                 │
│  ├── Platform commission: £150 × 25% = £37.50               │
│  └── Locksmith earns: £150 × 75% = £112.50                  │
│                                                             │
│  TOTAL BREAKDOWN:                                           │
│  ├── Customer paid: £200                                    │
│  ├── Platform earned: £7.50 + £37.50 = £45.00 (22.5%)       │
│  └── Locksmith earned: £42.50 + £112.50 = £155.00 (77.5%)   │
│                                                             │
│  PAYOUT TIMELINE:                                           │
│  ├── Stripe Connect instant transfer after signature        │
│  ├── Daily automatic payouts to your bank                   │
│  └── Money arrives in 1-2 business days                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Effective Commission Rates

The **blended commission rate** depends on the assessment fee vs work quote ratio:

| Assessment Fee | Work Quote | Total | Platform Takes | Locksmith Keeps |
|----------------|------------|-------|----------------|-----------------|
| £49 | £0 (declined) | £49 | £7.35 (15%) | £41.65 (85%) |
| £49 | £100 | £149 | £32.35 (21.7%) | £116.65 (78.3%) |
| £49 | £150 | £199 | £44.85 (22.5%) | £154.15 (77.5%) |
| £49 | £250 | £299 | £57.35 (19.2%) | £241.65 (80.8%) |
| £49 | £500 | £549 | £119.85 (21.8%) | £429.15 (78.2%) |

**Key insight**: Larger jobs mean locksmiths keep more (closer to 78-80%).

### Stripe Connect

All locksmiths use **Stripe Connect** for payments:

- **Onboarding**: Complete Stripe verification (ID, bank details)
- **Instant Payouts**: Money transferred immediately after job completion
- **Dashboard**: View all transactions at dashboard.stripe.com
- **No Invoicing**: Everything automated, no chasing payments

---

## Anti-Fraud Protection

Every job is documented with multiple verification points:

### GPS Tracking

| Event | GPS Captured |
|-------|--------------|
| Job requested | Customer location |
| Locksmith accepts | Locksmith location |
| En route | Locksmith location |
| Arrival | Locksmith location (verified against job address) |
| Quote sent | Locksmith location |
| Work started | Locksmith location |
| Work completed | Locksmith location |
| Signature | Customer location |

### Photo Evidence

| Photo Type | When Required |
|------------|---------------|
| **Before** | After arrival, before work starts |
| **During** | Optional - complex jobs |
| **After** | After work completed |
| **Lock Serial** | Optional - for records |
| **Damage** | If pre-existing damage found |

All photos are:
- GPS-tagged (lat/lng embedded)
- Timestamped
- Uploaded to secure cloud storage
- Included in PDF report

### Digital Signature

Customer signature includes:
- Date and time
- IP address
- Device information
- Explicit confirmations:
  - ✓ Work completed satisfactorily
  - ✓ Price agreed and understood
  - ✓ Happy with service

### PDF Report

Auto-generated legal document containing:
- Complete job timeline
- All GPS coordinates
- All photos
- Quote breakdown
- Digital signature
- Report number (e.g., LRS-2026-001234)

**Admissible as evidence in disputes or legal proceedings.**

---

## AI & Automation

### Bland.ai Voice Agent

24/7 AI phone agent for emergency calls:

| Feature | Description |
|---------|-------------|
| **Instant Answer** | No hold times, immediate response |
| **Safety Check** | Asks if customer is in danger |
| **Data Collection** | Name, phone, email, postcode, problem |
| **Account Creation** | Creates customer account automatically |
| **Job Registration** | Registers emergency request |
| **Follow-up** | Sends SMS/email with booking link |

### Intelligent Dispatch

AI-powered locksmith matching system:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Distance** | 35% | Closer locksmiths score higher |
| **Rating** | 25% | Higher-rated locksmiths preferred |
| **Availability** | 15% | Currently online = higher score |
| **Response Time** | 15% | Historically fast responders preferred |
| **Workload** | 10% | Fewer active jobs = higher score |

**Auto-Dispatch**: When match score ≥ 70%, the system can automatically dispatch the job to the best locksmith.

### Telegram Admin Bot

Admin operations via Telegram commands:

| Command | Description |
|---------|-------------|
| `/stats` | Dashboard statistics (today's jobs, revenue, etc.) |
| `/jobs` | List today's jobs |
| `/pending` | Show jobs awaiting locksmith |
| `/locksmiths` | List available locksmiths |
| `/alerts` | Show urgent issues (stuck jobs, expiring insurance) |
| `/dispatch <job>` | Find best locksmith match |
| `/assign <job> <ls>` | Assign job to specific locksmith |
| `/availability <id> <on/off>` | Toggle locksmith availability |

### Automated Processes

| Process | Trigger | Action |
|---------|---------|--------|
| **Signature Reminders** | Work completed | Send 4 reminders over 24 hours |
| **Auto-Complete** | 24h no signature | Complete job, process payment |
| **Insurance Reminders** | 7 days before expiry | Email locksmith to renew |
| **Availability Schedule** | Based on schedule | Auto-toggle online/offline |
| **Payout Generation** | Daily | Calculate and process payouts |

---

## Marketing System

### Paid Advertising

| Platform | Features |
|----------|----------|
| **Meta Ads** | Campaign management, audience creation, AI copy generation |
| **Google Ads** | Search ads, conversion tracking |
| **Microsoft Ads** | Bing search ads |

### Organic Social

| Feature | Description |
|---------|-------------|
| **Content Pillars** | Anti-fraud education, tips, success stories |
| **Autopilot Mode** | AI generates and schedules posts |
| **Image Templates** | Branded graphics for posts |
| **Multi-Platform** | Facebook + Instagram publishing |

### Email Campaigns

| Type | Purpose |
|------|---------|
| **Locksmith Announcements** | Platform updates, features |
| **Newsletters** | Tips, stats, industry news |
| **Automated Sequences** | Onboarding, re-engagement |

### SEO & Content

| Feature | Description |
|---------|-------------|
| **Blog** | SEO-optimized articles |
| **Location Pages** | City-specific landing pages |
| **FAQ Schema** | Structured data for search |
| **Sitemap** | Auto-generated |

### Attribution & Analytics

| Feature | Description |
|---------|-------------|
| **UTM Tracking** | Campaign source tracking |
| **Multi-Touch Attribution** | Full customer journey tracking |
| **Conversion Tracking** | Lead → Customer conversion |
| **ROI Reporting** | Ad spend vs revenue |

---

## Communication Channels

LockSafe UK operates across multiple channels for maximum accessibility:

### Customer Contact Channels

| Channel | Technology | Status | Use Case |
|---------|------------|--------|----------|
| **Web** | Next.js | ✅ Live | Primary booking interface |
| **Phone** | Bland.ai + Twilio | ✅ Live | 24/7 emergency calls |
| **WhatsApp** | Meta Cloud API | ⏳ Pending | Support & updates |
| **SMS** | Twilio | ✅ Live | Critical notifications |
| **Email** | Resend | ✅ Live | Confirmations & reports |

### WhatsApp Business (Coming Soon)

Customer support and job updates via WhatsApp:

| Feature | Description |
|---------|-------------|
| **Job Status Updates** | Automated notifications when status changes |
| **Locksmith En Route** | ETA and locksmith details |
| **Quote Notifications** | Prompt to review and approve quotes |
| **Signature Reminders** | Reminder to confirm job completion |
| **Customer Support** | Chat with support team |

**Message Templates** (pending Meta approval):
- `job_status_update` - Status change notifications
- `locksmith_en_route` - ETA and locksmith info
- `quote_ready` - Quote approval prompt
- `signature_reminder` - Completion confirmation
- `job_completed` - Thank you and review request

---

## Notification System

### Customer Notifications

| Event | SMS | Email | Push | WhatsApp* |
|-------|-----|-------|------|-----------|
| Job submitted | ✓ | ✓ | ✓ | ✓ |
| Locksmith applied | ✓ | ✓ | ✓ | - |
| Locksmith accepted | ✓ | ✓ | ✓ | ✓ |
| Locksmith en route | ✓ | ✓ | ✓ | ✓ |
| Locksmith arrived | ✓ | ✓ | ✓ | ✓ |
| Quote received | ✓ | ✓ | ✓ | ✓ |
| Work completed | ✓ | ✓ | ✓ | ✓ |
| Signature reminder | ✓ | ✓ | ✓ | ✓ |
| Payment confirmed | ✓ | ✓ | ✓ | ✓ |

*WhatsApp pending Meta business verification

### Locksmith Notifications

| Event | SMS | Email | Push | Telegram |
|-------|-----|-------|------|----------|
| New job in area | ✓ | ✓ | ✓ | ✓ |
| Auto-dispatched | ✓ | ✓ | ✓ | ✓ |
| Application accepted | ✓ | ✓ | ✓ | ✓ |
| Quote approved | ✓ | ✓ | ✓ | ✓ |
| Job signed | ✓ | ✓ | ✓ | ✓ |
| Payment received | ✓ | ✓ | ✓ | ✓ |
| New review | ✓ | ✓ | ✓ | ✓ |
| Insurance expiring | - | ✓ | - | - |

### Admin Notifications (Telegram)

| Event | Telegram | Details |
|-------|----------|---------|
| New customer registered | ✓ | Name, email, phone |
| New locksmith registered | ✓ | Name, company, area |
| New job listed | ✓ | Type, location, urgency |
| Locksmith applied | ✓ | Fee, ETA |
| Application accepted | ✓ | Customer + locksmith |
| Assessment fee paid | ✓ | Amount |
| Quote submitted | ✓ | Amount, items |
| Quote accepted/declined | ✓ | Decision |
| Work completed | ✓ | Total value |
| Job signed | ✓ | Confirmation |
| Payment received | ✓ | Amount, commission |
| Refund requested | ✓ | Reason |
| Job auto-completed | ✓ | No signature warning |

---

## Admin Operations

### Web Dashboard

| Section | Features |
|---------|----------|
| **Overview** | Stats, charts, recent activity |
| **Jobs** | All jobs, filters, status management |
| **Locksmiths** | List, verification, insurance tracking |
| **Customers** | Customer list, job history |
| **Payments** | Transaction history, refunds |
| **Payouts** | Pending/processed payouts |
| **Analytics** | Detailed metrics, attribution |
| **Ads** | Meta/Google campaign management |
| **Organic** | Social post creation, scheduling |
| **Emails** | Campaign creation, tracking |

### Locksmith Verification

| Step | Status |
|------|--------|
| Basic profile | Required |
| ID verification | Via Stripe |
| Insurance document | Upload required |
| Insurance expiry | Tracked, reminders sent |
| Stripe Connect | Required for payments |

### Refund Management

| Type | Policy |
|------|--------|
| No-show | Full refund, locksmith penalized |
| Customer cancel | Depends on timing |
| Quote declined | Assessment fee retained by locksmith |
| Dispute | Admin review with evidence |

---

## Customer Guarantees

### Price Guarantee
- Assessment fee stated upfront
- Work quote must be accepted before work starts
- No hidden fees or surprises

### Arrival Guarantee
- ETA provided at booking
- Auto-refund if locksmith doesn't arrive within ETA + 30 minutes
- Real-time tracking available

### Documentation Guarantee
- PDF report for every job
- All photos, GPS, signature included
- Legal protection in case of disputes

### Verification Guarantee
- All locksmiths ID verified
- Insurance verification
- Background checks
- Verified badge displayed

### Satisfaction Guarantee
- Leave reviews after service
- Dispute resolution process
- Refund policy for legitimate issues

---

## Locksmith Dashboard

### Available Jobs

| Feature | Description |
|---------|-------------|
| Job list | All jobs in your coverage area |
| Distance filter | Sort by proximity |
| Urgency indicator | Urgent jobs highlighted |
| Quick apply | Set fee + ETA, apply instantly |

### My Jobs

| Feature | Description |
|---------|-------------|
| Active jobs | Jobs you're currently working |
| Job timeline | Track progress through stages |
| Photo upload | Add before/during/after photos |
| Quote builder | Create itemized quotes |
| GPS tracking | Mark arrival, completion |

### Earnings

| Feature | Description |
|---------|-------------|
| Weekly/monthly totals | Track your earnings |
| Pending payouts | Money being processed |
| Payout history | Past payments |
| Stripe dashboard | Detailed financial view |

### Reviews

| Feature | Description |
|---------|-------------|
| All reviews | See what customers said |
| Average rating | Your overall score |
| Review responses | Reply to feedback |

### Settings

| Feature | Description |
|---------|-------------|
| Profile | Name, company, photo |
| Coverage area | Base location, radius |
| Notifications | SMS, email, push preferences |
| Availability | Online/offline toggle |
| Schedule | Set working hours |
| Documents | Upload insurance, certs |
| Stripe | Bank account management |

---

## Support & Resources

### For Locksmiths

| Resource | Location |
|----------|----------|
| Locksmith Guide | [LOCKSMITH_GUIDE.md](./LOCKSMITH_GUIDE.md) |
| Stripe Setup | [STRIPE_SETUP.md](./STRIPE_SETUP.md) |
| FAQ | Dashboard → Help |
| Support Email | partners@locksafe.uk |

### For Admins

| Resource | Location |
|----------|----------|
| Cron Setup | [CRON_SETUP.md](./CRON_SETUP.md) |
| Bland.ai Setup | [BLAND_AI_SETUP.md](./BLAND_AI_SETUP.md) |
| OpenClaw Setup | [OPENCLAW_SETUP.md](./OPENCLAW_SETUP.md) |
| Meta Ads | [META_ADS_SETUP.md](./META_ADS_SETUP.md) |
| Google Ads | [GOOGLE_ADS_SETUP.md](./GOOGLE_ADS_SETUP.md) |

### For Customers

| Resource | Location |
|----------|----------|
| Help Center | locksafe.uk/help |
| Refund Policy | locksafe.uk/refund-policy |
| Terms | locksafe.uk/terms |
| Support Email | support@locksafe.uk |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMERS                                │
│  Web (locksafe.uk) │ Phone (Bland.ai) │ Dashboard               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LOCKSAFE PLATFORM                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    API LAYER                             │   │
│  │  Jobs │ Quotes │ Payments │ Auth │ Notifications        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 BUSINESS LOGIC                           │   │
│  │  Dispatch │ Pricing │ Fraud Detection │ Auto-Complete   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   DATA LAYER                             │   │
│  │  MongoDB │ Prisma ORM │ File Storage                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   LOCKSMITHS    │ │     ADMINS      │ │  INTEGRATIONS   │
│  Dashboard      │ │  Web Dashboard  │ │  Stripe Connect │
│  Mobile Web     │ │  Telegram Bot   │ │  Twilio SMS     │
│  Notifications  │ │  Agent APIs     │ │  Resend Email   │
└─────────────────┘ └─────────────────┘ │  Bland.ai       │
                                        │  Meta Ads       │
                                        │  Google Ads     │
                                        │  Mapbox         │
                                        └─────────────────┘
```

---

## Cron Jobs & Automation

| Job | Schedule | Purpose |
|-----|----------|---------|
| Signature Reminders | Every 15 mins | Send reminders, auto-complete jobs |
| Availability Schedule | Every 5 mins | Toggle locksmith availability |
| Insurance Reminders | Daily 9am | Warn about expiring insurance |
| Generate Payouts | Daily 2am | Calculate pending payouts |
| Publish Organic | Hourly | Post scheduled social content |
| Generate Organic | Daily 6am | AI generate new content |
| Sync Meta Performance | Every 6 hours | Update ad metrics |

---

## API Reference

### Public APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/jobs` | POST | Create new job |
| `/api/jobs/[id]` | GET | Get job details |
| `/api/locksmiths` | GET | List locksmiths |
| `/api/auth/*` | POST | Authentication |

### Agent APIs (OpenClaw)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/jobs` | GET | List/filter jobs |
| `/api/agent/locksmiths` | GET/PATCH | Manage locksmiths |
| `/api/agent/stats` | GET | Dashboard stats |
| `/api/agent/dispatch` | GET/POST | Intelligent dispatch |
| `/api/agent/alerts` | GET | System alerts |
| `/api/agent/telegram` | POST | Telegram webhook |

### Webhook Endpoints

| Endpoint | Source | Purpose |
|----------|--------|---------|
| `/api/webhooks/stripe` | Stripe | Payment events |
| `/api/webhooks/resend` | Resend | Email events |
| `/api/webhooks/meta` | Meta | Ad events |
| `/api/bland/webhook` | Bland.ai | Call events |

---

*LockSafe UK - The fair, transparent, and technology-driven platform for professional locksmiths*

**Version**: 3.0
**Last Updated**: March 2026

---

## Related Documentation

- [README.md](./README.md) - Documentation index
- [FEATURES.md](./FEATURES.md) - Complete features guide
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Technical architecture
- [LOCKSMITH_GUIDE.md](./LOCKSMITH_GUIDE.md) - Partner guide
- [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md) - Integration status
- [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) - WhatsApp Business API
- [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) - Telegram bot setup
- [BLAND_AI_SETUP.md](./BLAND_AI_SETUP.md) - Voice AI setup
