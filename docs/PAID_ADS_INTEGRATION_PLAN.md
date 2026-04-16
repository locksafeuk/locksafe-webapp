# LockSafe UK - Paid Ads Integration Plan

## Executive Summary

This document outlines a comprehensive strategy for integrating tracking pixels and conversion APIs for paid advertising campaigns. The goal is to **reduce customer acquisition cost (CAC)** while **maximizing return on ad spend (ROAS)**.

---

## 1. META PIXEL (Facebook/Instagram Ads)

### 1.1 What You Need

| Item | Where to Get It |
|------|-----------------|
| **Meta Pixel ID** | Meta Events Manager → Data Sources → Create Pixel |
| **Conversions API Access Token** | Events Manager → Settings → Generate Access Token |
| **Business Manager ID** | business.facebook.com → Settings |
| **Ad Account ID** | Meta Ads Manager → Account Settings |

### 1.2 Events to Track (Conversion Funnel)

```
PageView → ViewContent → Lead → InitiateCheckout → Purchase
```

| Event | When to Fire | Value | Priority |
|-------|--------------|-------|----------|
| `PageView` | Every page load | - | Standard |
| `ViewContent` | Service pages, locksmith profiles | - | Standard |
| `Lead` | Form started (postcode entered) | £5-10 estimate | **HIGH** |
| `AddToCart` | Quote received by customer | Quote value | **HIGH** |
| `InitiateCheckout` | Assessment fee payment started | £29 | **HIGH** |
| `Purchase` | Job completed & paid | Total job value | **CRITICAL** |
| `CompleteRegistration` | Locksmith signup | £100+ lifetime value | Important |

### 1.3 Advanced Events for Optimization

| Custom Event | When | Why |
|--------------|------|-----|
| `FormAbandoned` | Exit during form | Retarget with urgency |
| `QuoteReceived` | Customer receives quote | Mid-funnel tracking |
| `QuoteAccepted` | Customer accepts quote | High-intent signal |
| `QuoteDeclined` | Customer declines | Price objection retargeting |
| `AssessmentPaid` | £29 paid | Committed lead |
| `LocksmithApplied` | Locksmith applies to job | Supply-side tracking |
| `JobCancelled` | Refund requested | Negative signal |

### 1.4 Conversions API (Server-Side) - **CRITICAL FOR iOS 14.5+**

Due to Apple's ATT (App Tracking Transparency), browser-side pixels miss ~40% of conversions. **Conversions API is mandatory** for accurate attribution.

**Implementation Strategy:**
- **Dual tracking**: Browser pixel + Server-side API
- **Event deduplication**: Use `event_id` parameter
- **Enhanced matching**: Send hashed email, phone, name for better attribution

### 1.5 Meta Pixel Cost Reduction Strategies

#### A. Lookalike Audiences (High Value)
```
1. Seed: Customers who completed jobs over £200
2. Seed: Customers with 5-star reviews
3. Seed: Repeat customers
4. Seed: Emergency lockouts (high urgency = fast conversion)
```

#### B. Custom Audiences for Retargeting
```
1. Visited /request but didn't submit (1-7 days)
2. Started form but abandoned (1-3 days) - URGENT
3. Received quote but didn't accept (1-14 days)
4. Past customers (180 days) - Cross-sell security upgrades
5. Lead magnet signups who haven't converted
```

#### C. Exclusion Audiences (Stop Wasting Money)
```
1. Exclude customers who already booked
2. Exclude cancelled/refunded customers (30 days)
3. Exclude locksmiths from customer campaigns
```

#### D. Value-Based Optimization
```
- Send actual job values with Purchase events
- Meta will optimize for high-value customers
- Focus on £150+ jobs rather than £29 assessments
```

---

## 2. GOOGLE ADS

### 2.1 What You Need

| Item | Where to Get It |
|------|-----------------|
| **Google Ads Conversion ID** | Google Ads → Tools → Conversions |
| **Google Analytics 4 Property** | GA4 Admin → Data Streams |
| **Google Tag Manager** | tagmanager.google.com |

### 2.2 Conversion Actions to Track

| Conversion | Type | Value | Attribution |
|------------|------|-------|-------------|
| `Job Request Submitted` | Primary | £50 dynamic | Data-driven |
| `Assessment Fee Paid` | Primary | £29 static | Data-driven |
| `Job Completed` | Primary | Dynamic (job value) | Data-driven |
| `Phone Call Click` | Secondary | £10 estimate | Last-click |
| `Lead Magnet Download` | Secondary | £2 estimate | Last-click |

### 2.3 Google Ads Strategy for Locksmiths

#### A. Campaign Structure
```
🏠 BRAND CAMPAIGNS (Protect your brand)
   └── "locksafe uk", "lock safe", etc.
   └── Low cost, high conversion rate

🔍 NON-BRAND SEARCH (Main acquisition)
   └── Emergency keywords: "locksmith near me now" (HIGH CPC)
   └── Problem keywords: "locked out of house" (MEDIUM CPC)
   └── Solution keywords: "24 hour locksmith" (MEDIUM CPC)
   └── Trust keywords: "trusted locksmith UK" (LOW CPC, low volume)

🎯 PERFORMANCE MAX (Google's AI)
   └── Feed all your conversion data
   └── Let Google find similar audiences
   └── Works across Search, Display, YouTube, Maps

📱 CALL-ONLY CAMPAIGNS
   └── Mobile users who need immediate help
   └── "Click to call" directly from ad
   └── Track call duration as conversion
```

#### B. Negative Keywords (Cost Reduction)
```
- jobs, careers, hiring, salary (job seekers)
- training, course, certification (students)
- free, cheap, DIY (low intent)
- wholesale, bulk (B2B wrong intent)
- picking, pick (potential lockpickers)
```

#### C. Location Targeting
```
- Target postcodes where you have locksmiths
- Increase bids in areas with verified locksmiths
- Decrease bids in sparse coverage areas
- Use location extensions showing nearest locksmith
```

---

## 3. GOOGLE ANALYTICS 4 (Enhanced E-commerce)

### 3.1 Already Implemented ✅
- Basic pageview tracking
- GA4 measurement ID configuration

### 3.2 To Add

| Event | Parameters |
|-------|------------|
| `begin_checkout` | value, currency, items |
| `purchase` | transaction_id, value, currency, items |
| `view_item` | item_id, item_name (service type) |
| `add_to_cart` | value (quote amount) |
| `generate_lead` | value (estimated job value) |

---

## 4. BING/MICROSOFT ADS

### 4.1 Why Bing?
- **Lower CPC** (30-50% cheaper than Google)
- **Older demographic** (more homeowners)
- **Less competition** for locksmith keywords
- **Import Google Ads campaigns** directly

### 4.2 UET Tag (Universal Event Tracking)
- Similar to Google's gtag
- Track same conversion events
- Import Google Ads campaigns with 1 click

---

## 5. TIKTOK PIXEL (Future Growth)

### 5.1 When to Consider
- When targeting younger renters/first-time buyers
- For locksmith recruitment campaigns
- Brand awareness for "anti-fraud locksmith"

### 5.2 Events to Track
```
PageView, ViewContent, SubmitForm, PlaceAnOrder, CompletePayment
```

---

## 6. IMPLEMENTATION ARCHITECTURE

### 6.1 Recommended Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Client-Side)                    │
├─────────────────────────────────────────────────────────────┤
│  Next.js App                                                 │
│  ├── <MetaPixel /> component (fbq)                          │
│  ├── <GoogleAds /> component (gtag)                         │
│  ├── <MicrosoftAds /> component (uet)                       │
│  └── useTrackingEvents() hook                               │
│                                                              │
│  Event Layer (unified tracking)                              │
│  ├── track('Lead', { value: 50, postcode: 'SW1' })          │
│  ├── track('Purchase', { value: 250, jobId: 'xxx' })        │
│  └── Fires to: Meta + Google + Bing + Internal              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Same events via
                       │ Conversions API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER (Server-Side)                     │
├─────────────────────────────────────────────────────────────┤
│  API Routes                                                  │
│  ├── /api/tracking/pixel     → Meta Conversions API         │
│  ├── /api/tracking/google    → Google Ads API               │
│  └── /api/tracking/events    → All platforms + Internal DB  │
│                                                              │
│  Webhooks (Stripe, etc.)                                     │
│  └── On successful payment → fire Purchase to all platforms │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 GDPR Compliance

```javascript
// Only fire pixels if user consented to marketing cookies
if (cookieConsent.marketing) {
  fbq('track', 'Purchase', { ... });
  gtag('event', 'purchase', { ... });
}

// Always fire server-side if legal basis exists (contract performance)
// Payment completion = contract, not marketing
await sendServerEvent('Purchase', { ... });
```

### 6.3 Event Deduplication

```javascript
const eventId = `${jobId}_${eventName}_${timestamp}`;

// Browser
fbq('track', 'Purchase', data, { eventID: eventId });

// Server
await fetch('https://graph.facebook.com/.../events', {
  body: JSON.stringify({
    data: [{ event_id: eventId, ... }]
  })
});
```

---

## 7. ATTRIBUTION & REPORTING

### 7.1 Multi-Touch Attribution

LockSafe customer journey is often:
```
Day 1: Facebook ad → /request page → Exits
Day 3: Google "locksmith near me" → Calls → No answer
Day 7: Facebook retargeting → Completes booking
```

**Solution:**
- Use **data-driven attribution** in Google Ads
- Configure **7-day click, 1-day view** in Meta
- Track `first_touch_source` and `last_touch_source` in your DB

### 7.2 Custom Dashboards

Build admin dashboard showing:
- Cost per lead by source
- Cost per completed job by source
- ROAS by campaign
- Funnel conversion rates by source
- Lifetime value by acquisition channel

---

## 8. COST REDUCTION STRATEGIES SUMMARY

### Quick Wins
1. **Server-side Conversions API** → 20-30% more attribution accuracy
2. **Value-based bidding** → Focus on high-value jobs, not just leads
3. **Negative keywords** → Stop paying for job seekers, DIY, etc.
4. **Exclusion audiences** → Don't retarget converted customers
5. **Lookalikes from purchasers** → Better than interest targeting

### Medium-Term
1. **Offline conversion import** → Upload final job values to Meta/Google
2. **Lead scoring** → Send quality signals back to ad platforms
3. **Creative testing** → A/B test ad copy highlighting refund guarantee
4. **Landing page optimization** → Reduce bounce, increase conversion

### Long-Term
1. **Incrementality testing** → Measure true lift from ads
2. **Media mix modeling** → Optimize budget across channels
3. **Predictive LTV** → Bid based on predicted lifetime value

---

## 9. ENVIRONMENT VARIABLES NEEDED

```bash
# Meta/Facebook
NEXT_PUBLIC_META_PIXEL_ID=              # From Events Manager
META_CONVERSIONS_API_TOKEN=              # Server-side access token
META_PIXEL_TEST_CODE=                    # For testing (optional)

# Google Ads
NEXT_PUBLIC_GOOGLE_ADS_ID=               # AW-XXXXXXXXX
GOOGLE_ADS_CONVERSION_ID=                # For purchase conversion
GOOGLE_ADS_CONVERSION_LABEL=             # Conversion label

# Google Analytics 4 (already have)
NEXT_PUBLIC_GA_MEASUREMENT_ID=           # G-XXXXXXXXX

# Microsoft/Bing Ads
NEXT_PUBLIC_BING_UET_TAG_ID=             # UET tag ID

# TikTok (future)
NEXT_PUBLIC_TIKTOK_PIXEL_ID=             # TikTok pixel ID
```

---

## 10. IMPLEMENTATION PRIORITY

| Phase | Task | Impact | Effort |
|-------|------|--------|--------|
| **1** | Meta Pixel (browser) | High | Low |
| **1** | Meta Conversions API | **Critical** | Medium |
| **1** | Unified tracking hook | High | Low |
| **2** | Google Ads tracking | High | Low |
| **2** | Custom audiences setup | High | Low |
| **2** | Lookalike audiences | High | Low |
| **3** | Microsoft/Bing Ads | Medium | Low |
| **3** | Admin attribution dashboard | Medium | Medium |
| **4** | Offline conversion uploads | Medium | Medium |
| **4** | TikTok pixel | Low | Low |

---

## 11. NEXT STEPS

1. **Create Meta Business Manager** account if not already done
2. **Set up Meta Pixel** in Events Manager
3. **Generate Conversions API token**
4. **I'll implement:**
   - `MetaPixel` component
   - `GoogleAdsTracking` component
   - `useTrackingEvents` unified hook
   - Server-side `/api/tracking/pixel` route
   - Webhook integration for payment events

**Shall I proceed with the implementation?**
