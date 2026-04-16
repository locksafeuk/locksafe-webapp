# LockSafe UK - Marketing Funnel & User Tracking System
## Comprehensive Plan Based on Industry Expert Methodologies

---

## 🎯 EXPERT METHODOLOGY INTEGRATION

### 1. Simon Sinek - The Golden Circle (START WITH WHY)

**Our WHY**: *"We believe everyone deserves peace of mind when they're locked out or facing a security emergency. We exist to eliminate the stress, uncertainty, and fear of being scammed from emergency locksmith services."*

**Our HOW**: *"We do this by creating complete transparency - verified locksmiths, GPS tracking, digital documentation, and giving YOU full control to accept or decline quotes."*

**Our WHAT**: *"We connect you with verified, insured locksmiths who provide upfront pricing and digital documentation."*

**Implementation**:
- All messaging starts with emotional safety, not features
- Hero section focuses on relief, trust, and CONTROL - not just "fast service"
- Every modal/popup reinforces our WHY before any CTA
- Key emotional triggers: Fear of scams → Relief of transparency → Trust in verification

---

### 2. Russell Brunson - Value Ladder & Funnel Architecture

```
VALUE LADDER FOR LOCKSAFE UK:

LEVEL 5: VIP Home Security Consultation (£199)
         → Full security audit + priority booking forever
         ↑
LEVEL 4: Priority Membership (£9.99/mo)
         → Priority booking, 10% discount, annual security check
         ↑
LEVEL 3: Job Completion - Full locksmith service (Variable £80-400+)
         → Pay only what you approve in the itemised quote
         ↑
LEVEL 2: Assessment Fee - Locksmith sets their own fee (Typically £25-49)
         → Covers travel + on-site diagnosis
         → You choose from multiple locksmiths with different fees/ETAs
         → Refundable against final work if you proceed
         ↑
LEVEL 1: Free Quote Request - No payment, no commitment
         → Submit your problem, get locksmith offers
         ↑
LEAD MAGNET: Free resources to capture interest
         → "7 Signs Your Locks Need Replacing" PDF
         → "Home Security Checklist" downloadable guide
         → "How to Spot a Cowboy Locksmith" mini-guide
```

**KEY BUSINESS MODEL CLARITY**:
- Locksmiths are independent contractors who set their OWN assessment fees
- Platform does NOT dictate pricing - we facilitate transparency
- Customer CHOOSES which locksmith to book based on: fee, ETA, rating, reviews
- Assessment fee is the locksmith's charge for travel + diagnosis
- Work quote is SEPARATE and presented BEFORE any work begins
- Customer can DECLINE work quote (pays only assessment fee)

**Funnel Types to Implement**:
1. **Squeeze Funnel** - Email capture for lead magnet (security guides)
2. **Reverse Squeeze Funnel** - Offer value THEN ask for email
3. **Survey Funnel** - Qualify leads by urgency/property type (Justin Welsh style)
4. **Application Funnel** - For locksmith recruitment
5. **Webinar Funnel** - "Home Security Masterclass" for B2B/landlords

---

### 3. Justin Welsh - Audience Segmentation & Personalization

**User Segments to Track**:
| Segment | Behavior Pattern | Personalization Strategy |
|---------|-----------------|--------------------------|
| **Emergency Seekers** | Fast scroll, immediate action needed, mobile device, evening/night | Reduce friction, show fastest response, remove all obstacles |
| **Price Shoppers** | Compare prices, check FAQ, hover on pricing, multiple visits | Address value over cost, show guarantees, explain why cheap can be risky |
| **Research Browsers** | Read testimonials, check credentials, scroll slowly | Build trust, show social proof, offer more information |
| **Returning Visitors** | 2+ visits, familiar with site, no conversion yet | Convert with urgency/incentive, special offer |
| **Landlords/Property Managers** | Check commercial services, visit multiple times | Upsell bulk services, membership, dedicated support |
| **Locksmith Prospects** | Check "become a locksmith" pages | Recruitment funnel, income calculator, success stories |
| **Post-Service Customers** | Completed a job | Review request, referral program, membership upsell |

**Segment Detection Rules**:
```javascript
const segmentRules = {
  emergency: {
    conditions: [
      { timeOnSite: '<30s', action: 'cta_click' },
      { device: 'mobile', time: 'evening_or_night' },
      { landingPage: '/request', bounceIntent: false }
    ],
    score: 'high_intent'
  },
  price_shopper: {
    conditions: [
      { faqClicks: '>2' },
      { pricingHover: '>5s' },
      { visitCount: '>1' }
    ],
    score: 'medium_intent'
  },
  // ... etc
};
```

---

### 4. Nicholas Cole - Category Design & Positioning

**Category Creation**: "The Verified Locksmith Marketplace"

**Traditional Category**: "Emergency Locksmith Service"
- Problem: Commoditized, price-driven, trust issues

**Our New Category**: "Anti-Fraud Locksmith Platform"
- Different: We're not a locksmith company, we're a TRUST platform
- Unique positioning: The ONLY platform with verified, insured, GPS-tracked locksmiths
- Fear/Safety angle: "Never get scammed by a cowboy locksmith again"

**Category King Positioning**:
1. **Define the enemy**: Cowboy locksmiths, hidden fees, no accountability
2. **Create the problem**: £50 becomes £300, no documentation, your word vs theirs
3. **Offer the solution**: Complete transparency, digital trail, YOUR control
4. **Own the language**: "Anti-Fraud Protection", "Digital Documentation", "Quote Before Work"

**Messaging Pillars**:
| Pillar | Old Way (Enemy) | LockSafe Way |
|--------|-----------------|--------------|
| Pricing | "Call for quote" (hidden) | Quote shown BEFORE work starts |
| Trust | "We're reliable" (says everyone) | Verified, insured, background-checked |
| Protection | None (your word vs theirs) | GPS, timestamps, photos, PDF report |
| Control | Locksmith controls everything | YOU decide: accept or decline |
| Payment | Cash to locksmith | Secure platform payment |

---

## 🎯 HOMEPAGE COPY STRATEGY (Simon Sinek + Nicholas Cole)

### Hero Section - START WITH WHY

**Current Pain Points to Address**:
1. Fear of being scammed
2. No way to verify prices
3. No documentation if something goes wrong
4. Feeling helpless in emergency

**Headline Options** (A/B Test):
- A: "Emergency Locksmith. 100% Transparent." ✓ (Current - good)
- B: "Never Get Scammed by a Locksmith Again"
- C: "The Locksmith Service That Puts YOU in Control"
- D: "Emergency Help. Total Transparency. Your Peace of Mind."

**Subheadline Focus**:
- Lead with CONTROL and SAFETY
- "Choose your locksmith. See their fee upfront. Approve the quote before ANY work begins. Get complete digital documentation."

**Trust Indicators** (show proof of WHY):
- "All locksmiths verified & insured"
- "Quote before work - always"
- "Full PDF report for every job"
- "You choose, you control"

### Features Section - THE PROBLEM/SOLUTION

**Frame as Problem → Solution**:
1. "Worried about hidden fees?" → 100% Transparent Pricing
2. "Can't verify if they're legit?" → Every locksmith verified
3. "No proof if something goes wrong?" → Complete digital documentation
4. "Feel pressured to accept?" → You're always in control

### How It Works - SHOW THE CONTROL

**Emphasize Decision Points**:
- Step 2: "YOU choose which locksmith based on their fee, ETA, and reviews"
- Step 6: "YOU decide - accept the work quote or just pay the assessment fee"
- Step 8: "YOU confirm satisfaction before signing"

### Social Proof - PROOF OF WHY

**Testimonials should address**:
- Fear overcome ("I was worried about getting scammed...")
- Control experienced ("I could see the quote before...")
- Trust verified ("The PDF report was brilliant for...")

---

## 🔄 USER TRACKING SYSTEM ARCHITECTURE

### Database Schema Additions

```prisma
// User behavior tracking
model UserSession {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  visitorId       String   // Fingerprint/cookie ID
  customerId      String?  @db.ObjectId

  // Session data
  startedAt       DateTime @default(now())
  lastActiveAt    DateTime @default(now())
  deviceType      String   // mobile, tablet, desktop
  browser         String
  referrer        String?
  utmSource       String?
  utmMedium       String?
  utmCampaign     String?
  landingPage     String

  // Tracking
  pageViews       PageView[]
  events          UserEvent[]
  funnelStage     String   @default("visitor") // visitor, lead, prospect, customer, advocate
  segment         String[] // emergency, price_shopper, researcher, etc.

  // Scoring
  engagementScore Int      @default(0)
  intentScore     Int      @default(0)

  // Modal history
  modalsShown     String[]
  modalsDismissed String[]
  modalsConverted String[]
}

model PageView {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionId   String   @db.ObjectId
  session     UserSession @relation(fields: [sessionId], references: [id])

  path        String
  title       String?
  timeOnPage  Int?     // seconds
  scrollDepth Int      @default(0) // percentage

  createdAt   DateTime @default(now())
}

model UserEvent {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionId   String   @db.ObjectId
  session     UserSession @relation(fields: [sessionId], references: [id])

  type        String   // click, form_start, form_abandon, scroll, hover, etc.
  element     String?  // Button ID, form name, etc.
  data        Json?

  createdAt   DateTime @default(now())
}

model FunnelTrigger {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  name        String   @unique
  description String?

  // Trigger conditions
  conditions  Json     // Complex conditions object

  // Action
  modalType   String   // survey, offer, lead_magnet, exit_intent, etc.
  modalConfig Json     // Modal content and styling

  // Targeting
  segments    String[] // Which segments to show
  funnelStages String[] // Which funnel stages

  // Limits
  priority    Int      @default(0)
  showOnce    Boolean  @default(true)
  cooldownHours Int    @default(24)
  maxShows    Int      @default(1)

  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model ModalInteraction {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionId   String
  visitorId   String
  customerId  String?

  modalType   String
  triggerId   String?

  action      String   // shown, dismissed, converted, completed
  data        Json?    // Survey responses, form data, etc.

  createdAt   DateTime @default(now())
}

model LeadMagnet {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  email       String
  name        String?
  phone       String?

  source      String   // Which lead magnet/popup
  segment     String[]

  downloaded  String[] // Which assets they downloaded

  emailsSent  String[] // Which emails they've received
  emailsOpened String[]
  emailsClicked String[]

  convertedToCustomer Boolean @default(false)
  customerId  String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 📊 BEHAVIORAL TRIGGERS & MODAL SYSTEM

### Trigger Matrix

| Trigger ID | Behavior | Segment | Modal Type | Goal |
|------------|----------|---------|------------|------|
| `T001` | Exit intent on homepage | All | Exit Intent Offer | Capture leaving visitors |
| `T002` | 30s on pricing section | Price Shopper | Price Guarantee Modal | Address price concern |
| `T003` | 2+ testimonial views | Researcher | Trust Builder Modal | Show more social proof |
| `T004` | Form abandoned | All | Save Progress Modal | Recover abandoned forms |
| `T005` | 3rd visit, no conversion | Returning | Special Offer Modal | Urgency + incentive |
| `T006` | Scrolled 80%+ homepage | Engaged | Lead Magnet Modal | Capture interested visitor |
| `T007` | Clicked "Emergency" CTA | Emergency | Urgency Support Modal | Fast-track to service |
| `T008` | Visited commercial pages | B2B | Business Inquiry Modal | Segment for B2B outreach |
| `T009` | 60s idle on any page | All | Engagement Re-hook | Bring back attention |
| `T010` | First-time visitor | New | Welcome Survey | Segment and personalize |
| `T011` | Completed job | Customer | Review + Referral Modal | Social proof + growth |
| `T012` | Visited become-locksmith | Locksmith Prospect | Recruitment Modal | Capture locksmith leads |

---

## 🎭 MODAL TYPES & CONTENT

### 1. WELCOME SURVEY MODAL (T010)
**Purpose**: Segment visitors immediately for personalized experience

```
"Let us help you faster!"

What brings you here today?
○ I'm locked out RIGHT NOW 🔴 [→ Skip to emergency flow]
○ I need a locksmith soon (today/tomorrow)
○ I'm comparing prices and options
○ I want to upgrade my home security
○ I'm a landlord/property manager
○ I'm a locksmith interested in joining
```

### 2. EXIT INTENT MODAL (T001)
**Purpose**: Capture leaving visitors with value

**Version A - Lead Magnet**:
```
"WAIT! Before you go..."

📋 Free Download: "7 Warning Signs Your Locks Need Replacing"
Plus: Get 15% off your first service

[Enter Email] [SEND MY FREE GUIDE →]

🔒 No spam. Unsubscribe anytime.
```

**Version B - Urgency** (if showed intent):
```
"Still searching for a reliable locksmith?"

✅ Average response time: 15 minutes
✅ All locksmiths verified & insured
✅ Price match guarantee

[Get Free Quote →] [Chat with us 💬]
```

### 3. PRICE GUARANTEE MODAL (T002)
**Purpose**: Address price objections

```
"Our Transparency Promise"

You're ALWAYS in control of costs:

👀 Locksmiths show their assessment fee UPFRONT (typically £25-49)
🔄 YOU choose which locksmith to book
📋 Full work quote BEFORE any work starts
✅ Accept or decline - no pressure
🛡️ Complete digital receipt for every job

[See How It Works →]
```

### 4. TRUST BUILDER MODAL (T003)
**Purpose**: Reinforce trust for researchers

```
"Why 10,000+ UK homeowners trust us"

[Video testimonial thumbnail - 30sec]

⭐⭐⭐⭐⭐ "They arrived in 12 minutes..."
⭐⭐⭐⭐⭐ "Completely professional and honest..."
⭐⭐⭐⭐⭐ "Saved me from a cowboy locksmith..."

[Read More Reviews →] [Get Your Free Quote →]
```

### 5. FORM ABANDONMENT MODAL (T004)
**Purpose**: Recover abandoned forms

```
"Don't lose your progress!"

Save your details and we'll send you a reminder.
Or, need help completing your request?

[📞 Call us: 0800-XXX-XXXX]
[💬 Chat with support]
[📧 Email me my progress]
```

### 6. SPECIAL OFFER MODAL (T005)
**Purpose**: Convert returning visitors

```
"Welcome back! 🎉"

We noticed you've visited before.
Here's a special offer just for you:

🏷️ 10% OFF your first service
Use code: WELCOME10

Expires in: [COUNTDOWN TIMER]

[CLAIM MY DISCOUNT →]
```

### 7. LEAD MAGNET MODAL (T006)
**Purpose**: Capture engaged visitors

```
"Free Home Security Checklist"

🔐 Check your home's security in 5 minutes
🔑 Tips from professional locksmiths
⚠️ Spot weak points before burglars do

[Your Email] [First Name]
[SEND MY FREE CHECKLIST →]

✓ 2,847 homeowners downloaded this month
```

### 8. BUSINESS INQUIRY MODAL (T008)
**Purpose**: Segment B2B leads

```
"Business & Property Manager Solutions"

Get volume discounts and priority service:

○ I manage 1-5 properties
○ I manage 6-20 properties
○ I manage 20+ properties
○ I run a business with multiple locations

[Contact Our Business Team →]
[Download Business Brochure]
```

### 9. POST-SERVICE MODAL (T011)
**Purpose**: Reviews + Referrals

```
"Thank you for choosing LockSafe UK! 🎉"

How was your experience?
[⭐⭐⭐⭐⭐ rating]

[Write a quick review]

---

Know someone who needs a locksmith?
Give them £10 off, and we'll credit you £10!

[Share Your Referral Link 📤]
```

### 10. LOCKSMITH RECRUITMENT MODAL (T012)
**Purpose**: Capture locksmith leads

```
"Join the UK's Fastest-Growing Locksmith Network"

✅ Set your own schedule
✅ Keep 85% of every job
✅ Get jobs sent directly to your phone
✅ No monthly fees

[Apply in 5 minutes →]
[Download Info Pack]
```

---

## 🔄 USER JOURNEY AUTOMATION

### Email Sequences (After Lead Capture)

**Sequence 1: Lead Magnet Download** (5 emails over 7 days)
1. Day 0: Deliver lead magnet + quick win
2. Day 1: "Did you spot any issues?" + soft CTA
3. Day 3: Success story + testimonial
4. Day 5: Address common objection (price/trust)
5. Day 7: Direct offer with urgency

**Sequence 2: Form Abandonment** (3 emails over 24h)
1. Hour 0: "Your quote request is waiting..."
2. Hour 4: "Need help completing your request?"
3. Hour 24: "Last chance" + special offer

**Sequence 3: Post-Service** (4 emails over 14 days)
1. Day 0: Thank you + review request
2. Day 3: "How's your new lock?" + referral ask
3. Day 7: Maintenance tips + upsell membership
4. Day 14: Referral reminder + discount offer

---

## 📈 SCORING SYSTEM

### Engagement Score (0-100)
| Action | Points |
|--------|--------|
| Page view | +1 |
| Time on page > 30s | +2 |
| Scroll depth > 50% | +3 |
| Testimonial interaction | +5 |
| FAQ interaction | +5 |
| CTA hover | +3 |
| Form start | +10 |
| Chat open | +10 |
| Return visit | +5 |
| Email open | +3 |
| Email click | +5 |

### Intent Score (0-100)
| Action | Points |
|--------|--------|
| Emergency page visit | +20 |
| Form progress > 50% | +15 |
| Phone number reveal | +25 |
| Request quote button | +30 |
| "Near me" search | +15 |
| Pricing page 2+ views | +10 |
| Chat initiated | +25 |
| Mobile + evening hours | +10 |

**Conversion Threshold**: Intent Score > 50 = High Intent Lead

---

## 🖥️ IMPLEMENTATION STRUCTURE

### Frontend Components
```
/src/
├── components/
│   └── marketing/
│       ├── ModalSystem.tsx           # Global modal controller
│       ├── UserTracker.tsx           # Behavior tracking
│       ├── modals/
│       │   ├── WelcomeSurvey.tsx
│       │   ├── ExitIntentOffer.tsx
│       │   ├── PriceGuarantee.tsx
│       │   ├── TrustBuilder.tsx
│       │   ├── FormAbandonment.tsx
│       │   ├── SpecialOffer.tsx
│       │   ├── LeadMagnetCapture.tsx
│       │   ├── BusinessInquiry.tsx
│       │   ├── PostServiceReview.tsx
│       │   └── LocksmithRecruitment.tsx
│       └── hooks/
│           ├── useUserTracking.ts    # Track user behavior
│           ├── useModalTrigger.ts    # Trigger modal logic
│           └── useSegmentation.ts    # User segmentation
├── lib/
│   └── marketing/
│       ├── tracker.ts                # Server-side tracking
│       ├── triggers.ts               # Trigger conditions
│       └── segmentation.ts           # Segmentation logic
└── app/api/
    └── marketing/
        ├── track/route.ts            # Track events
        ├── triggers/route.ts         # Get triggers for user
        ├── modals/route.ts           # Log modal interactions
        └── leads/route.ts            # Save leads
```

### API Endpoints
- `POST /api/marketing/track` - Track page views & events
- `GET /api/marketing/triggers` - Get active triggers for session
- `POST /api/marketing/modals` - Log modal shown/dismissed/converted
- `POST /api/marketing/leads` - Save lead magnet signups
- `GET /api/marketing/session` - Get/create user session

---

## 📋 IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1)
- [ ] Database schema updates
- [ ] UserTracker component
- [ ] Session management
- [ ] Basic event tracking

### Phase 2: Modal System (Week 2)
- [ ] ModalSystem controller
- [ ] First 5 modal components
- [ ] Trigger engine
- [ ] A/B testing framework

### Phase 3: Advanced Triggers (Week 3)
- [ ] Exit intent detection
- [ ] Scroll depth tracking
- [ ] Form abandonment detection
- [ ] Idle detection
- [ ] Return visitor detection

### Phase 4: Analytics & Optimization (Week 4)
- [ ] Admin dashboard for funnel metrics
- [ ] A/B test results viewer
- [ ] Conversion tracking
- [ ] Email sequence integration
- [ ] Segment performance analysis

---

## 🎯 SUCCESS METRICS

| Metric | Current | Target |
|--------|---------|--------|
| Visitor → Lead | ~2% | 8% |
| Lead → Customer | ~5% | 15% |
| Form Abandonment Recovery | N/A | 20% |
| Exit Intent Capture | N/A | 5% |
| Return Visitor Conversion | ~3% | 12% |
| Post-Service Review Rate | ~10% | 40% |
| Referral Rate | ~2% | 10% |

---

## 🚀 READY TO IMPLEMENT?

This plan creates a sophisticated, psychology-driven marketing system that:

1. **Segments users in real-time** based on behavior (Justin Welsh)
2. **Moves users up the value ladder** with appropriate offers (Russell Brunson)
3. **Leads with WHY** in all messaging (Simon Sinek)
4. **Positions LockSafe as the category leader** (Nicholas Cole)

Shall I proceed with implementation?
