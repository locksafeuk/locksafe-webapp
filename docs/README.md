# LockSafe UK Documentation

> **The UK's First Anti-Fraud Emergency Locksmith Marketplace**

Welcome to the LockSafe UK documentation. This guide covers everything from platform features to technical integrations.

---

## Quick Links

| I want to... | Go to... |
|--------------|----------|
| Understand the platform | [Platform Overview](./PLATFORM_OVERVIEW.md) |
| See all features | [Features Guide](./FEATURES.md) |
| Join as a locksmith | [Locksmith Guide](./LOCKSMITH_GUIDE.md) |
| Set up integrations | [Integration Checklist](./INTEGRATION_CHECKLIST.md) |
| Configure production | [Production Setup Guide](./PRODUCTION_SETUP_GUIDE.md) |

---

## What is LockSafe UK?

LockSafe UK is a **full-stack emergency locksmith marketplace** that connects:

- **Customers** who need urgent locksmith services
- **Verified locksmiths** who provide those services
- **Administrators** who manage operations

### What Makes Us Different

| Traditional Locksmith Services | LockSafe UK |
|-------------------------------|-------------|
| Pay per lead (waste money) | Pay only on completed jobs |
| No payment guarantee | Pre-paid assessment fees |
| No documentation | GPS, photos, signatures, PDF reports |
| Manual invoicing | Automatic Stripe payouts |
| No verification | ID-verified, insured, background-checked |

---

## Platform Capabilities

### Customer Contact Channels

| Channel | Description | Status |
|---------|-------------|--------|
| **Web** | Full booking flow at locksafe.uk | ✅ Live |
| **Phone** | AI Voice Agent (Bland.ai) | ✅ Live |
| **WhatsApp** | WhatsApp Business API | ⏳ Pending Meta Verification |
| **Email** | Transactional & support emails | ✅ Live |
| **SMS** | Critical notifications (Twilio) | ✅ Live |

### Admin Operations

| Channel | Description | Status |
|---------|-------------|--------|
| **Web Dashboard** | Full admin panel | ✅ Live |
| **Telegram Bot** | Real-time notifications & commands | ✅ Live |
| **Email Campaigns** | Marketing & announcements | ✅ Live |

### Locksmith Operations

| Channel | Description | Status |
|---------|-------------|--------|
| **Web Dashboard** | Job management & earnings | ✅ Live |
| **Telegram Bot** | Job notifications & commands | ✅ Live |
| **SMS** | Critical job alerts | ✅ Live |

---

## Key Features

### For Customers

- **Smart Intent Detection** - Tailored experience based on urgency
- **Transparent Pricing** - See quotes before work starts
- **Real-Time Tracking** - GPS tracking of your locksmith
- **Digital Signatures** - Legally-binding job confirmation
- **PDF Reports** - Complete documentation for every job
- **Auto-Refunds** - If locksmith doesn't arrive on time
- **Verified Professionals** - All locksmiths background-checked

### For Locksmiths

- **Set Your Own Prices** - You choose your assessment fees
- **Pre-Paid Jobs** - Customer pays before you travel
- **Intelligent Dispatch** - AI matches you with nearby jobs
- **Next-Day Payouts** - Via Stripe Connect
- **Digital Documentation** - GPS, photos, signatures protect you
- **Review System** - Build your reputation
- **Flexible Scheduling** - Work when you want

### For Admins

- **AI-Powered Ad Management** - Create Meta/Google ads with AI
- **Organic Content Automation** - Auto-generate social posts
- **Telegram Bot Control** - Manage operations via chat
- **Real-Time Analytics** - Track conversions & attribution
- **Email Campaigns** - Send newsletters & announcements
- **Automated Workflows** - Cron jobs handle routine tasks

---

## Documentation Index

### Platform Guides

| Document | Description |
|----------|-------------|
| [PLATFORM_OVERVIEW.md](./PLATFORM_OVERVIEW.md) | Complete platform documentation |
| [FEATURES.md](./FEATURES.md) | All customer-facing features |
| [LOCKSMITH_GUIDE.md](./LOCKSMITH_GUIDE.md) | Guide for locksmith partners |
| [REFUND_POLICY.md](./REFUND_POLICY.md) | Refund and cancellation policy |

### Technical Setup

| Document | Description |
|----------|-------------|
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Technical architecture overview |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API documentation |
| [PRODUCTION_SETUP_GUIDE.md](./PRODUCTION_SETUP_GUIDE.md) | Production deployment guide |
| [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md) | Integration status & setup |

### Communication Integrations

| Document | Description |
|----------|-------------|
| [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) | Telegram bot configuration |
| [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) | WhatsApp Business API setup |
| [WHATSAPP_WEBHOOK_SETUP.md](./WHATSAPP_WEBHOOK_SETUP.md) | Detailed webhook configuration |
| [BLAND_AI_SETUP.md](./BLAND_AI_SETUP.md) | Voice AI phone agent setup |
| [BLAND_PATHWAY_MANUAL_SETUP.md](./BLAND_PATHWAY_MANUAL_SETUP.md) | Bland.ai pathway configuration |
| [BLAND_WEBHOOK_AUTH.md](./BLAND_WEBHOOK_AUTH.md) | Bland.ai webhook authentication |

### Payment & Finance

| Document | Description |
|----------|-------------|
| [STRIPE_SETUP.md](./STRIPE_SETUP.md) | Stripe & Stripe Connect configuration |

### Marketing & Ads

| Document | Description |
|----------|-------------|
| [META_ADS_SETUP.md](./META_ADS_SETUP.md) | Meta (Facebook/Instagram) Ads setup |
| [META_ADS_COMPLETE_SETUP.md](./META_ADS_COMPLETE_SETUP.md) | Complete Meta marketing guide |
| [GOOGLE_ADS_SETUP.md](./GOOGLE_ADS_SETUP.md) | Google Ads configuration |
| [MARKETING_FUNNEL_PLAN.md](./MARKETING_FUNNEL_PLAN.md) | Marketing strategy |
| [PAID_ADS_INTEGRATION_PLAN.md](./PAID_ADS_INTEGRATION_PLAN.md) | Paid advertising integration |
| [RETARGETING_GUIDE.md](./RETARGETING_GUIDE.md) | Retargeting campaign setup |

### AI & Automation

| Document | Description |
|----------|-------------|
| [NLP_FEATURES.md](./NLP_FEATURES.md) | Natural Language Processing features |
| [AI_AD_SYSTEM_TODO.md](./AI_AD_SYSTEM_TODO.md) | AI ad generation system |
| [OPENCLAW_INTEGRATION_ANALYSIS.md](./OPENCLAW_INTEGRATION_ANALYSIS.md) | AI agent integration |
| [OPENCLAW_SETUP.md](./OPENCLAW_SETUP.md) | OpenClaw AI setup |

### Operations

| Document | Description |
|----------|-------------|
| [CRON_SETUP.md](./CRON_SETUP.md) | Cron job configuration |
| [CRON_JOBS_COMPLETE.md](./CRON_JOBS_COMPLETE.md) | Complete cron job reference |

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js API Routes, Node.js |
| **Database** | MongoDB (via Prisma ORM) |
| **Payments** | Stripe Connect |
| **Email** | Resend |
| **SMS** | Twilio |
| **Voice AI** | Bland.ai |
| **Maps** | Mapbox |
| **AI/NLP** | OpenAI GPT-4 |
| **Hosting** | Netlify |

---

## Environment Variables

All integrations require environment variables. See `.env.example` for the complete list.

### Required for Core Function
- `DATABASE_URL` - MongoDB connection
- `STRIPE_SECRET_KEY` - Stripe API key
- `RESEND_API_KEY` - Email service
- `JWT_SECRET` - Authentication
- `NEXT_PUBLIC_BASE_URL` - Application URL

### Communication Channels
- `TELEGRAM_BOT_TOKEN` - Telegram bot
- `WHATSAPP_*` - WhatsApp Business API
- `BLAND_API_KEY` - Voice AI
- `TWILIO_*` - SMS

### Marketing & AI
- `OPENAI_API_KEY` - AI features
- `META_*` - Meta Ads API
- `NEXT_PUBLIC_META_PIXEL_ID` - Tracking
- `NEXT_PUBLIC_GOOGLE_ADS_ID` - Google Ads

---

## Support

| Resource | Contact |
|----------|---------|
| Customer Support | support@locksafe.uk |
| Locksmith Partners | partners@locksafe.uk |
| Technical Issues | Contact Same support |

---

*LockSafe UK - Fair jobs, fair pay, full protection.*

**Version**: 3.0
**Last Updated**: March 2026
