# LockSafe UK - System Architecture

> **The UK's First Anti-Fraud Emergency Locksmith Marketplace**

---

## Overview

LockSafe UK is a **full-stack emergency locksmith marketplace platform** built with Next.js 16, providing a complete solution for connecting customers with verified locksmiths. The platform emphasizes transparency, anti-fraud protection, and multi-channel communication.

### Key Differentiators

- **Multi-Channel Customer Intake**: Web, Phone (AI), WhatsApp, SMS
- **Anti-Fraud Protection**: GPS tracking, photo evidence, digital signatures
- **Automated Operations**: AI dispatch, cron jobs, Telegram bot management
- **Transparent Pricing**: Tiered commission structure (15%/25%)
- **Instant Payouts**: Via Stripe Connect

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework |
| **Language** | TypeScript | Type-safe development |
| **Database** | MongoDB (via Prisma ORM) | Data persistence |
| **Styling** | Tailwind CSS + shadcn/ui | Modern UI components |
| **Payments** | Stripe Connect | Customer payments & locksmith payouts |
| **Email** | Resend | Transactional & marketing emails |
| **SMS** | Twilio | Critical notifications |
| **Voice AI** | Bland.ai | 24/7 AI phone agent |
| **WhatsApp** | Meta Cloud API | Customer support channel |
| **Telegram** | Bot API | Admin & locksmith operations |
| **Maps** | Mapbox | Geocoding & live tracking |
| **Hosting** | Netlify | Dynamic deployment |
| **AI/NLP** | OpenAI GPT-4 | Content generation & NLP |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER CHANNELS                              │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────┤
│    Web      │   Phone     │  WhatsApp   │    SMS      │     Email       │
│ locksafe.uk │  Bland.ai   │  Meta API   │   Twilio    │    Resend       │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────────┬────────┘
       │             │             │             │               │
       └─────────────┴─────────────┴─────────────┴───────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LOCKSAFE PLATFORM                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        API LAYER (Next.js)                         │  │
│  │  /api/jobs │ /api/payments │ /api/auth │ /api/webhooks            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                       BUSINESS LOGIC                               │  │
│  │  Intelligent Dispatch │ Tiered Pricing │ Fraud Detection          │  │
│  │  Auto-Complete │ GPS Verification │ Commission Calculations       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        DATA LAYER                                  │  │
│  │  MongoDB │ Prisma ORM │ File Storage (Vercel Blob)                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   LOCKSMITHS    │     │      ADMINS         │     │   INTEGRATIONS      │
│  ─────────────  │     │  ─────────────────  │     │  ─────────────────  │
│  Web Dashboard  │     │  Web Dashboard      │     │  Stripe Connect     │
│  Telegram Bot   │     │  Telegram Bot       │     │  Twilio Voice/SMS   │
│  SMS Alerts     │     │  Email Campaigns    │     │  Resend Email       │
│  Email Notifs   │     │  AI Ad Management   │     │  Bland.ai           │
└─────────────────┘     │  Organic Social     │     │  Meta Ads API       │
                        └─────────────────────┘     │  Mapbox             │
                                                    │  OpenAI             │
                                                    └─────────────────────┘
```

---

## Directory Structure

```
locksafe-uk/
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── app/
│   │   ├── api/                   # API routes (REST endpoints)
│   │   │   ├── admin/             # Admin dashboard APIs
│   │   │   ├── agent/             # AI Agent APIs (Telegram bot, NLP)
│   │   │   ├── auth/              # Authentication
│   │   │   ├── bland/             # Bland.ai voice integration
│   │   │   ├── cron/              # Scheduled jobs
│   │   │   ├── customer/          # Customer APIs
│   │   │   ├── jobs/              # Job management
│   │   │   ├── locksmith/         # Locksmith APIs
│   │   │   ├── marketing/         # Marketing & tracking
│   │   │   ├── notifications/     # Push notifications
│   │   │   ├── payments/          # Stripe payments
│   │   │   ├── tracking/          # Analytics tracking
│   │   │   └── webhooks/          # External webhooks
│   │   ├── admin/                 # Admin dashboard pages
│   │   ├── customer/              # Customer portal pages
│   │   ├── locksmith/             # Locksmith portal pages
│   │   └── ...                    # Public pages
│   ├── components/                # React components
│   │   ├── ui/                    # shadcn/ui components
│   │   └── ...                    # Custom components
│   ├── hooks/                     # Custom React hooks
│   └── lib/                       # Utilities & services
│       ├── email.ts               # Email sending
│       ├── sms.ts                 # SMS sending
│       ├── telegram.ts            # Telegram notifications
│       ├── telegram-bot.ts        # Telegram bot commands
│       ├── whatsapp-business.ts   # WhatsApp API
│       ├── stripe.ts              # Payment processing
│       ├── intelligent-dispatch.ts # AI job matching
│       ├── openai-ads.ts          # AI ad copy
│       └── ...                    # Other utilities
├── docs/                          # Documentation
└── public/                        # Static assets
```

---

## Communication Channels

### Customer Intake

| Channel | Technology | Status | Use Case |
|---------|------------|--------|----------|
| **Web** | Next.js | ✅ Live | Primary booking interface |
| **Phone** | Bland.ai + Twilio | ✅ Live | 24/7 emergency calls |
| **WhatsApp** | Meta Cloud API | ⏳ Pending | Support & updates |
| **SMS** | Twilio | ✅ Live | Critical notifications |
| **Email** | Resend | ✅ Live | Confirmations & reports |

### Admin Operations

| Channel | Technology | Status | Use Case |
|---------|------------|--------|----------|
| **Web Dashboard** | Next.js | ✅ Live | Full admin panel |
| **Telegram Bot** | Bot API | ✅ Live | Real-time management |

### Locksmith Operations

| Channel | Technology | Status | Use Case |
|---------|------------|--------|----------|
| **Web Dashboard** | Next.js | ✅ Live | Job management |
| **Telegram Bot** | Bot API | ✅ Live | Job notifications |
| **SMS** | Twilio | ✅ Live | Critical alerts |
| **Email** | Resend | ✅ Live | Updates & reports |

---

## Core Features

### 1. Customer Flow

```
Customer Request → Intent Detection → Location Entry → Locksmith Selection
       ↓                                                      ↓
   Assessment Fee Payment → Locksmith Dispatched → GPS Tracking
       ↓                                                      ↓
   Arrival & Photos → Quote → Customer Approval → Work
       ↓                                                      ↓
   Completion → Customer Signature → Payment → PDF Report
```

**Features**:
- Smart intent detection modal (urgency tiers)
- Real-time GPS tracking of locksmith
- Digital quotes with approval workflow
- Secure payments via Stripe
- Digital signature capture
- Auto-generated PDF job reports

### 2. Locksmith Flow

```
Job Notification → Review & Apply → Customer Selects → Travel
       ↓                                                 ↓
   Mark En Route (GPS) → Arrive (GPS) → Take Photos
       ↓                                                 ↓
   Submit Quote → Customer Approves → Complete Work → Photos
       ↓                                                 ↓
   Mark Complete (GPS) → Customer Signs → Payment Released
```

**Features**:
- Dashboard with job listings in coverage area
- GPS-based job matching (radius coverage)
- Quote builder with parts/labor
- Photo documentation (before/during/after)
- Earnings tracking & payout history
- Stripe Connect instant payouts

### 3. Admin Dashboard

| Section | Features |
|---------|----------|
| **Overview** | Stats, charts, recent activity |
| **Jobs** | Job list, filters, status management, reassignment |
| **Locksmiths** | Verification, insurance tracking, availability |
| **Customers** | Customer list, job history |
| **Payments** | Transactions, refunds |
| **Payouts** | Pending & processed locksmith payments |
| **Analytics** | Metrics, attribution, ROI |
| **Ads** | Meta/Google campaign management, AI copy |
| **Organic** | Social content scheduling, autopilot |
| **Emails** | Campaign creation, tracking, previews |

### 4. Telegram Admin Bot

Real-time operations via @Locksafeukbot:

| Command | Description |
|---------|-------------|
| `/stats` | Today's jobs, revenue, key metrics |
| `/jobs` | List today's jobs |
| `/pending` | Jobs awaiting locksmith |
| `/locksmiths` | Available locksmiths |
| `/alerts` | Urgent issues (stuck jobs, expiring insurance) |
| `/dispatch <job>` | Find best locksmith match |
| `/assign <job> <ls>` | Assign job to specific locksmith |
| `/availability <id> <on/off>` | Toggle locksmith availability |

---

## Database Models

### Primary Entities

| Model | Purpose |
|-------|---------|
| `Customer` | End users requesting services |
| `Locksmith` | Service providers |
| `Job` | Service requests |
| `JobApplication` | Locksmith applications to jobs |
| `Quote` | Price quotations |
| `Payment` | Transaction records |
| `Payout` | Locksmith earnings |
| `Review` | Customer feedback |

### Supporting Entities

| Model | Purpose |
|-------|---------|
| `Signature` | Digital signatures |
| `Photo` | Job documentation |
| `Report` | PDF reports |
| `Notification` | In-app notifications |
| `AvailabilitySchedule` | Locksmith working hours |

### Marketing Entities

| Model | Purpose |
|-------|---------|
| `UserSession` | Visitor tracking |
| `PageView` | Page analytics |
| `UserEvent` | Interaction tracking |
| `LeadMagnet` | Lead capture |
| `AdCampaign` | Meta Ads campaigns |
| `SocialPost` | Organic content |
| `EmailCampaign` | Email marketing |

---

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Customer login |
| `/api/auth/register` | POST | Customer registration |
| `/api/auth/forgot-password` | POST | Password reset request |
| `/api/auth/verify-email` | POST | Email verification |
| `/api/locksmiths/auth` | POST | Locksmith login |
| `/api/admin/auth` | POST | Admin login |

### Jobs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | GET/POST | List/create jobs |
| `/api/jobs/[id]` | GET/PUT | Get/update job |
| `/api/jobs/[id]/applications` | GET/POST | Job applications |
| `/api/jobs/[id]/accept-application` | POST | Accept an application |
| `/api/jobs/[id]/quote` | POST | Submit quote |
| `/api/jobs/[id]/signature` | POST | Capture signature |
| `/api/jobs/[id]/status` | PUT | Update status |
| `/api/jobs/[id]/photos` | POST | Upload photos |
| `/api/jobs/[id]/confirm-completion` | POST | Customer confirms |

### Payments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create-intent` | POST | Create Stripe PaymentIntent |
| `/api/payments/setup-card` | POST | Save card for later |
| `/api/payments/charge-saved-card` | POST | Charge saved card |
| `/api/stripe-connect` | GET | Get Connect status |
| `/api/stripe-connect/onboard` | POST | Locksmith Stripe onboarding |

### Webhooks (External Services)

| Endpoint | Method | Source | Description |
|----------|--------|--------|-------------|
| `/api/webhooks/stripe` | POST | Stripe | Payment events |
| `/api/webhooks/whatsapp` | GET/POST | Meta | WhatsApp messages |
| `/api/webhooks/meta` | POST | Meta | Ad events |
| `/api/webhooks/resend` | POST | Resend | Email delivery events |
| `/api/agent/telegram` | GET/POST | Telegram | Admin bot commands |
| `/api/locksmith/bot` | GET/POST | Telegram | Locksmith bot |
| `/api/bland/webhook` | POST | Bland.ai | Voice call events |

### Cron Jobs

| Endpoint | Frequency | Description |
|----------|-----------|-------------|
| `/api/cron/signature-reminders` | Every 15 min | Send reminders, auto-complete |
| `/api/cron/availability-schedule` | Every 5 min | Toggle availability |
| `/api/cron/insurance-reminders` | Daily 9AM | Expiry warnings |
| `/api/cron/generate-payouts` | Daily 2AM | Calculate payouts |
| `/api/cron/sync-meta-performance` | Every 6 hours | Sync ad metrics |
| `/api/cron/publish-organic` | Hourly | Publish scheduled posts |
| `/api/cron/generate-organic` | Daily 6AM | AI generate content |

### AI & Agent APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/jobs` | GET | List jobs (NLP-aware) |
| `/api/agent/locksmiths` | GET/PATCH | Manage locksmiths |
| `/api/agent/stats` | GET | Dashboard statistics |
| `/api/agent/dispatch` | GET/POST | Intelligent dispatch |
| `/api/agent/alerts` | GET | System alerts |
| `/api/agent/nlp` | POST | Natural language queries |
| `/api/admin/ai/chat` | POST | AI chat assistant |
| `/api/admin/ai/generate-copy` | POST | AI ad copy generation |

---

## Environment Variables

See `.env.example` for complete list. Key variables:

### Required
```env
DATABASE_URL          # MongoDB connection
STRIPE_SECRET_KEY     # Stripe API key
STRIPE_WEBHOOK_SECRET # Webhook verification
RESEND_API_KEY        # Email service
NEXT_PUBLIC_BASE_URL  # Application URL
JWT_SECRET            # Auth tokens
CRON_SECRET           # Cron job auth
```

### Communication
```env
TELEGRAM_BOT_TOKEN    # Telegram bot
TELEGRAM_CHAT_ID      # Admin chat
TWILIO_ACCOUNT_SID    # Twilio
TWILIO_AUTH_TOKEN     # Twilio
TWILIO_PHONE_NUMBER   # Voice number
BLAND_API_KEY         # Voice AI
BLAND_PATHWAY_ID      # Pathway
WHATSAPP_*            # WhatsApp Business
```

### AI & Marketing
```env
OPENAI_API_KEY        # GPT-4
NEXT_PUBLIC_MAPBOX_TOKEN # Maps
META_*                # Meta Marketing API
NEXT_PUBLIC_META_PIXEL_ID # Pixel tracking
NEXT_PUBLIC_GA_MEASUREMENT_ID # Analytics
```

---

## Anti-Fraud Protection

| Feature | Purpose |
|---------|---------|
| **GPS at every stage** | Proves locksmith attendance |
| **Photo evidence** | Before/after documentation |
| **Digital signatures** | Legal confirmation |
| **PDF reports** | Admissible documentation |
| **Pre-payment** | Assessment fee before travel |
| **ID verification** | Via Stripe Connect |
| **Insurance tracking** | Expiry monitoring |

---

## Deployment

### Netlify Configuration

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Build Commands

```bash
# Install dependencies
bun install

# Generate Prisma client
npx prisma generate

# Build production
bun run build

# Start development
bun run dev
```

---

## Security Features

1. **Authentication**: JWT-based with secure cookies
2. **API Protection**: Route middleware validation
3. **CSRF Protection**: Token-based verification
4. **Rate Limiting**: Implemented on sensitive endpoints
5. **Webhook Verification**: Secret-based validation
6. **GPS Tracking**: Anti-fraud location verification
7. **PCI Compliance**: Stripe-handled payments
8. **Encryption**: HTTPS everywhere

---

## Monitoring & Analytics

| Tool | Purpose |
|------|---------|
| **Google Analytics** | User behavior |
| **Meta Pixel** | Ad conversion tracking |
| **Custom Events** | Job funnel analytics |
| **Telegram Alerts** | Real-time admin notifications |
| **Error Logging** | Console + structured logs |
| **Attribution** | Multi-touch conversion tracking |

---

## Related Documentation

- [README.md](./README.md) - Documentation index
- [FEATURES.md](./FEATURES.md) - Complete features guide
- [PLATFORM_OVERVIEW.md](./PLATFORM_OVERVIEW.md) - Full platform docs
- [LOCKSMITH_GUIDE.md](./LOCKSMITH_GUIDE.md) - Locksmith partner guide
- [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md) - Integration status
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) - Payment configuration
- [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) - Telegram bot setup
- [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) - WhatsApp Business setup
- [BLAND_AI_SETUP.md](./BLAND_AI_SETUP.md) - Voice AI setup
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API docs

---

*LockSafe UK - The fair, transparent, and technology-driven platform for professional locksmiths*

**Version**: 3.0
**Last Updated**: March 2026
