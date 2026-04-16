# Google Ads Conversion Setup for LockSafe UK

## Overview

This guide walks you through setting up Google Ads conversion tracking for LockSafe UK. Proper conversion tracking is **essential** for:
- Measuring ROI from ad spend
- Enabling Smart Bidding (Target CPA, Target ROAS)
- Optimizing campaigns for actual revenue, not just clicks

---

## Step 1: Get Your Google Ads Customer ID

1. Go to [ads.google.com](https://ads.google.com)
2. Sign in with your Google account
3. Your **Customer ID** is in the top-right corner (format: XXX-XXX-XXXX)
4. For the tracking code, convert this to: `AW-XXXXXXXXXX` (remove dashes, add AW- prefix)

**Add to your `.env` file:**
```bash
NEXT_PUBLIC_GOOGLE_ADS_ID="AW-XXXXXXXXXX"
```

---

## Step 2: Create Conversion Actions

### Navigate to Conversions
1. Click **Tools & Settings** (wrench icon) → **Measurement** → **Conversions**
2. Click **+ New conversion action**
3. Select **Website**

---

### Conversion Action 1: Lead (Job Request Submitted)

| Setting | Value |
|---------|-------|
| **Conversion name** | `Lead - Job Request` |
| **Category** | Lead → Submit lead form |
| **Value** | Use different values for each conversion |
| **Default value** | £50.00 |
| **Count** | One (count one conversion per click) |
| **Click-through window** | 30 days |
| **View-through window** | 1 day |
| **Attribution model** | Data-driven (recommended) or Last click |

**After creating:**
1. Click on the conversion action
2. Go to **Tag setup** → **Use Google Tag Manager** or **Install tag yourself**
3. Copy the **Conversion ID** and **Conversion label**

**Add to `.env`:**
```bash
NEXT_PUBLIC_GOOGLE_LEAD_CONVERSION_LABEL="AbCdEfGhIjKlMnOp"
```

---

### Conversion Action 2: Assessment Fee Paid

| Setting | Value |
|---------|-------|
| **Conversion name** | `Assessment Fee Paid` |
| **Category** | Purchase → Begin checkout |
| **Value** | Use different values for each conversion |
| **Default value** | £29.00 |
| **Count** | One |
| **Click-through window** | 30 days |
| **View-through window** | 1 day |
| **Attribution model** | Data-driven |

---

### Conversion Action 3: Purchase (Job Completed)

| Setting | Value |
|---------|-------|
| **Conversion name** | `Purchase - Job Completed` |
| **Category** | Purchase |
| **Value** | Use different values for each conversion |
| **Default value** | £150.00 |
| **Count** | One |
| **Click-through window** | 90 days (locksmith decisions can take time) |
| **View-through window** | 1 day |
| **Attribution model** | Data-driven |

**This is your PRIMARY conversion for optimization.**

**Add to `.env`:**
```bash
NEXT_PUBLIC_GOOGLE_PURCHASE_CONVERSION_LABEL="QrStUvWxYz123456"
```

---

### Conversion Action 4: Phone Call Click (Optional)

| Setting | Value |
|---------|-------|
| **Conversion name** | `Phone Call Click` |
| **Category** | Lead → Phone call lead |
| **Value** | £10.00 (estimated value) |
| **Count** | One |
| **Click-through window** | 7 days |

---

### Conversion Action 5: Locksmith Signup (B2B)

| Setting | Value |
|---------|-------|
| **Conversion name** | `Locksmith Signup` |
| **Category** | Sign-up |
| **Value** | £500.00 (estimated lifetime value) |
| **Count** | One |
| **Click-through window** | 30 days |

---

## Step 3: Verify Installation

### Method 1: Google Tag Assistant
1. Install [Google Tag Assistant](https://tagassistant.google.com/) Chrome extension
2. Visit your website
3. Check that the Google Ads tag is firing

### Method 2: Google Ads Conversion Diagnostics
1. Go to **Tools & Settings** → **Conversions**
2. Click on each conversion action
3. Check the **Status** column:
   - ✅ **Recording conversions** = Working
   - ⏳ **Unverified** = Waiting for first conversion
   - ❌ **No recent conversions** = Check implementation

### Method 3: Real-Time Testing
1. In Google Ads, go to **Tools & Settings** → **Conversions**
2. Click on a conversion action → **Tag setup**
3. Use the **Test** feature to verify events are received

---

## Step 4: Configure Smart Bidding

Once you have 15-30 conversions, enable Smart Bidding:

### For Lead Generation Campaigns
1. Go to campaign settings
2. **Bidding** → **Change bid strategy**
3. Select **Maximize conversions** or **Target CPA**
4. Set Target CPA based on your acceptable cost per lead (e.g., £20-50)

### For Revenue Optimization
1. Select **Target ROAS** (Return on Ad Spend)
2. Set target based on your margins:
   - If average job is £150 and acceptable ad cost is £30, target ROAS = 500%

---

## Step 5: Enhanced Conversions (Recommended)

Enhanced conversions improve attribution accuracy by 5-15%.

### Enable in Google Ads
1. Go to **Tools & Settings** → **Conversions**
2. Click on a conversion action
3. Enable **Enhanced conversions**
4. Choose **Google tag or Google Tag Manager**

### What We Send (Already Implemented)
Our tracking code sends hashed customer data:
- Email (SHA-256 hashed)
- Phone number (SHA-256 hashed)
- Name (SHA-256 hashed)

This allows Google to match conversions even when cookies are blocked.

---

## Conversion Values Reference

| Event | Default Value | Notes |
|-------|---------------|-------|
| Lead (Job Request) | £50 | Estimated based on conversion rate |
| Assessment Paid | £29 | Actual fee |
| Quote Accepted | £0 | Intent signal only |
| Purchase | Dynamic | Actual job value passed |
| Phone Click | £10 | Estimated |
| Locksmith Signup | £500 | Lifetime value estimate |

---

## Campaign Structure Recommendations

### 1. Brand Campaign (Protect Your Brand)
```
Campaign: LockSafe Brand
├── Ad Group: Brand - Exact
│   └── Keywords: [locksafe], [lock safe], [locksafe uk]
├── Ad Group: Brand - Phrase
│   └── Keywords: "locksafe locksmith", "lock safe uk"
```
- **Bid strategy:** Maximize clicks (low budget)
- **Goal:** Defend brand, low CPC

### 2. Emergency Search (Main Acquisition)
```
Campaign: Emergency Locksmith
├── Ad Group: Lockout
│   └── Keywords: locked out house, locked out home, lockout service
├── Ad Group: Emergency
│   └── Keywords: emergency locksmith, 24 hour locksmith, locksmith now
├── Ad Group: Near Me
│   └── Keywords: locksmith near me, local locksmith, locksmith [city]
```
- **Bid strategy:** Target CPA (£30-50)
- **Ad schedule:** 24/7 (emergencies happen anytime)

### 3. Security/Non-Emergency
```
Campaign: Security Services
├── Ad Group: Lock Change
│   └── Keywords: change locks, new locks, lock replacement
├── Ad Group: Security Upgrade
│   └── Keywords: anti snap locks, security locks, smart locks
```
- **Bid strategy:** Target CPA (£20-40)
- **Ad schedule:** Business hours primarily

### 4. Performance Max (AI-Driven)
```
Campaign: PMax - Locksmith UK
├── Asset Groups
│   └── Headlines, descriptions, images, videos
│   └── Audience signals: locksmith searchers, homeowners
```
- **Bid strategy:** Maximize conversion value
- **Let Google AI find the best placements**

---

## Negative Keywords (Add These!)

### General Exclusions
```
- jobs
- careers
- salary
- hiring
- training
- course
- qualification
- apprentice
- diy
- how to
- free
- cheap
```

### Intent Exclusions
```
- lock picking
- pick a lock
- bypass
- hack
```

### Competitor Brand Exclusions (if not bidding on competitors)
```
- [competitor names]
```

---

## Location Targeting

### Recommended Setup
1. Target postcodes/cities where you have locksmiths
2. Set bid adjustments:
   - +20% for areas with 5+ verified locksmiths
   - -50% for areas with no coverage
3. Use location extensions to show nearest locksmith

### Example Bid Adjustments
| Area | Locksmiths | Bid Adjustment |
|------|------------|----------------|
| London | 15+ | +30% |
| Manchester | 8 | +20% |
| Birmingham | 5 | +10% |
| Rural Wales | 1 | -40% |
| No coverage | 0 | Exclude |

---

## Audience Targeting

### In-Market Audiences
- Locksmiths
- Home Security
- Home Services
- Home Improvement

### Custom Audiences
Create based on:
- People who searched for locksmith services
- People who visited competitor websites
- People who visited home security websites

### Remarketing Lists (See RETARGETING_GUIDE.md)
- Website visitors (all)
- Form starters (high intent)
- Quote viewers (very high intent)
- Past customers (for reviews/referrals)

---

## Reporting Setup

### Key Metrics to Track
1. **Cost per Lead** - How much to get a job request
2. **Cost per Acquisition** - How much to get a paying customer
3. **ROAS** - Revenue generated per £1 spent
4. **Conversion Rate** - Click to lead %

### Recommended Reports
1. **Campaign Performance** - Daily/weekly
2. **Search Terms Report** - Weekly (find new negatives)
3. **Audience Performance** - Monthly
4. **Geographic Performance** - Monthly

---

## Troubleshooting

### Conversions Not Recording
1. Check pixel is installed (Tag Assistant)
2. Verify conversion label matches
3. Wait 24-48 hours for data to appear
4. Check for JavaScript errors in console

### Low Conversion Volume
1. Extend attribution window (30 days)
2. Include micro-conversions (form starts)
3. Use enhanced conversions

### High CPA
1. Add negative keywords
2. Narrow location targeting
3. Reduce audience breadth
4. Improve landing page speed/relevance

---

## Final Checklist

- [ ] Google Ads account created
- [ ] Customer ID added to `.env` as `NEXT_PUBLIC_GOOGLE_ADS_ID`
- [ ] Lead conversion action created
- [ ] Lead conversion label added to `.env`
- [ ] Purchase conversion action created
- [ ] Purchase conversion label added to `.env`
- [ ] Enhanced conversions enabled
- [ ] Tag Assistant shows tags firing
- [ ] At least one test conversion recorded
- [ ] Smart Bidding enabled (after 15+ conversions)
- [ ] Negative keywords added
- [ ] Location targeting configured
