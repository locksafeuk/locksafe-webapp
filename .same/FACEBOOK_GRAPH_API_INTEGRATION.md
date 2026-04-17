# Facebook Graph API Integration - Organic Posting

## Current Status

The Facebook Graph API integration is **already implemented** in the codebase:

### ✅ What's Already Built

1. **Social Publisher Library** (`src/lib/social-publisher.ts`)
   - `publishToFacebook()` - Publishes to Facebook Page feed
   - `publishToInstagram()` - Publishes to Instagram Business account
   - `publishToBothPlatforms()` - Cross-posts to both platforms
   - `getPostInsights()` - Fetches post metrics
   - `getManagedPages()` - Lists accessible Facebook Pages

2. **API Routes**
   - `/api/admin/organic/[id]/publish` - Publish individual posts
   - `/api/cron/publish-organic` - Automated publishing via cron

3. **Database Schema**
   - `SocialAccount` model stores Facebook/Instagram credentials
   - `SocialPost` model tracks posts and their publish status
   - Fields: `pageId`, `pageAccessToken`, `accessToken`, etc.

4. **Frontend UI**
   - Create post page: `/admin/organic/create`
   - Settings page: `/admin/organic/settings`
   - Autopilot configuration

## ⚠️ What's Missing - Social Account Setup

The system needs a way to **connect and save** Facebook Page credentials. Currently there's no UI to:
1. Authenticate with Facebook OAuth
2. Select a Facebook Page
3. Store the Page ID and Access Token in the database

## Required Environment Variables

Add these to Vercel (already defined in `.env.example`):

```env
# Facebook Page ID (find in Page Settings)
META_PAGE_ID="your-page-id"

# Facebook Page Access Token (never expires)
# Generate from: Graph API Explorer with these permissions:
# - pages_manage_posts
# - pages_read_engagement
# - instagram_basic
# - instagram_content_publish
META_ACCESS_TOKEN="your-long-lived-page-access-token"
```

## How to Get Facebook Credentials

### Method 1: Graph API Explorer (Quick Setup)
1. Go to https://developers.facebook.com/tools/explorer/
2. Select your Facebook App
3. Click "Generate Access Token"
4. Request permissions: `pages_manage_posts`, `pages_read_engagement`
5. Get User Access Token
6. Use it to get Page Access Token:
   ```
   GET /{page-id}?fields=access_token&access_token={user-token}
   ```
7. The Page Access Token can be set to never expire

### Method 2: Manual Database Entry (Temporary)
If you already have the credentials, insert directly into MongoDB:

```javascript
db.socialAccounts.insertOne({
  platform: "FACEBOOK",
  accountId: "YOUR_PAGE_ID",
  accountName: "Your Page Name",
  accessToken: "YOUR_PAGE_ACCESS_TOKEN",
  pageId: "YOUR_PAGE_ID",
  pageAccessToken: "YOUR_PAGE_ACCESS_TOKEN",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

## Testing the Integration

Once credentials are configured:

1. **Create a Post**: Go to `/admin/organic/create`
2. **Generate Content**: Use AI to generate post variations
3. **Select Platform**: Choose Facebook, Instagram, or both
4. **Publish**: Click publish button
5. **Verify**: Check your Facebook Page for the published post

## Post Publishing Flow

```
User Creates Post → Saves to Database (DRAFT)
     ↓
User Clicks Publish
     ↓
API: /api/admin/organic/[id]/publish
     ↓
Fetches SocialAccount credentials from database
     ↓
Calls publishToFacebook() from social-publisher.ts
     ↓
Graph API: POST /{page-id}/feed or /{page-id}/photos
     ↓
Updates post status to PUBLISHED
     ↓
Stores Facebook Post ID in database
```

## Supported Features

✅ Text-only posts
✅ Posts with images
✅ Posts with links
✅ Scheduled posts (future publishing)
✅ Hashtags
✅ Instagram carousel posts
✅ Post insights/analytics
✅ Cross-posting to Facebook + Instagram

## Next Steps

1. ✅ Environment variables are already in Vercel
2. ⚠️ Need to create SocialAccount records in database
3. 🔧 Optional: Build OAuth flow UI for easier setup
