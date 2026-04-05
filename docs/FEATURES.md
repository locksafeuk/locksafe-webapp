# LockSafe UK - Features Guide

> **Everything LockSafe UK offers to customers, locksmiths, and administrators**

---

## Table of Contents

1. [Customer Features](#customer-features)
2. [Locksmith Features](#locksmith-features)
3. [Admin Features](#admin-features)
4. [Communication Channels](#communication-channels)
5. [Anti-Fraud Protection](#anti-fraud-protection)
6. [Marketing & Growth](#marketing--growth)
7. [Automation & AI](#automation--ai)

---

## Customer Features

### Smart Intent Detection

When customers visit locksafe.uk, they're greeted with an intelligent modal that understands their situation:

| Customer Situation | Experience |
|-------------------|------------|
| **Locked out NOW** (Urgent) | Fast-track emergency booking, priority dispatch |
| **Need locksmith soon** | Schedule for today or tomorrow |
| **Comparing prices** | Browse locksmiths, see reviews & prices |
| **Upgrade security** | Browse services, get recommendations |
| **Landlord/Property Manager** | Multi-property support, business accounts |
| **I'm a locksmith** | Redirect to partner signup |

### Booking Flow

1. **Select Problem Type**
   - House/flat lockout
   - Car lockout
   - Broken lock repair
   - Lock change/upgrade
   - Safe opening
   - Burglary damage
   - And more...

2. **Enter Location**
   - Postcode-based search
   - Address autocomplete (Mapbox)
   - GPS location detection

3. **See Available Locksmiths**
   - Verified badge indicators
   - Star ratings & review count
   - Estimated arrival time (ETA)
   - Assessment fee pricing
   - Distance from location

4. **Choose & Pay**
   - Select preferred locksmith
   - Pay assessment fee (Stripe)
   - Receive instant confirmation
   - Get tracking link

### Real-Time Job Tracking

Once booked, customers can:
- See locksmith's live GPS location
- View updated ETA
- Receive SMS/email notifications
- Contact locksmith directly

### Quote Approval Workflow

| Step | What Happens |
|------|--------------|
| Locksmith arrives | Takes "before" photos, assesses problem |
| Quote sent | Itemized breakdown (parts + labor) |
| Customer decides | Accept or decline the quote |
| If accepted | Work begins, payment guaranteed |
| If declined | Keep assessment fee, job closes |

### Digital Signature

At job completion:
- Customer signs digitally on their device
- Confirms work completed
- Acknowledges agreed price
- Timestamp & location recorded

### PDF Job Report

Every completed job generates a legal document containing:
- Complete timeline with timestamps
- All GPS coordinates
- Before/after photos
- Itemized quote
- Digital signature
- Unique report number

### Customer Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Price Transparency** | See full quote before work starts |
| **Arrival Guarantee** | Auto-refund if locksmith is late |
| **Verified Professionals** | All locksmiths ID-verified & insured |
| **Documentation** | PDF report for every job |
| **Satisfaction** | Review system & dispute resolution |

### Customer Dashboard

Logged-in customers can:
- View active jobs
- See job history
- Track locksmith location
- Review & sign quotes
- Download PDF reports
- Leave reviews
- Manage saved cards
- Update profile

---

## Locksmith Features

### Partner Dashboard

Full-featured web dashboard with:

| Section | Features |
|---------|----------|
| **Available Jobs** | Jobs in your coverage area, sorted by proximity |
| **My Jobs** | Active jobs, status tracking, workflow tools |
| **Earnings** | Balance, pending payouts, history |
| **Reviews** | Customer feedback, rating overview |
| **Settings** | Profile, coverage, schedule, documents |

### Job Workflow Tools

1. **Application**
   - Set your assessment fee
   - Set your ETA
   - Add message to customer

2. **En Route**
   - Mark as en route (GPS logged)
   - Customer sees your live location

3. **Arrival**
   - GPS check-in (verified against job address)
   - Take "before" photos

4. **Quote Builder**
   - Select lock type
   - Choose work required
   - Add parts with pricing
   - Add labor
   - Customer receives professional quote

5. **Work Completion**
   - Take "after" photos
   - Mark as complete
   - Customer has 24 hours to sign

6. **Payment**
   - Automatic once signed (or after 24h)
   - Your share transferred to Stripe
   - Available in your bank 1-2 days

### Availability Management

| Feature | Description |
|---------|-------------|
| **Manual Toggle** | Go online/offline instantly |
| **Scheduled Hours** | Set working hours (e.g., Mon-Fri 8am-8pm) |
| **Coverage Radius** | Set travel distance from base |
| **Auto-Schedule** | System toggles based on your schedule |

### Earnings & Payouts

| Feature | Description |
|---------|-------------|
| **Real-Time Balance** | See available vs pending |
| **Daily Payouts** | Automatic transfer to bank |
| **Transaction History** | Full breakdown of every job |
| **Stripe Dashboard** | Deep dive into finances |

### Tiered Commission Structure

| Payment Type | You Keep | Platform Takes |
|--------------|----------|----------------|
| **Assessment Fee** | 85% | 15% |
| **Work Quote** | 75% | 25% |

**Example**: £200 total job = ~£155 in your pocket

### Telegram Bot for Locksmiths

Receive notifications and manage jobs via Telegram:
- New job alerts
- Application accepted notifications
- Quote approval alerts
- Payment confirmations
- Quick commands to check status

### Document Management

- Upload insurance certificate
- Insurance expiry tracking
- Automatic renewal reminders
- Stripe Connect verification

---

## Admin Features

### Web Dashboard

Full admin panel at `/admin`:

| Section | Features |
|---------|----------|
| **Overview** | Stats, charts, recent activity |
| **Jobs** | All jobs, filters, status management |
| **Locksmiths** | Verification, insurance tracking |
| **Customers** | Customer list, job history |
| **Payments** | Transactions, refunds |
| **Payouts** | Pending & processed payouts |
| **Analytics** | Metrics, attribution |
| **Ads** | Meta/Google campaign management |
| **Organic** | Social content scheduling |
| **Emails** | Campaign creation, tracking |

### Telegram Admin Bot

Manage operations via chat with @Locksafeukbot:

| Command | Description |
|---------|-------------|
| `/stats` | Today's jobs, revenue, metrics |
| `/jobs` | List today's jobs |
| `/pending` | Jobs awaiting locksmith |
| `/locksmiths` | Available locksmiths |
| `/alerts` | Urgent issues to address |
| `/dispatch <job>` | Find best locksmith match |
| `/assign <job> <ls>` | Assign job to locksmith |
| `/availability <id> <on/off>` | Toggle availability |

### Real-Time Notifications

Every important event triggers a Telegram notification:
- New customer registered
- New locksmith applied
- Job created
- Application received
- Payment completed
- Refund requested
- And more...

### Locksmith Verification Flow

| Step | Admin Action |
|------|--------------|
| Application received | Review profile & documents |
| ID verification | Via Stripe Connect |
| Insurance check | Verify document & expiry |
| Approval | Activate account |

### Refund Management

| Refund Type | Policy |
|-------------|--------|
| No-show | Full refund, locksmith penalized |
| Customer cancel (early) | Full refund |
| Customer cancel (late) | Partial or no refund |
| Quote declined | Assessment fee kept by locksmith |
| Dispute | Admin review with evidence |

---

## Communication Channels

### Web (locksafe.uk)

The primary customer interface:
- Full booking flow
- Customer dashboard
- Job tracking
- Quote approval
- Digital signatures
- Review submission

### Phone (AI Voice Agent)

24/7 emergency phone line powered by Bland.ai:

| Feature | Description |
|---------|-------------|
| **Instant Answer** | No hold times, AI answers immediately |
| **Safety Check** | Asks if customer is in danger |
| **Data Collection** | Name, phone, email, postcode, problem |
| **Account Creation** | Auto-creates customer account |
| **Job Registration** | Registers emergency request |
| **Follow-up** | Sends SMS/email with booking link |

The AI voice agent:
- Sounds natural and professional
- Handles UK accents
- Understands locksmith terminology
- Routes complex cases to human support

### WhatsApp Business (Coming Soon)

Customer support and updates via WhatsApp:

| Feature | Description |
|---------|-------------|
| **Job Status Updates** | Automated status notifications |
| **Locksmith En Route** | ETA and locksmith details |
| **Quote Notifications** | Prompt to review quotes |
| **Signature Reminders** | Remind to confirm completion |
| **Customer Support** | Chat with support team |

**Message Templates** (pending approval):
- `job_status_update`
- `locksmith_en_route`
- `quote_ready`
- `signature_reminder`
- `job_completed`

### SMS Notifications (Twilio)

Critical alerts via SMS:
- Job confirmation
- Locksmith en route
- Arrival notification
- Quote received
- Signature reminder
- Payment confirmation

### Email Notifications (Resend)

Transactional emails for all events:
- Registration confirmation
- Job confirmations
- Quote notifications
- PDF report delivery
- Review requests

### Telegram Bots

| Bot | Audience | Purpose |
|-----|----------|---------|
| @Locksafeukbot | Admins | Operations management |
| (Locksmith bot) | Locksmiths | Job notifications |

---

## Anti-Fraud Protection

### GPS Tracking

Every job captures GPS at multiple points:

| Event | Location Captured |
|-------|-------------------|
| Job requested | Customer location |
| Locksmith accepts | Locksmith location |
| En route | Locksmith location |
| Arrival | Verified against job address |
| Quote sent | Locksmith location |
| Work started | Locksmith location |
| Work completed | Locksmith location |
| Signature | Customer location |

### Photo Evidence

| Photo Type | When Required |
|------------|---------------|
| **Before** | After arrival, before work starts |
| **During** | Optional for complex jobs |
| **After** | After work completed |
| **Lock Serial** | Optional for records |
| **Damage** | If pre-existing damage found |

All photos are:
- GPS-tagged (lat/lng embedded)
- Timestamped
- Uploaded to secure storage
- Included in PDF report

### Digital Signatures

Customer signature includes:
- Date and time
- IP address
- Device information
- Explicit confirmations:
  - ✓ Work completed satisfactorily
  - ✓ Price agreed and understood
  - ✓ Happy with service

### PDF Reports

Auto-generated legal document containing:
- Complete job timeline
- All GPS coordinates
- All photos
- Quote breakdown
- Digital signature
- Report number (e.g., LRS-2026-001234)

**Admissible as evidence in disputes or legal proceedings.**

---

## Marketing & Growth

### AI-Powered Ad Management

Create and manage Meta (Facebook/Instagram) ads:

| Feature | Description |
|---------|-------------|
| **AI Copy Generation** | GPT-4 writes ad copy |
| **Audience Builder** | Create targeting audiences |
| **Campaign Management** | Create, edit, pause campaigns |
| **Performance Sync** | Auto-import Meta metrics |
| **Attribution** | Track conversions |

### Organic Social Content

Automated content creation and publishing:

| Feature | Description |
|---------|-------------|
| **Content Pillars** | Security tips, anti-fraud education, success stories |
| **AI Generation** | Auto-generate posts from topics |
| **Scheduling** | Calendar-based publishing |
| **Autopilot Mode** | Fully automated content pipeline |
| **Multi-Platform** | Facebook + Instagram |

### Email Campaigns

| Campaign Type | Purpose |
|---------------|---------|
| **Announcements** | Platform updates |
| **Newsletters** | Tips, stats, industry news |
| **Onboarding** | New locksmith sequences |
| **Re-engagement** | Win back inactive partners |

### SEO & Content Marketing

| Feature | Description |
|---------|-------------|
| **Blog** | SEO-optimized articles |
| **Location Pages** | City-specific landing pages |
| **FAQ Schema** | Structured data for search |
| **Auto-Sitemap** | Dynamic sitemap generation |

### Analytics & Attribution

| Feature | Description |
|---------|-------------|
| **UTM Tracking** | Campaign source tracking |
| **Multi-Touch Attribution** | Full customer journey |
| **Conversion Tracking** | Lead → Customer tracking |
| **ROI Reporting** | Ad spend vs revenue |

### Pixel Tracking

| Platform | Purpose |
|----------|---------|
| **Meta Pixel** | Facebook/Instagram conversions |
| **Google Ads** | Google search conversions |
| **Microsoft UET** | Bing ads conversions |
| **Google Analytics** | Website behavior |

---

## Automation & AI

### AI Voice Agent (Bland.ai)

24/7 phone handling:
- Natural conversation
- Safety check protocols
- Customer account creation
- Job registration
- SMS/email follow-up

### Intelligent Dispatch

AI-powered locksmith matching:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Distance** | 35% | Closer = higher score |
| **Rating** | 25% | Higher rated preferred |
| **Availability** | 15% | Online = higher score |
| **Response Time** | 15% | Fast responders preferred |
| **Workload** | 10% | Fewer active jobs = higher |

Auto-dispatch when match score ≥ 70%.

### NLP Understanding

Natural language query processing:
- Admin can ask questions in plain English
- System interprets intent
- Returns relevant data

### Cron Jobs

Automated scheduled tasks:

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Signature Reminders | Every 15 min | Send reminders, auto-complete |
| Availability Schedule | Every 5 min | Toggle locksmith online/offline |
| Insurance Reminders | Daily 9am | Expiry warnings |
| Payout Generation | Daily 2am | Calculate earnings |
| Publish Organic | Hourly | Post scheduled content |
| Generate Organic | Daily 6am | AI create new content |
| Sync Meta Performance | Every 6 hours | Update ad metrics |

### AI Ad Copy Generation

Using GPT-4 and copywriting frameworks:
- AIDA (Attention, Interest, Desire, Action)
- PAS (Problem, Agitate, Solution)
- BAB (Before, After, Bridge)
- 4Ps (Promise, Picture, Proof, Push)
- QUEST (Qualify, Understand, Educate, Stimulate, Transition)

---

## Compliance & Legal

### Customer Protections

| Protection | Description |
|------------|-------------|
| **Cooling Off** | Right to cancel within 14 days (per Consumer Rights Act) |
| **Price Transparency** | Full quote before work |
| **Data Protection** | GDPR compliant |
| **Accessibility** | WCAG compliance |

### Locksmith Requirements

| Requirement | Description |
|-------------|-------------|
| **ID Verification** | Via Stripe |
| **Insurance** | Public liability required |
| **Background Check** | DBS checks |
| **Terms Acceptance** | Platform T&Cs |

### Documentation

All jobs produce legally-admissible documentation:
- GPS coordinates at every stage
- Timestamped photos
- Digital signatures
- PDF reports

---

## Support Resources

### For Customers

| Resource | Location |
|----------|----------|
| Help Center | locksafe.uk/help |
| Refund Policy | locksafe.uk/refund-policy |
| Terms | locksafe.uk/terms |
| Privacy | locksafe.uk/privacy |
| Contact | support@locksafe.uk |

### For Locksmiths

| Resource | Location |
|----------|----------|
| Partner Guide | [LOCKSMITH_GUIDE.md](./LOCKSMITH_GUIDE.md) |
| Dashboard | locksafe.uk/locksmith/dashboard |
| FAQ | locksafe.uk/locksmith/faq |
| Contact | partners@locksafe.uk |

### For Admins

| Resource | Location |
|----------|----------|
| Admin Panel | locksafe.uk/admin |
| Telegram Bot | @Locksafeukbot |
| Docs | This documentation |

---

*LockSafe UK - The complete emergency locksmith platform*

**Version**: 3.0
**Last Updated**: March 2026
