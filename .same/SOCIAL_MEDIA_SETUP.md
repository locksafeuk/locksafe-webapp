# Social Media Publishing Setup Guide

## Overview
To publish organic posts to Facebook and Instagram from the admin dashboard, you need to connect your Facebook Page and Instagram Business account using the Meta Graph API.

## Prerequisites
1. **Facebook Page** - Your business Facebook Page
2. **Instagram Business Account** - Connected to your Facebook Page
3. **Meta App** - A Meta (Facebook) app with the necessary permissions
4. **Access Tokens** - Long-lived tokens for both platforms

## Step-by-Step Setup

### 1. Create a Meta App
1. Go to [Meta for Developers](https://developers.facebook.com/apps)
2. Click "Create App"
3. Select "Business" as the app type
4. Fill in app details and create

### 2. Add Required Permissions
In your Meta App dashboard:
1. Go to **App Settings** > **Basic**
2. Add **Products**:
   - Facebook Login
   - Instagram Graph API
3. Go to **App Review** > **Permissions and Features**
4. Request these permissions:
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`

### 3. Get Access Tokens

#### Facebook Page Access Token:
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Add permissions: `pages_read_engagement`, `pages_manage_posts`
4. Click "Generate Access Token"
5. Get User Token, then exchange for Page Token:
   ```bash
   # Get your pages
   GET /me/accounts?access_token=USER_ACCESS_TOKEN

   # Save the page access_token from response
   ```

#### Instagram Business Account:
1. Link Instagram to your Facebook Page (if not already):
   - Go to Facebook Page Settings > Instagram
   - Connect your Instagram Business account
2. Get Instagram account ID:
   ```bash
   GET /PAGE_ID?fields=instagram_business_account&access_token=PAGE_ACCESS_TOKEN
   ```

### 4. Store Credentials in Database

You need to create records in the `SocialAccount` collection:

#### Facebook Account:
```javascript
{
  platform: "FACEBOOK",
  accountId: "YOUR_PAGE_ID",
  accountName: "Your Page Name",
  accountHandle: "@yourpage",
  accessToken: "PAGE_ACCESS_TOKEN",
  pageId: "YOUR_PAGE_ID",
  pageAccessToken: "PAGE_ACCESS_TOKEN",
  isActive: true
}
```

#### Instagram Account:
```javascript
{
  platform: "INSTAGRAM",
  accountId: "INSTAGRAM_BUSINESS_ACCOUNT_ID",
  accountName: "Your Instagram Name",
  accountHandle: "@yourinsta",
  accessToken: "PAGE_ACCESS_TOKEN", // Same as Facebook Page token
  isActive: true
}
```

### 5. Using MongoDB Compass or CLI

#### Option A: MongoDB Compass
1. Connect to your database
2. Navigate to `SocialAccount` collection
3. Click "Add Data" > "Insert Document"
4. Paste the JSON above (fill in your values)
5. Click "Insert"

#### Option B: MongoDB CLI
```bash
mongosh "YOUR_DATABASE_URL"

use locksafe

db.SocialAccount.insertOne({
  platform: "FACEBOOK",
  accountId: "YOUR_PAGE_ID",
  accountName: "LockSafe UK",
  accountHandle: "@locksafeuk",
  accessToken: "YOUR_PAGE_ACCESS_TOKEN",
  pageId: "YOUR_PAGE_ID",
  pageAccessToken: "YOUR_PAGE_ACCESS_TOKEN",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})

db.SocialAccount.insertOne({
  platform: "INSTAGRAM",
  accountId: "YOUR_INSTAGRAM_BUSINESS_ID",
  accountName: "LockSafe UK",
  accountHandle: "@locksafeuk",
  accessToken: "YOUR_PAGE_ACCESS_TOKEN",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

## Testing

1. Go to **Admin** > **Organic** > **Create Post**
2. Generate content using AI
3. Select platforms (Facebook and/or Instagram)
4. Click "Publish Now"
5. Check your Facebook Page and Instagram account for the published post

## Troubleshooting

### Error: "Facebook account not configured"
- Make sure you have a SocialAccount record with `platform: "FACEBOOK"` and `isActive: true`

### Error: "Instagram account not configured"
- Make sure you have a SocialAccount record with `platform: "INSTAGRAM"` and `isActive: true`

### Error: "Instagram requires an image"
- Instagram posts MUST include an image
- Add an image URL before publishing to Instagram

### Error: "Invalid access token"
- Your access token may have expired
- Regenerate a long-lived token (60 days)
- Update the `accessToken` field in your SocialAccount records

### Error: "Permission denied"
- Make sure your Meta App has the required permissions approved
- Check App Review status in Meta for Developers

## Token Refresh

Access tokens expire after 60 days. To extend:

```bash
GET https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN
```

## Security Notes

⚠️ **Never commit access tokens to Git!**
- Store tokens in the database (encrypted if possible)
- Use environment variables for app credentials
- Rotate tokens regularly
- Monitor token expiration dates

## Support

For help with Meta API setup:
- [Meta for Developers Documentation](https://developers.facebook.com/docs/)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [Page Access Tokens](https://developers.facebook.com/docs/pages/access-tokens)
