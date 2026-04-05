# Complete Meta Ads Setup Guide - From Zero to Publishing

This guide walks you through **EVERYTHING** you need to set up Meta (Facebook/Instagram) Ads integration, starting from scratch with no prior setup.

---

## 📋 What You'll Create

By the end of this guide, you'll have:
1. ✅ A Facebook Page for your business
2. ✅ A Meta Business Manager account
3. ✅ A Meta Developer App
4. ✅ An Ad Account
5. ✅ A Meta Pixel for tracking
6. ✅ All required environment variables

**Time needed:** ~30-45 minutes

---

## 🔴 CRITICAL: Environment Variables Format

Your `.env` file must have **actual values**, not empty strings:

### ❌ WRONG (Empty strings - will cause errors):
```env
META_ACCESS_TOKEN=""
META_AD_ACCOUNT_ID=""
META_PAGE_ID=""
```

### ✅ CORRECT (Actual values):
```env
META_ACCESS_TOKEN=EAAIxxxxxxxxxxxxxxx
META_AD_ACCOUNT_ID=act_123456789012345
META_PAGE_ID=123456789012345
```

---

## Part 1: Create a Facebook Page (If You Don't Have One)

### Step 1.1: Log into Facebook
1. Go to [facebook.com](https://www.facebook.com)
2. Log in with your personal Facebook account

### Step 1.2: Create a New Page
1. Click the **Menu** icon (9 dots) in the top right corner
2. Click **Page** under "Create"
3. Or go directly to: [facebook.com/pages/create](https://www.facebook.com/pages/create)

### Step 1.3: Fill in Page Details
1. **Page name:** Enter your business name (e.g., "LockSafe UK" or "London Emergency Locksmith")
2. **Category:** Search and select "Locksmith" or "Local Service"
3. **Bio:** Write a short description (e.g., "24/7 Emergency Locksmith Services in London")
4. Click **Create Page**

### Step 1.4: Complete Your Page Setup
1. Add a **Profile Picture** (your logo - 180x180 pixels)
2. Add a **Cover Photo** (1200x628 pixels)
3. Click **About** → Add your:
   - Business hours
   - Phone number
   - Email
   - Website URL
   - Location/service area

### Step 1.5: Get Your Page ID
1. Go to your new Facebook Page
2. Click **About** in the left menu
3. Scroll down to **Page transparency**
4. Click **See all**
5. Find and copy the **Page ID** (a number like `123456789012345`)

**Save this for later:**
```
META_PAGE_ID=123456789012345
```

---

## Part 2: Set Up Meta Business Manager

### Step 2.1: Create Business Manager Account
1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Create Account**
3. Enter:
   - Business name: Your company name
   - Your name: Your full name
   - Business email: Your work email
4. Click **Submit**

### Step 2.2: Add Your Facebook Page to Business Manager
1. In Business Manager, click **Settings** (gear icon) → **Business Settings**
2. In the left menu, click **Accounts** → **Pages**
3. Click **Add** → **Add a Page**
4. Enter your Page name or URL
5. Click **Add Page**
6. If you own the Page, it will be added immediately

### Step 2.3: Create an Ad Account
1. In Business Settings, click **Accounts** → **Ad Accounts**
2. Click **Add** → **Create a new ad account**
3. Enter:
   - Ad Account Name: "LockSafe UK Ads" (or your business name)
   - Time Zone: Europe/London (or your timezone)
   - Currency: GBP (or your currency)
4. Click **Create**
5. Select who can access this ad account (add yourself)
6. Click **Create Ad Account**

### Step 2.4: Get Your Ad Account ID
1. In **Ad Accounts**, click on your newly created account
2. Look at the **Ad Account ID** in the details panel
3. Copy the full ID (it will look like `act_123456789012345`)

**Save this for later:**
```
META_AD_ACCOUNT_ID=act_123456789012345
```

> ⚠️ **IMPORTANT:** Include the `act_` prefix! The format must be `act_XXXXXXX`

---

## Part 3: Create a Meta Developer App

### Step 3.1: Register as a Developer
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **Get Started**
3. Accept the Terms of Service
4. Verify your email if prompted
5. You're now a Meta Developer!

### Step 3.2: Create Your App
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click **Create App**

### Step 3.3: Select App Type
1. Choose **"Business"** app type
2. Click **Next**

### Step 3.4: App Details
1. **App Name:** "LockSafe UK Ads Manager" (or similar)
2. **App Contact Email:** Your business email
3. **Business Account:** Select your Business Manager account
4. Click **Create App**

### Step 3.5: Add App Permissions (Products)
1. On the app dashboard, find **Add Products to Your App**
2. Click **Set Up** on **Marketing API**
3. The Marketing API is now added to your app

### Step 3.6: Get App ID and Secret
1. In your app dashboard, click **Settings** → **Basic**
2. You'll see:
   - **App ID:** Copy this number
   - **App Secret:** Click **Show** and copy this

**Save these for later:**
```
META_APP_ID=123456789012345
META_APP_SECRET=abcdef123456789abcdef123456789
```

---

## Part 4: Create a System User & Generate Access Token

This is the **most important step** - the Access Token authenticates all your API requests.

### Step 4.1: Go to Business Settings
1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Settings** (gear icon) → **Business Settings**

### Step 4.2: Create a System User
1. In the left menu, go to **Users** → **System Users**
2. Click **Add**
3. Enter:
   - **System User Name:** "LockSafe API User" (or similar)
   - **System User Role:** Select **Admin**
4. Click **Create System User**

### Step 4.3: Assign Assets to System User
This is crucial - the System User needs access to your Page, Ad Account, and App.

1. Click on your newly created System User
2. Click **Add Assets**
3. Add these assets one by one:

**A) Add Your App:**
- Select **Apps** tab
- Check your app ("LockSafe UK Ads Manager")
- Set permissions to **Full Control** (or Develop App if that's not available)
- Click **Save Changes**

**B) Add Your Ad Account:**
- Click **Add Assets** again
- Select **Ad Accounts** tab
- Check your ad account
- Set permissions to **Manage Campaigns** or **Full Control**
- Click **Save Changes**

**C) Add Your Page:**
- Click **Add Assets** again
- Select **Pages** tab
- Check your Facebook Page
- Set permissions to **Full Control** (or all available permissions)
- Click **Save Changes**

### Step 4.4: Generate the Access Token
1. Click on your System User
2. Click **Generate New Token**

**Token Generation Wizard:**

**Step 1 - Select App:**
- Choose your Meta App from the dropdown

**Step 2 - Set Expiration:**
- Select **"Never"** for a permanent token (recommended)
- Or choose 60 days if Never isn't available

**Step 3 - Select Permissions:**
This is CRITICAL! Scroll through the list and select these permissions:

**Essential - Ads Management:**
- ✅ `ads_management` - Create and manage ads
- ✅ `ads_read` - Read ad data and insights

**Essential - Business:**
- ✅ `business_management` - Manage business assets

**Essential - Pages:**
- ✅ `pages_manage_engagement` - Manage page engagement
- ✅ `pages_manage_metadata` - Manage page settings
- ✅ `pages_manage_posts` - Create posts
- ✅ `pages_read_engagement` - Read page data
- ✅ `pages_show_list` - Show pages list

> 💡 **TIP:** The permissions list is scrollable! Scroll down to find all the permissions you need.

**Step 4 - Generate:**
- Click **Generate Token**
- **COPY THIS TOKEN IMMEDIATELY!** You won't see it again!

**Save this for later:**
```
META_ACCESS_TOKEN=EAAIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **WARNING:** This token is like a password. Never share it or commit it to Git!

---

## Part 5: Create a Meta Pixel (For Conversion Tracking)

### Step 5.1: Go to Events Manager
1. Go to [business.facebook.com/events_manager](https://business.facebook.com/events_manager)

### Step 5.2: Connect a Data Source
1. Click **Connect Data Sources** (green button)
2. Select **Web**
3. Click **Connect**

### Step 5.3: Create the Pixel
1. Select **Meta Pixel**
2. Click **Connect**
3. Enter:
   - **Pixel Name:** "LockSafe UK Website" (or your business name)
   - **Website URL:** Your website (e.g., locksafe.co.uk)
4. Click **Continue**
5. For setup method, you can choose **Install code manually** or skip for now

### Step 5.4: Get Your Pixel ID
1. In Events Manager, click on your Pixel in the left sidebar
2. Click **Settings**
3. Your **Pixel ID** is displayed at the top (a number like `123456789012345`)

**Save this for later:**
```
NEXT_PUBLIC_META_PIXEL_ID=123456789012345
```

### Step 5.5: Generate Conversions API Token (Optional but Recommended)
1. In your Pixel Settings, scroll down to **Conversions API**
2. Click **Generate access token** under "Set up manually"
3. Copy the token

**Save this for later:**
```
META_CONVERSIONS_API_TOKEN=EAAIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 💡 You can also use your System User Access Token for this instead of generating a separate one.

---

## Part 6: Add Everything to Your .env File

Now add all your credentials to the `.env` file in your project:

```env
# =====================================
# META APP CREDENTIALS
# =====================================
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here

# =====================================
# META MARKETING API (Required for Ads)
# =====================================
# Your System User Access Token (CRITICAL!)
META_ACCESS_TOKEN=EAAIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Your Ad Account ID (with act_ prefix!)
META_AD_ACCOUNT_ID=act_123456789012345

# Your Facebook Page ID
META_PAGE_ID=123456789012345

# =====================================
# META PIXEL (For Tracking)
# =====================================
# Your Pixel ID (used client-side)
NEXT_PUBLIC_META_PIXEL_ID=123456789012345

# Conversions API Token (used server-side)
META_CONVERSIONS_API_TOKEN=EAAIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Part 7: Verify Everything Works

### Step 7.1: Restart Your Development Server
After updating `.env`, restart your Next.js server:
```bash
# Stop the current server (Ctrl+C)
# Then restart
bun dev
```

### Step 7.2: Check the Admin Panel
1. Go to your admin panel: `/admin/ads`
2. Look at the **Environment Variables Status** section at the bottom
3. All Meta variables should show ✅ green checkmarks

### Step 7.3: Test the API Connection
You can test your access token with this curl command:
```bash
curl "https://graph.facebook.com/v25.0/me?access_token=YOUR_ACCESS_TOKEN"
```

If successful, you'll see your app/user info. If there's an error, you'll see an error message.

### Step 7.4: Try Creating a Campaign
1. In the admin panel, go to `/admin/ads/create`
2. Create a test campaign
3. Try publishing it to Meta
4. It should now work!

---

## 🔧 Troubleshooting

### Error: "Failed to create campaign in Meta"

**Possible causes:**

1. **Empty environment variables**
   - Check your `.env` file - values must NOT be empty strings
   - Run: `echo $META_ACCESS_TOKEN` to verify the value is loaded

2. **Invalid Access Token**
   - Token may have expired (if you didn't set it to "Never")
   - Token may not have the required permissions
   - Generate a new System User token

3. **Missing act_ prefix**
   - Ad Account ID must start with `act_`
   - Example: `act_123456789012345`

4. **System User lacks permissions**
   - Go to Business Settings → System Users
   - Click on your System User
   - Verify it has access to your App, Ad Account, AND Page

5. **Ad Account not connected to Page**
   - Go to Business Settings → Ad Accounts
   - Click your Ad Account
   - Ensure your Page is connected to it

### Error: "Invalid OAuth access token"

- Your token has expired or is malformed
- Generate a new System User token
- Make sure you copied the entire token (they're very long!)

### Error: "Page ID not found"

- The Page ID might be wrong
- Verify the Page is added to your Business Manager
- Verify your System User has access to the Page

### Error: "(#100) Pages Public Content Access requires..."

- Your app may need App Review for certain features
- For basic ads, this shouldn't be needed
- Check your App's Use Cases in the developer dashboard

### Ads stuck in "PENDING_REVIEW"

- This is normal for new ad accounts
- Meta reviews all new ads before they go live
- Can take a few minutes to 24 hours
- Make sure your ad content follows [Meta Advertising Policies](https://www.facebook.com/policies/ads/)

---

## 📋 Quick Reference Checklist

Use this to verify you have everything:

- [ ] Facebook Page created and ID copied
- [ ] Business Manager account set up
- [ ] Ad Account created with ID copied (with `act_` prefix)
- [ ] Meta Developer App created
- [ ] App ID and Secret copied
- [ ] System User created with **Admin** role
- [ ] System User has access to: App, Ad Account, Page
- [ ] System User Access Token generated with all permissions
- [ ] Meta Pixel created and ID copied
- [ ] All values added to `.env` file (not empty strings!)
- [ ] Development server restarted
- [ ] Admin panel shows green checkmarks for Meta variables

---

## 🔗 Useful Links

| Resource | URL |
|----------|-----|
| Facebook Page Manager | [facebook.com/pages](https://www.facebook.com/pages) |
| Meta Business Suite | [business.facebook.com](https://business.facebook.com) |
| Business Settings | [business.facebook.com/settings](https://business.facebook.com/settings/info) |
| Meta Ads Manager | [business.facebook.com/adsmanager](https://business.facebook.com/adsmanager) |
| Events Manager (Pixel) | [business.facebook.com/events_manager](https://business.facebook.com/events_manager) |
| Meta Developers | [developers.facebook.com](https://developers.facebook.com) |
| Graph API Explorer | [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer) |
| Marketing API Docs | [developers.facebook.com/docs/marketing-api](https://developers.facebook.com/docs/marketing-api) |

---

## 💬 Still Having Issues?

1. **Check the server logs** - Look for detailed error messages
2. **Verify token permissions** - Use Graph API Explorer to test
3. **Check Business Manager notifications** - There may be verification steps required
4. **Contact Meta Support** - [developers.facebook.com/support](https://developers.facebook.com/support)
5. **Contact Same Support** - support@same.new

---

*Last updated: February 2026*
