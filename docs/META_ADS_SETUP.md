# Meta Ads Integration Setup Guide

This guide explains how to obtain all the required Meta (Facebook) environment variables for the LockSafe UK AI Ad Manager.

## Current Status

| Variable | Status | Purpose |
|----------|--------|---------|
| `META_APP_ID` | ✅ Configured | Your Meta App identifier |
| `META_APP_SECRET` | ✅ Configured | Your Meta App secret key |
| `META_ACCESS_TOKEN` | ❌ Missing | API authentication token |
| `META_AD_ACCOUNT_ID` | ❌ Missing | Your Ad Account ID |
| `META_PAGE_ID` | ❌ Missing | Your Facebook Page ID |
| `NEXT_PUBLIC_META_PIXEL_ID` | ❌ Missing | Meta Pixel for tracking |
| `META_CONVERSIONS_API_TOKEN` | ❌ Missing | Server-side conversion tracking |

---

## Prerequisites

Before starting, ensure you have:
- A Facebook Business Account
- Admin access to a Facebook Page
- A Meta Business Manager account ([business.facebook.com](https://business.facebook.com))
- Your Meta App already created (since you have `META_APP_ID` and `META_APP_SECRET`)

---

## Step 1: Get META_ACCESS_TOKEN

The access token authenticates your API requests to Meta. You'll need a **System User Access Token** for production use.

### Option A: Using Meta Business Suite (Recommended for Production)

1. **Go to Meta Business Suite**
   - Navigate to [business.facebook.com](https://business.facebook.com)
   - Click **Settings** (gear icon) → **Business Settings**

2. **Create a System User**
   - In the left menu, go to **Users** → **System Users**
   - Click **Add** → Enter a name (e.g., "LockSafe API")
   - Set role to **Admin**
   - Click **Create System User**

3. **Assign Assets to the System User**
   - Select your newly created system user
   - Click **Add Assets**
   - Select **Apps** → Check your Meta App → Set permissions to **Full Control**
   - Select **Ad Accounts** → Check your ad account → Set permissions to **Full Control**
   - Select **Pages** → Check your page → Set permissions to **Full Control**
   - Click **Save Changes**

4. **Generate Access Token**
   - Click on the System User you created
   - Click **Generate New Token**

   **Step 1: Select App**
   - Choose your Meta App from the dropdown

   **Step 2: Set Expiration**
   - Select "Never" for a permanent token (recommended for production)
   - Or choose a specific expiration date

   **Step 3: Assign Permissions**
   - In the permissions dropdown, search and select these permissions:

   **Required for Ads Management (scroll down to find these):**
   - ✅ `ads_management` - Create and manage ads
   - ✅ `ads_read` - Read ad performance data

   **Required for Business & Pages:**
   - ✅ `business_management` - Manage business assets
   - ✅ `pages_manage_engagement` - Manage page engagement
   - ✅ `pages_manage_metadata` - Manage page settings
   - ✅ `pages_manage_posts` - Create posts from page
   - ✅ `pages_read_engagement` - Read page engagement data
   - ✅ `pages_read_user_content` - Read user content on page
   - ✅ `pages_show_list` - Show pages list

   > 💡 **Tip**: The permissions list is scrollable! Scroll down to find `ads_management` and `ads_read` which are essential for the Ad Manager.

   **Step 4: Done**
   - Click **Generate Token**
   - **Copy and save this token immediately** - you won't see it again!

5. **Add to your `.env` file:**
   ```
   META_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxx
   ```

> ⚠️ **Important**: If you don't see `ads_management` or `ads_read` in the permissions list, your app may need additional configuration. Go to your App Dashboard → App Settings → Use Cases → and add "Advertising" or "Business" use cases.

### Option B: Using Graph API Explorer (For Testing Only)

1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Select your App from the dropdown
3. Click **Generate Access Token**
4. Select the required permissions
5. Copy the token

> ⚠️ **Warning**: Tokens from Graph API Explorer expire quickly (usually 1-2 hours). Use System User tokens for production.

---

## Step 2: Get META_AD_ACCOUNT_ID

Your Ad Account ID is a unique identifier for your advertising account.

### Method 1: From Ads Manager URL

1. Go to [Meta Ads Manager](https://business.facebook.com/adsmanager)
2. Look at the URL - it will look like:
   ```
   https://business.facebook.com/adsmanager/manage/campaigns?act=123456789012345
   ```
3. The number after `act=` is your Ad Account ID

### Method 2: From Business Settings

1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Settings** (gear icon) → **Business Settings**
3. In the left menu, click **Accounts** → **Ad Accounts**
4. Click on your ad account
5. The **Ad Account ID** is displayed in the details panel

### Method 3: Using API (if you have an access token)

```bash
curl -X GET "https://graph.facebook.com/v25.0/me/adaccounts?access_token=YOUR_ACCESS_TOKEN"
```

The response will include your ad account IDs:
```json
{
  "data": [
    {
      "account_id": "123456789012345",
      "id": "act_123456789012345"
    }
  ]
}
```

**Add to your `.env` file:**
```
META_AD_ACCOUNT_ID=act_123456789012345
```

> **Note**: Include the `act_` prefix in the value.

---

## Step 3: Get META_PAGE_ID

Your Facebook Page ID is required for creating ads that appear to come from your business page.

### Method 1: From Your Page's About Section

1. Go to your Facebook Page
2. Click **About** in the left menu
3. Scroll down to **Page Transparency**
4. Click **See all**
5. Find **Page ID** in the information displayed

### Method 2: From Page URL

1. Go to your Facebook Page
2. If your page URL is `facebook.com/YourPageName`, use this API call:
   ```bash
   curl "https://graph.facebook.com/v18.0/YourPageName?fields=id&access_token=YOUR_ACCESS_TOKEN"
   ```

### Method 3: From Business Settings

1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Settings** → **Business Settings**
3. In the left menu, click **Accounts** → **Pages**
4. Select your page
5. The Page ID is displayed in the details panel

### Method 4: From Page Source (Quick Method)

1. Go to your Facebook Page
2. Right-click → **View Page Source**
3. Search for `"pageID"` or `"page_id"`
4. Copy the number value

**Add to your `.env` file:**
```
META_PAGE_ID=123456789012345
```

---

## Step 4: Get NEXT_PUBLIC_META_PIXEL_ID

The Meta Pixel tracks user actions on your website for conversion tracking and ad optimization.

### If You Already Have a Pixel

1. Go to [Events Manager](https://business.facebook.com/events_manager)
2. Select your Pixel from the left sidebar
3. Click **Settings**
4. Your **Pixel ID** is displayed at the top

### If You Need to Create a New Pixel

1. Go to [Events Manager](https://business.facebook.com/events_manager)
2. Click **Connect Data Sources** (green button)
3. Select **Web**
4. Click **Connect**
5. Select **Meta Pixel**
6. Enter a name for your pixel (e.g., "LockSafe UK Website")
7. Enter your website URL
8. Click **Continue**
9. Copy your **Pixel ID**

**Add to your `.env` file:**
```
NEXT_PUBLIC_META_PIXEL_ID=123456789012345
```

> **Note**: This variable starts with `NEXT_PUBLIC_` because it's used client-side for the pixel tracking script.

---

## Step 5: Get META_CONVERSIONS_API_TOKEN

The Conversions API token enables server-side event tracking, which is more reliable than pixel-only tracking.

### Generate a Conversions API Access Token

1. Go to [Events Manager](https://business.facebook.com/events_manager)
2. Select your Pixel from the left sidebar
3. Click **Settings**
4. Scroll down to **Conversions API**
5. Under **Set up Manually**, click **Generate access token**
6. Copy the generated token

### Alternative: Use System User Token

You can also use your System User Access Token (from Step 1) for the Conversions API. This is recommended if you want a single token for all API access.

**Add to your `.env` file:**
```
META_CONVERSIONS_API_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Complete .env Configuration

After completing all steps, your `.env` file should include:

```env
# Meta App (Already Configured)
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret

# Meta Ads API
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxx
META_AD_ACCOUNT_ID=act_123456789012345
META_PAGE_ID=123456789012345

# Meta Pixel & Conversions API
NEXT_PUBLIC_META_PIXEL_ID=123456789012345
META_CONVERSIONS_API_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Verify Your Configuration

After adding all variables, restart your development server and:

1. Go to `/admin/ads` in your LockSafe admin panel
2. Check the "Environment Variables Status" section at the bottom
3. All Meta variables should show ✅ green checkmarks

You can also run the health check:
```bash
curl http://localhost:3000/api/admin/env-status
```

---

## Permissions Reference

### Required App Permissions

Your Meta App needs these permissions approved:

| Permission | Purpose |
|------------|---------|
| `ads_management` | Create and manage ads |
| `ads_read` | Read ad performance data |
| `business_management` | Access Business Manager assets |
| `pages_read_engagement` | Read page engagement data |
| `pages_manage_ads` | Create ads from your page |

### Required System User Assets

Your System User needs access to:

- ✅ Your Meta App (Full Control)
- ✅ Your Ad Account (Full Control)
- ✅ Your Facebook Page (Full Control)
- ✅ Your Pixel (via Events Manager)

---

## Troubleshooting

### "Invalid OAuth access token"
- Your access token may have expired
- Generate a new System User token (they don't expire)
- Ensure the token has the required permissions

### "Ad Account not found"
- Verify the `act_` prefix is included
- Ensure your System User has access to the ad account
- Check that the ad account is active (not disabled)

### "Page not found"
- Verify the Page ID is correct
- Ensure your System User has access to the page
- Check that the page is published (not unpublished)

### "Invalid Pixel ID"
- Verify the Pixel ID in Events Manager
- Ensure the pixel is active
- Check that the pixel is connected to your ad account

### Ads in "PENDING_REVIEW" for too long
- New ad accounts may have longer review times
- Ensure your ad content follows [Meta Advertising Policies](https://www.facebook.com/policies/ads/)
- Check Ads Manager for any policy warnings

---

## Token Security Best Practices

1. **Never commit tokens to Git** - Always use environment variables
2. **Use System User tokens** - They don't expire and are more secure
3. **Rotate tokens periodically** - Generate new tokens every 90 days
4. **Limit permissions** - Only grant permissions your app actually needs
5. **Monitor usage** - Check Business Manager for unusual API activity

---

## Useful Links

- [Meta Business Suite](https://business.facebook.com)
- [Meta Ads Manager](https://business.facebook.com/adsmanager)
- [Events Manager (Pixel)](https://business.facebook.com/events_manager)
- [Meta for Developers](https://developers.facebook.com)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer)
- [Meta Marketing API Docs](https://developers.facebook.com/docs/marketing-apis)
- [Meta Advertising Policies](https://www.facebook.com/policies/ads/)

---

## Need Help?

If you encounter issues:

1. Check the [Meta Developer Support](https://developers.facebook.com/support/)
2. Review the [Marketing API Documentation](https://developers.facebook.com/docs/marketing-api/get-started)
3. Contact LockSafe UK support at support@same.new

---

*Last updated: February 2026*
