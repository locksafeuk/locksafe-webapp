# AI-Powered Ad Creation System with Meta Pixel Integration

## Overview
Build an AI-powered ad creation system in the admin panel that:
1. Creates Facebook/Instagram ads with one click
2. Auto-configures all tracking (Meta Pixel, UTM, Conversions API)
3. Uses OpenAI for copy generation, audience suggestions, and optimization
4. Publishes directly to Meta Ads Manager via Marketing API

---

## Phase 1: Database Schema & Configuration ✅ COMPLETED

### 1.1 Database Models
- [x] `MetaAdAccount` - Store Meta Business credentials
- [x] `AdCampaign` - Campaigns created from admin panel
- [x] `AdSet` - Ad sets with targeting
- [x] `Ad` - Individual ads with creative
- [x] `AdCreative` - Images, copy, headlines
- [x] `AdAudience` - Saved audiences
- [x] `AdPerformanceSnapshot` - Performance metrics snapshots
- [x] `AIGeneration` - Track AI-generated content
- [x] `UTMTemplate` - UTM link templates

### 1.2 Environment Variables
- [ ] `META_APP_ID` - Facebook App ID
- [ ] `META_APP_SECRET` - Facebook App Secret
- [ ] `META_ACCESS_TOKEN` - System User Token
- [ ] `META_AD_ACCOUNT_ID` - Ad Account ID
- [ ] `META_BUSINESS_ID` - Business Manager ID
- [ ] `OPENAI_API_KEY` - For AI features

---

## Phase 2: Meta Marketing API Integration ✅ COMPLETED

### 2.1 Core API Functions (`/lib/meta-marketing.ts`)
- [x] `MetaMarketingClient` class with full API implementation
- [x] `createCampaign()` - Create campaign with objective
- [x] `createAdSet()` - Create ad set with targeting & budget
- [x] `createAdCreative()` - Upload creative (images, copy)
- [x] `createAd()` - Create ad linking creative to ad set
- [x] `getAdAccounts()` - List available ad accounts
- [x] `getAudiences()` - Get saved/custom audiences
- [x] `getCampaigns()` - Fetch existing campaigns
- [x] `getAdPerformance()` - Fetch ad metrics (insights)
- [x] `updateCampaign/AdSet/Ad()` - Pause/resume controls
- [x] `searchInterests()` - Search targeting interests

### 2.2 Pixel & Tracking Integration
- [x] Auto-add Pixel ID to all ad URLs
- [x] Auto-generate UTM parameters based on campaign/ad
- [x] Configure tracking_specs for pixel events
- [x] Map goals to Pixel events (PIXEL_EVENT_MAP)

---

## Phase 3: OpenAI Integration ✅ COMPLETED

### 3.1 AI Service (`/lib/openai-ads.ts`)
- [x] `generateAdCopy()` - Generate multiple ad copy variations (4 emotional angles)
- [x] `suggestAudiences()` - Suggest targeting based on product
- [x] `analyzePerformance()` - Analyze data and give recommendations
- [x] `refreshCreative()` - Generate new copy based on winners
- [x] `getOptimizationSuggestions()` - Get optimization suggestions
- [x] `chatWithAdAssistant()` - Full chat interface for ad questions
- [x] `generateHeadlines()` - Generate headlines by style

---

## Phase 4: Enhanced Pixel Integration ✅ COMPLETED

### 4.1 Pixel Events Helper (`/lib/pixel-events.ts`)
- [x] `generateEventId()` - For deduplication
- [x] `getFbc()` / `getFbp()` - Cookie handling
- [x] `trackServerEvent()` - Send to Conversions API
- [x] `trackLead()`, `trackPurchase()`, `trackInitiateCheckout()`, `trackRegistration()`
- [x] `trackCustomEvent()` - Custom events
- [x] UTM parameter helpers
- [x] `generateAdTrackingUrl()` - Auto tracking URLs for ads

---

## Phase 5: API Routes ✅ COMPLETED

### 5.1 Created Routes
- [x] `/api/admin/ads` - GET (list), POST (create campaign)
- [x] `/api/admin/ai/chat` - POST (AI assistant chat)
- [x] `/api/admin/ai/generate-copy` - POST (generate copy, refresh, headlines)
- [x] `/api/admin/utm` - GET (templates), POST (generate/save/use/delete)

---

## Phase 6: Admin Panel UI ✅ COMPLETED

### 6.1 Created Pages
- [x] `/admin/ads` - Main dashboard with campaign list, stats, setup guide
- [x] `/admin/ads/create` - 6-step AI-powered ad creator
  - Step 1: Goal selection (Leads, Sales, Traffic, Awareness)
  - Step 2: AI copy generation with 4 variations
  - Step 3: Creative upload & destination URL
  - Step 4: Audience builder (AI suggestions + manual)
  - Step 5: Budget & schedule
  - Step 6: Review with auto-tracking preview
- [x] `/admin/ads/assistant` - AI chat interface with quick prompts
- [x] `/admin/ads/utm-builder` - UTM link builder with templates

### 6.2 Admin Sidebar Updated
- [x] Added "AI Ad Manager" to navigation

---

## What User Needs to Set Up

### Meta Business Manager
1. Create Meta Business account at business.facebook.com
2. Create Facebook App at developers.facebook.com
3. Request Marketing API access
4. Generate System User token with permissions:
   - ads_management
   - ads_read
   - business_management
   - pages_read_engagement
5. Get your Pixel ID from Events Manager

### Environment Variables to Add
```env
# Meta Marketing API
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_ACCESS_TOKEN=your_system_user_token
META_AD_ACCOUNT_ID=act_123456789
META_PAGE_ID=your_page_id
META_BUSINESS_ID=your_business_id

# Already exists - ensure it's set
NEXT_PUBLIC_META_PIXEL_ID=your_pixel_id
META_CONVERSIONS_API_TOKEN=your_capi_token

# OpenAI (for AI features)
OPENAI_API_KEY=sk-your-api-key
```

---

## How It All Works Together

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI AD CREATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User describes product/service                              │
│     ↓                                                           │
│  2. OpenAI generates 4 copy variations (emotional angles)       │
│     ↓                                                           │
│  3. OpenAI suggests target audiences                            │
│     ↓                                                           │
│  4. System auto-configures:                                     │
│     • UTM parameters (source, medium, campaign, content)        │
│     • Pixel event type based on goal                            │
│     • Conversions API setup                                     │
│     • Event deduplication (event_id)                            │
│     ↓                                                           │
│  5. User reviews and clicks "Publish to Meta"                   │
│     ↓                                                           │
│  6. Meta Marketing API creates:                                 │
│     • Campaign (with objective)                                 │
│     • Ad Set (with targeting, budget, pixel optimization)       │
│     • Ad Creative (with image, copy, UTM tags)                  │
│     • Ad (linking everything together)                          │
│     ↓                                                           │
│  7. Ad appears in Facebook Ads Manager for review               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    TRACKING FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User clicks ad                                                 │
│     ↓                                                           │
│  Landing page loads with:                                       │
│     • fbclid in URL (captured & stored as fbc)                  │
│     • UTM parameters (captured & stored)                        │
│     • Pixel fires PageView                                      │
│     ↓                                                           │
│  User submits form (Lead)                                       │
│     ↓                                                           │
│  Browser: fbq('track', 'Lead', {...}, {eventID: 'xyz'})        │
│     +                                                           │
│  Server: POST /api/tracking/conversions (same eventID)          │
│     ↓                                                           │
│  Meta receives BOTH events, deduplicates by eventID             │
│     ↓                                                           │
│  Attribution shows in Ads Manager:                              │
│     "Lead from Campaign X, Ad Y"                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pending / Future Enhancements

- [ ] Performance sync from Meta (scheduled job)
- [ ] A/B test management
- [ ] Automated rules (pause if ROAS < X)
- [ ] Email automation integration (Resend)
- [ ] Creative image generation with AI
- [ ] Campaign duplication
- [ ] Bulk ad creation
- [ ] Performance alerts
