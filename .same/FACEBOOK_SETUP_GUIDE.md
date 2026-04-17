# Facebook Graph API Setup Guide for Organic Posting

## Quick Setup (Recommended Method)

### Option 1: Using the Admin UI (Easiest)

1. **Go to Settings Page**
   - Navigate to: `/admin/organic/settings`
   - Look for "Connected Accounts" section

2. **Click "Connect Account"**
   - Choose "Facebook" platform
   - Fill in the form with your credentials

3. **Get Your Credentials**:

   **A. Get Page ID:**
   - Go to your Facebook Page
   - Click "About" → Find your Page ID
   - Or use: `https://www.facebook.com/YOUR_PAGE_NAME` and look at the URL

   **B. Get Page Access Token:**
   - Go to: https://developers.facebook.com/tools/explorer/
   - Select your Facebook App (or create one)
   - Click "Generate Access Token"
   - Select permissions:
     - ✅ `pages_manage_posts`
     - ✅ `pages_read_engagement`
     - ✅ `business_management`
   - Copy the User Access Token (short-lived)
   - Exchange for Page Access Token (long-lived):

   ```bash
   # Step 1: Get your User Access Token from Graph Explorer
   USER_TOKEN="your-user-token"

   # Step 2: Get your Page Access Token
   curl "https://graph.facebook.com/v18.0/me/accounts?access_token=$USER_TOKEN"

   # Response will include your pages with their access tokens:
   # {
   #   "data": [
   #     {
   #       "access_token": "EAAxxxxx...",  <- This is your Page Access Token
   #       "id": "123456789",              <- This is your Page ID
   #       "name": "Your Page Name"
   #     }
   #   ]
   # }
   ```

4. **Enter Credentials in UI**
   - Paste Page ID
   - Paste Page Name
   - Paste Page Access Token
   - Click "Connect"

5. **Test the Integration**
   - Go to `/admin/organic/create`
   - Generate a test post
   - Select "Facebook" platform
   - Click "Publish"
   - Check your Facebook Page!

---

## Option 2: Using Environment Variables (For Production)

If you prefer to set credentials via environment variables in Vercel:

### 1. Add to Vercel Environment Variables

```env
# Facebook Page ID
META_PAGE_ID="123456789012345"

# Facebook Page Access Token (long-lived)
META_ACCESS_TOKEN="EAAxxxxxxxxxxxxxxxxx"
```

### 2. Run Database Migration Script

Use this script to automatically create the SocialAccount record from env vars:

```javascript
// scripts/setup-facebook-account.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pageId = process.env.META_PAGE_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    console.error('❌ META_PAGE_ID and META_ACCESS_TOKEN must be set');
    process.exit(1);
  }

  // Get page info from Graph API
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}?fields=name,username&access_token=${accessToken}`
  );
  const pageData = await response.json();

  if (pageData.error) {
    console.error('❌ Error fetching page data:', pageData.error);
    process.exit(1);
  }

  // Upsert the account
  const account = await prisma.socialAccount.upsert({
    where: {
      platform_accountId: {
        platform: 'FACEBOOK',
        accountId: pageId,
      },
    },
    update: {
      accountName: pageData.name,
      accountHandle: pageData.username ? `@${pageData.username}` : null,
      accessToken: accessToken,
      pageId: pageId,
      pageAccessToken: accessToken,
      isActive: true,
      lastSyncAt: new Date(),
    },
    create: {
      platform: 'FACEBOOK',
      accountId: pageId,
      accountName: pageData.name,
      accountHandle: pageData.username ? `@${pageData.username}` : null,
      accessToken: accessToken,
      pageId: pageId,
      pageAccessToken: accessToken,
      isActive: true,
    },
  });

  console.log('✅ Facebook account connected:', account.accountName);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run it:
```bash
node scripts/setup-facebook-account.js
```

---

## Option 3: Manual Database Entry (Quick Testing)

If you just want to test quickly, insert directly into MongoDB:

```javascript
// Connect to MongoDB and run this in the shell
db.socialAccounts.insertOne({
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
```

---

## Testing Your Setup

### Test API Call

```bash
# Test that your token works
PAGE_ID="your-page-id"
ACCESS_TOKEN="your-page-access-token"

curl -X POST \
  "https://graph.facebook.com/v18.0/${PAGE_ID}/feed" \
  -d "message=Test post from API&access_token=${ACCESS_TOKEN}"
```

### Check Post Publishing

1. Create a post in `/admin/organic/create`
2. Use AI to generate content
3. Select Facebook platform
4. Click Publish
5. Check response in browser console
6. Verify post appears on your Facebook Page

---

## Troubleshooting

### Error: "Invalid OAuth access token"
- Token might be expired or wrong
- Regenerate token from Graph API Explorer

### Error: "Permissions error"
- Make sure you selected `pages_manage_posts` permission
- Token needs to be a **Page Access Token**, not User Token

### Error: "Page not found"
- Double-check your Page ID
- Make sure the token has access to this page

### Posts not appearing
- Check post status in database (should be "PUBLISHED")
- Look for `publishError` field in the database
- Check Facebook Page "Activity Log" for posts

### How to get a Never-Expiring Token
1. Generate short-lived User Token (Graph Explorer)
2. Exchange for long-lived User Token:
   ```
   GET /oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={app-id}&
     client_secret={app-secret}&
     fb_exchange_token={short-lived-token}
   ```
3. Use long-lived User Token to get Page Token (lasts forever):
   ```
   GET /me/accounts?access_token={long-lived-user-token}
   ```

---

## Instagram Setup

For Instagram, you need an **Instagram Business Account** connected to a Facebook Page:

1. Connect Instagram Business account to your Facebook Page
2. Get Instagram Account ID from Graph API:
   ```bash
   PAGE_ID="your-page-id"
   ACCESS_TOKEN="your-token"

   curl "https://graph.facebook.com/v18.0/${PAGE_ID}?fields=instagram_business_account&access_token=${ACCESS_TOKEN}"
   ```
3. Add to database via UI or script (similar to Facebook setup)

---

## Need Help?

- Facebook Graph API Docs: https://developers.facebook.com/docs/graph-api
- Marketing API Docs: https://developers.facebook.com/docs/marketing-api
- Graph Explorer: https://developers.facebook.com/tools/explorer/
