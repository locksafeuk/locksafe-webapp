# Retargeting & Custom Audiences Guide for LockSafe UK

## Why Retargeting Matters for Locksmiths

The locksmith customer journey is often non-linear:

```
Day 1: Searches "locksmith near me" → Visits site → Gets distracted
Day 3: Sees your retargeting ad → Remembers you
Day 5: Gets locked out → Remembers your brand → Books directly
```

**Key Stats:**
- 97% of first-time visitors don't convert
- Retargeting can increase conversions by 70%
- Retargeted visitors are 3x more likely to click
- Cost per click is typically 50% lower than cold traffic

---

## Platform-Specific Audience Setup

## META (Facebook/Instagram) Audiences

### Navigate to Audiences
1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **All Tools** → **Audiences**
3. Click **Create Audience**

---

### Custom Audience 1: All Website Visitors
**Purpose:** General retargeting pool

| Setting | Value |
|---------|-------|
| **Source** | Website |
| **Events** | All website visitors |
| **Retention** | 180 days |
| **Name** | `WV - All Visitors (180d)` |

**Use for:** Brand awareness, general retargeting

---

### Custom Audience 2: Form Starters (High Intent)
**Purpose:** People who started but didn't complete the form

| Setting | Value |
|---------|-------|
| **Source** | Website |
| **Events** | Custom event: `FormStarted` |
| **Exclude** | People who triggered `Lead` event |
| **Retention** | 7 days |
| **Name** | `WV - Form Starters Not Completed (7d)` |

**Use for:** Urgent "complete your request" messaging

**Ad Copy Ideas:**
- "Still locked out? Complete your request in 30 seconds"
- "A locksmith is waiting to help - finish your booking"
- "Don't stay locked out - we're ready when you are"

---

### Custom Audience 3: Quote Viewers (Very High Intent)
**Purpose:** People who received a quote but didn't proceed

| Setting | Value |
|---------|-------|
| **Source** | Website |
| **Events** | Custom event: `QuoteReceived` |
| **Exclude** | People who triggered `Purchase` |
| **Retention** | 14 days |
| **Name** | `WV - Quote Viewers Not Converted (14d)` |

**Use for:** Overcome price objections

**Ad Copy Ideas:**
- "Not sure about the quote? Remember: See price BEFORE work starts"
- "Our price guarantee: No hidden fees, ever"
- "Still comparing? We're the only platform with refund protection"

---

### Custom Audience 4: Past Customers
**Purpose:** Cross-sell, reviews, referrals

| Setting | Value |
|---------|-------|
| **Source** | Website |
| **Events** | `Purchase` |
| **Retention** | 365 days |
| **Name** | `WV - Past Customers (365d)` |

**Use for:**
1. Ask for reviews (1-7 days after service)
2. Security upgrades (30-90 days after)
3. Referral program (ongoing)

**Ad Copy Ideas:**
- "Loved your locksmith? Leave a review and help others"
- "Time for a security upgrade? Past customers get 10% off"
- "Refer a friend, earn £20 credit"

---

### Custom Audience 5: High-Value Customers
**Purpose:** Lookalike seed for quality leads

| Setting | Value |
|---------|-------|
| **Source** | Website |
| **Events** | `Purchase` with value > £150 |
| **Retention** | 365 days |
| **Name** | `WV - High Value Customers (365d)` |

**Use for:** Creating lookalike audiences

---

### Exclusion Audience: Recent Bookers
**Purpose:** Don't waste money on people who already booked

| Setting | Value |
|---------|-------|
| **Source** | Website |
| **Events** | `Lead` or `Purchase` |
| **Retention** | 30 days |
| **Name** | `EXCLUDE - Recent Bookers (30d)` |

**Always exclude this from cold campaigns!**

---

### Lookalike Audiences

Create these from your best customers:

| Lookalike | Source Audience | Size | Use For |
|-----------|-----------------|------|---------|
| LAL - Purchasers 1% | Past Customers | 1% | Cold acquisition |
| LAL - Purchasers 2% | Past Customers | 2% | Scale cold acquisition |
| LAL - High Value 1% | High-Value Customers | 1% | Premium targeting |
| LAL - Emergency Bookers | Fast converters | 1% | Emergency campaigns |

**How to create:**
1. Go to Audiences → Create Audience → Lookalike Audience
2. Select source audience
3. Choose location (United Kingdom)
4. Select audience size (start with 1%)

---

## GOOGLE ADS Audiences

### Navigate to Audience Manager
1. Go to **Tools & Settings** → **Shared Library** → **Audience Manager**
2. Click **+** to create new audience

---

### Remarketing List 1: All Visitors
```
Name: All Website Visitors (540d)
Members: Visitors of my website
Membership duration: 540 days
```

### Remarketing List 2: Request Page Visitors
```
Name: Request Page Visitors (30d)
URL contains: /request
Membership duration: 30 days
```

### Remarketing List 3: Converters
```
Name: Converters - All (540d)
Conversion action: Lead OR Purchase
Membership duration: 540 days
```

### Combined Audiences (Important!)

**High Intent Non-Converters:**
```
Name: High Intent - Not Converted
Include: Request Page Visitors (30d)
Exclude: Converters - All (540d)
```

**Cart Abandoners Equivalent:**
```
Name: Quote Viewers - Not Paid
Include: /customer/job/*/quote visitors
Exclude: Converters - All (540d)
Membership: 14 days
```

---

### Customer Match (Upload Customer Lists)

Upload your customer email list for:
1. Exclusion from cold campaigns
2. Similar audience creation
3. Cross-sell campaigns

**How to:**
1. Export customer emails from your database
2. Go to Audience Manager → Customer lists
3. Upload CSV with emails (Google hashes them)
4. Create Similar Audience from this list

---

## Campaign Strategies

## Strategy 1: The Abandonment Sequence

**Day 1-3: Urgent Reminder**
- Audience: Form Starters (7d)
- Message: "Still need a locksmith? Complete your request now"
- Offer: None needed (urgency is enough)

**Day 4-7: Trust Building**
- Audience: Form Starters (7d)
- Message: "Why customers choose LockSafe: See price BEFORE work"
- Include: Testimonials, trust badges

**Day 8-14: Soft Offer**
- Audience: Request Page Visitors (30d) - excludes converters
- Message: "Planning ahead? Book a security check"
- Offer: "Free security assessment with any service"

---

## Strategy 2: Quote Abandonment

**Day 1-3: Address Objections**
- Audience: Quote Viewers Not Converted
- Message: "Unsure about the price? Here's what's included..."
- Show: Breakdown of value, comparison to competitors

**Day 4-7: Social Proof**
- Audience: Quote Viewers Not Converted
- Message: "Join 1,000+ satisfied customers"
- Show: Reviews, ratings, testimonials

**Day 8-14: Urgency + Guarantee**
- Audience: Quote Viewers Not Converted
- Message: "Quote expires soon - Lock in your price"
- Highlight: Money-back guarantee, no obligation

---

## Strategy 3: Customer Lifecycle

**1-7 Days Post-Service: Review Request**
- Audience: Recent Purchasers (7d)
- Message: "How was your locksmith? Leave a review"
- CTA: Direct link to review page

**30 Days Post-Service: Security Upgrade**
- Audience: Purchasers (30-90d)
- Message: "Time to upgrade your security?"
- Offer: 10% off anti-snap locks

**90+ Days: Referral**
- Audience: Purchasers (90-365d)
- Message: "Know someone who needs a locksmith?"
- Offer: £20 credit for referrals

---

## Strategy 4: Seasonal Campaigns

**Winter (Nov-Feb): "Don't Get Locked Out in the Cold"**
- Audience: All Visitors + Lookalikes
- Message: Weather-specific urgency
- Highlight: Fast response times

**Moving Season (Jun-Sep): "New Home? New Locks"**
- Audience: Homeowner interests
- Message: Security for new homeowners
- Offer: New home security packages

**Holiday Season: "Protect Your Home While Away"**
- Audience: Past customers + lookalikes
- Message: Pre-holiday security checks
- Offer: Free security audit

---

## Ad Creative Best Practices

### For Retargeting Ads

**DO:**
- Use the LockSafe branding (they've seen it before)
- Reference their previous action ("Still looking for...")
- Address likely objections (price, trust, time)
- Use testimonials and reviews
- Show the refund guarantee prominently

**DON'T:**
- Use generic "hire a locksmith" messaging
- Ignore that they've visited before
- Be too aggressive (1-2 touchpoints max per day)
- Show ads indefinitely (cap at 14-30 days)

### Format Recommendations

| Platform | Best Formats | Size |
|----------|--------------|------|
| Meta Feed | Single image, Carousel | 1080x1080, 1080x1350 |
| Meta Stories | Vertical video | 1080x1920 |
| Google Display | Responsive | Multiple sizes |
| Google Search | Text + Extensions | N/A |

---

## Frequency Caps

Prevent ad fatigue with these limits:

| Audience Type | Daily Cap | Weekly Cap |
|---------------|-----------|------------|
| Hot (form abandoners) | 3 impressions | 15 impressions |
| Warm (page visitors) | 2 impressions | 10 impressions |
| Cold (lookalikes) | 2 impressions | 7 impressions |
| Past customers | 1 impression | 5 impressions |

---

## Budget Allocation

### Recommended Split

| Audience Type | % of Retargeting Budget | CPA Target |
|---------------|-------------------------|------------|
| Form Abandoners | 30% | £10-15 |
| Quote Viewers | 25% | £15-25 |
| General Visitors | 25% | £20-30 |
| Past Customers | 10% | £5-10 |
| Lookalikes | 10% | £30-50 |

### Example Monthly Budget: £2,000

| Campaign | Budget | Expected Conversions |
|----------|--------|---------------------|
| Form Abandoners | £600 | 40-60 leads |
| Quote Viewers | £500 | 20-33 leads |
| General Retargeting | £500 | 17-25 leads |
| Customer Win-back | £200 | 20-40 reviews/referrals |
| Lookalikes | £200 | 4-7 leads |

---

## Tracking & Measurement

### Key Metrics

| Metric | Target | Warning |
|--------|--------|---------|
| Frequency | < 5/week | > 10 = fatigue |
| CTR (retargeting) | > 1% | < 0.5% = creative refresh |
| Conversion Rate | > 5% | < 2% = audience issue |
| ROAS | > 400% | < 200% = pause |

### Reports to Run Weekly

1. **Audience Performance** - Which audiences convert best?
2. **Frequency Report** - Anyone seeing too many ads?
3. **Creative Performance** - Which ads work best?
4. **Overlap Report** - Are audiences competing?

---

## UTM Parameters

Always use UTM parameters for attribution:

```
?utm_source=facebook
&utm_medium=retargeting
&utm_campaign=form_abandoners
&utm_content=urgency_v1
```

### Standard Values

| Parameter | Cold Traffic | Retargeting |
|-----------|--------------|-------------|
| utm_source | facebook, google | facebook, google |
| utm_medium | cpc, paid | retargeting, remarketing |
| utm_campaign | {campaign_name} | {audience_type} |
| utm_content | {ad_variation} | {ad_variation} |

---

## Implementation Checklist

### Meta Ads
- [ ] Meta Pixel installed and verified
- [ ] Custom audiences created (all 5 types)
- [ ] Exclusion audience created
- [ ] Lookalike audiences created (at least 2)
- [ ] Retargeting campaign structure set up
- [ ] Creative assets prepared
- [ ] Frequency caps configured
- [ ] UTM parameters added

### Google Ads
- [ ] Remarketing tag installed
- [ ] Audience lists created
- [ ] Combined audiences configured
- [ ] Customer Match uploaded (if available)
- [ ] Display remarketing campaign created
- [ ] RLSA (search remarketing) configured
- [ ] Frequency caps set
- [ ] Exclusions applied

---

## Quick Reference: Audience Naming Convention

```
[Platform] - [Type] - [Description] - [Window]

Examples:
META - WV - All Visitors - 180d
META - WV - Form Starters - 7d
META - LAL - Purchasers 1% - UK
GADS - RM - Request Page - 30d
GADS - CM - Customer Emails - Active
```

---

## Troubleshooting

### Audience Too Small
- Extend retention window
- Broaden URL conditions
- Wait for more traffic

### Low Conversion Rate
- Check landing page relevance
- Review ad-to-page message match
- Test different offers

### High Frequency, Low Conversions
- Reduce budget
- Tighten frequency caps
- Refresh creative

### Audience Overlap
- Use exclusions
- Prioritize higher-intent audiences
- Consolidate similar audiences
