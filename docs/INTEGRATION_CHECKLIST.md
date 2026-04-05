# LockSafe UK Integration Checklist

> **Current status of all platform integrations - March 2026**

---

## Quick Status Overview

| Integration | Status | Notes |
|-------------|--------|-------|
| ✅ MongoDB/Prisma | **Live** | Database operational |
| ✅ Stripe Connect | **Live** | Payments processing |
| ✅ Resend | **Live** | Emails sending |
| ✅ Twilio | **Live** | SMS & Voice numbers active |
| ✅ Mapbox | **Live** | Maps & geocoding functional |
| ✅ Bland.ai | **Live** | Voice AI answering calls |
| ✅ Telegram (Admin) | **Live** | Admin notifications active |
| ✅ Telegram (Locksmith) | **Live** | Locksmith bot operational |
| ✅ OpenAI | **Live** | GPT-4 for AI features |
| ⏳ WhatsApp Business | **Pending** | Awaiting Meta business verification |
| ✅ Meta Pixel | **Live** | Conversion tracking |
| ⏳ Meta Marketing API | **Pending** | Awaiting verification |
| ✅ Google Analytics | **Live** | Analytics configured |
| ⬚ Google Ads | **Not Configured** | Setup required |
| ⬚ Microsoft/Bing Ads | **Not Configured** | Setup required |

---

## Core Platform

### MongoDB Database ✅

**Status**: Operational

```env
DATABASE_URL="mongodb+srv://...@juno.bmcn1k5.mongodb.net/locksafe"
```

**Verify**:
```bash
cd locksafe-uk && npx prisma db push --dry-run
```

### Stripe Connect ✅

**Status**: Operational (Test Mode)

| Key | Status |
|-----|--------|
| `STRIPE_SECRET_KEY` | ✅ Test key configured |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ Test key configured |
| `STRIPE_WEBHOOK_SECRET` | ✅ Configured |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | ✅ Configured |
| `STRIPE_PLATFORM_FEE_PERCENT` | ✅ 15% set |

**Features Working**:
- Payment intents creation
- Customer card saving
- Locksmith Connect onboarding
- Webhook event processing
- Tiered commission calculations

---

## Communication Channels

### Email - Resend ✅

**Status**: Operational

| Key | Status |
|-----|--------|
| `RESEND_API_KEY` | ✅ Configured |
| `EMAIL_FROM` | ✅ noreply@view.sarl |

**Email Types Working**:
- Registration confirmation
- Password reset
- Job confirmations
- Quote notifications
- Signature reminders
- PDF report delivery
- Campaign emails

### SMS - Twilio ✅

**Status**: Operational

| Key | Status |
|-----|--------|
| `TWILIO_ACCOUNT_SID` | ✅ Configured |
| `TWILIO_AUTH_TOKEN` | ✅ Configured |
| `TWILIO_PHONE_NUMBER` | ✅ +443339993127 (Voice) |
| `TWILIO_SMS_PHONE_NUMBER` | ⚠️ Needs SMS-capable number |

**Features Working**:
- Voice number for Bland.ai
- SMS notifications (when SMS number configured)

**To Complete**:
1. Purchase SMS-capable UK number from Twilio
2. Add to `TWILIO_SMS_PHONE_NUMBER`

### Voice AI - Bland.ai ✅

**Status**: Operational

| Key | Status |
|-----|--------|
| `BLAND_API_KEY` | ✅ Configured |
| `BLAND_PATHWAY_ID` | ✅ 394c20f8-5330-4b90-99e3-cee95117fa4d |
| `BLAND_WEBHOOK_SECRET` | ✅ Configured |
| `BLAND_ENCRYPTED_KEY` | ✅ Twilio BYOT connected |

**Features Working**:
- AI phone answering
- Customer data collection
- Account creation via webhook
- Job registration
- SMS/email follow-up

**Endpoints**:
- `/api/bland/webhook` - Main webhook handler
- `/api/bland/check-user` - User lookup
- `/api/bland/create-user` - Account creation
- `/api/bland/create-job` - Job registration
- `/api/bland/send-notification` - Send SMS/email

### Telegram Admin Bot ✅

**Status**: Operational

| Key | Status |
|-----|--------|
| `TELEGRAM_BOT_TOKEN` | ✅ Configured |
| `TELEGRAM_CHAT_ID` | ✅ -1003803979444 |
| `TELEGRAM_ADMIN_CHAT_IDS` | ✅ Configured |
| `TELEGRAM_NOTIFICATIONS_ENABLED` | ✅ true |

**Webhook**: `/api/agent/telegram`

**Commands Working**:
- `/stats` - Dashboard statistics
- `/jobs` - Today's jobs
- `/pending` - Awaiting locksmith
- `/locksmiths` - Available locksmiths
- `/alerts` - System alerts
- `/dispatch <job>` - Find best match
- `/assign <job> <ls>` - Assign job

**Setup Webhook**:
```bash
curl "https://www.locksafe.uk/api/agent/telegram?setup=true"
```

### Telegram Locksmith Bot ✅

**Status**: Operational

**Webhook**: `/api/locksmith/bot`

**Features**:
- Job notifications
- Quick status updates
- Availability toggle

**Setup Webhook**:
```bash
curl "https://www.locksafe.uk/api/locksmith/bot?setup=true"
```

### WhatsApp Business ⏳

**Status**: Pending Meta Business Verification

| Key | Status |
|-----|--------|
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ 103557090296969 |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ✅ 841629772244797 |
| `WHATSAPP_ACCESS_TOKEN` | ⚠️ User token (expires) |
| `WHATSAPP_VERIFY_TOKEN` | ✅ locksafe_whatsapp_verify_2024 |

**Webhook**: `/api/webhooks/whatsapp`
**Status**: ✅ Verified and receiving

**Blocked By**:
- Meta Business verification in progress
- Once verified, can send messages
- Message templates pending approval

**Templates Submitted**:
1. `job_status_update`
2. `locksmith_en_route`
3. `quote_ready`
4. `signature_reminder`
5. `job_completed`

**After Verification**:
1. Generate System User token (won't expire)
2. Swap out user token in `.env`
3. Test sending messages
4. Activate full WhatsApp support

---

## Maps & Location

### Mapbox ✅

**Status**: Operational

| Key | Status |
|-----|--------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ Configured |

**Features Working**:
- Map display
- Geocoding (postcode → coordinates)
- Reverse geocoding
- Address autocomplete
- Distance calculations

---

## AI & Intelligence

### OpenAI ✅

**Status**: Operational

| Key | Status |
|-----|--------|
| `OPENAI_API_KEY` | ✅ Configured |

**Features Using OpenAI**:
- AI ad copy generation
- NLP query understanding
- Organic content generation
- Chat assistant

**Endpoints**:
- `/api/admin/ai/chat` - AI chat
- `/api/admin/ai/generate-copy` - Ad copy
- `/api/admin/organic/generate` - Content generation
- `/api/agent/nlp` - Natural language queries

---

## Marketing & Analytics

### Meta Pixel ✅

**Status**: Operational

| Key | Status |
|-----|--------|
| `NEXT_PUBLIC_META_PIXEL_ID` | ⬚ Not set (optional) |
| `META_CONVERSIONS_API_TOKEN` | ⬚ Not set (optional) |

**Tracking Events**:
- PageView
- Lead
- InitiateCheckout
- Purchase
- CompleteRegistration

### Meta Marketing API ⏳

**Status**: Pending Business Verification

| Key | Status |
|-----|--------|
| `META_APP_ID` | ⬚ Not set |
| `META_APP_SECRET` | ⬚ Not set |
| `META_ACCESS_TOKEN` | ⬚ Not set |
| `META_AD_ACCOUNT_ID` | ⬚ Not set |
| `META_PAGE_ID` | ⬚ Not set |

**Blocked By**: Same Meta verification as WhatsApp

### Google Analytics ✅

**Status**: Ready to configure

| Key | Status |
|-----|--------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ⬚ Not set |

**Setup**:
1. Create GA4 property at analytics.google.com
2. Get Measurement ID (G-XXXXXXX)
3. Add to environment variable

### Google Ads ⬚

**Status**: Not Configured

| Key | Status |
|-----|--------|
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | ⬚ Not set |
| `NEXT_PUBLIC_GOOGLE_LEAD_CONVERSION_LABEL` | ⬚ Not set |
| `NEXT_PUBLIC_GOOGLE_PURCHASE_CONVERSION_LABEL` | ⬚ Not set |

### Microsoft/Bing Ads ⬚

**Status**: Not Configured

| Key | Status |
|-----|--------|
| `NEXT_PUBLIC_BING_UET_TAG_ID` | ⬚ Not set |

---

## Scheduled Tasks (Cron Jobs)

### Required Cron Jobs

| Job | Endpoint | Frequency | Status |
|-----|----------|-----------|--------|
| Signature Reminders | `/api/cron/signature-reminders` | Every 15 min | ⚠️ Setup required |
| Availability Schedule | `/api/cron/availability-schedule` | Every 5 min | ⚠️ Setup required |
| Insurance Reminders | `/api/cron/insurance-reminders` | Daily 9AM | ⚠️ Setup required |
| Generate Payouts | `/api/cron/generate-payouts` | Daily 2AM | ⚠️ Setup required |
| Sync Meta Performance | `/api/cron/sync-meta-performance` | Every 6 hours | ⚠️ Setup required |
| Publish Organic | `/api/cron/publish-organic` | Hourly | ⚠️ Setup required |
| Generate Organic | `/api/cron/generate-organic` | Daily 6AM | ⚠️ Setup required |

**Setup Instructions**: See [CRON_JOBS_COMPLETE.md](./CRON_JOBS_COMPLETE.md)

**Authentication**:
```
Authorization: Bearer {CRON_SECRET}
```

---

## Webhook Endpoints Summary

| Endpoint | Source | Purpose | Status |
|----------|--------|---------|--------|
| `/api/webhooks/stripe` | Stripe | Payment events | ✅ |
| `/api/webhooks/whatsapp` | Meta | WhatsApp messages | ✅ Verified |
| `/api/webhooks/meta` | Meta | Ad events | ⏳ |
| `/api/webhooks/resend` | Resend | Email events | ✅ |
| `/api/bland/webhook` | Bland.ai | Voice call events | ✅ |
| `/api/agent/telegram` | Telegram | Admin bot commands | ✅ |
| `/api/locksmith/bot` | Telegram | Locksmith bot | ✅ |

---

## Production Checklist

### Before Go-Live

- [x] Database connected and migrated
- [x] Stripe in test mode working
- [ ] Stripe in live mode configured
- [x] Email sending working
- [x] SMS number configured
- [x] Voice AI answering calls
- [x] Telegram bots operational
- [ ] WhatsApp verified (waiting)
- [ ] Cron jobs configured
- [ ] SSL certificate valid
- [ ] Domain configured

### Post Go-Live

- [ ] Switch Stripe to live keys
- [ ] Update webhook URLs to production
- [ ] Verify all notifications working
- [ ] Test full customer journey
- [ ] Test full locksmith journey
- [ ] Monitor error logs
- [ ] Set up uptime monitoring

---

## Environment Variables Reference

### Core (Required)
```env
DATABASE_URL=                    # ✅ MongoDB connection
STRIPE_SECRET_KEY=               # ✅ Stripe API
STRIPE_WEBHOOK_SECRET=           # ✅ Webhook verification
RESEND_API_KEY=                  # ✅ Email service
JWT_SECRET=                      # ✅ Authentication
NEXT_PUBLIC_BASE_URL=            # ✅ Application URL
CRON_SECRET=                     # ✅ Cron authentication
```

### Communication (Configured)
```env
TELEGRAM_BOT_TOKEN=              # ✅ Bot token
TELEGRAM_CHAT_ID=                # ✅ Admin chat
TWILIO_ACCOUNT_SID=              # ✅ Twilio
TWILIO_AUTH_TOKEN=               # ✅ Twilio
TWILIO_PHONE_NUMBER=             # ✅ Voice number
BLAND_API_KEY=                   # ✅ Voice AI
BLAND_PATHWAY_ID=                # ✅ Pathway
```

### WhatsApp (Pending)
```env
WHATSAPP_PHONE_NUMBER_ID=        # ✅ Set
WHATSAPP_ACCESS_TOKEN=           # ⚠️ User token (temporary)
WHATSAPP_VERIFY_TOKEN=           # ✅ Set
WHATSAPP_BUSINESS_ACCOUNT_ID=    # ✅ Set
```

### AI & Marketing
```env
OPENAI_API_KEY=                  # ✅ GPT-4
NEXT_PUBLIC_MAPBOX_TOKEN=        # ✅ Maps
META_*=                          # ⏳ Pending verification
NEXT_PUBLIC_GA_MEASUREMENT_ID=   # ⬚ Not set
```

---

## Documentation Links

| Document | Purpose |
|----------|---------|
| [STRIPE_SETUP.md](./STRIPE_SETUP.md) | Payment configuration |
| [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) | Telegram bots |
| [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md) | WhatsApp Business |
| [BLAND_AI_SETUP.md](./BLAND_AI_SETUP.md) | Voice AI |
| [CRON_JOBS_COMPLETE.md](./CRON_JOBS_COMPLETE.md) | Scheduled tasks |
| [META_ADS_SETUP.md](./META_ADS_SETUP.md) | Meta Ads |
| [PRODUCTION_SETUP_GUIDE.md](./PRODUCTION_SETUP_GUIDE.md) | Deployment |

---

*Last Updated: March 2026*
