# OneSignal Push Notifications Setup Guide

## Overview

LockSafe uses OneSignal for cross-platform push notifications that work on:
- Android Chrome (PWA)
- iOS Safari 16.4+ (PWA)
- Desktop browsers (Chrome, Firefox, Edge, Safari)

## Step 1: Create OneSignal Account

1. Go to [https://onesignal.com](https://onesignal.com)
2. Sign up for a free account
3. You'll get **10,000 free web push subscribers** on the free tier

## Step 2: Create a Web Push App

1. In OneSignal dashboard, click **"New App/Website"**
2. Enter app name: `LockSafe UK`
3. Select **"Web"** platform
4. Choose **"Typical Site"** setup

## Step 3: Configure Web Push Settings

### Basic Setup
1. **Site Name**: `LockSafe UK`
2. **Site URL**: `https://locksafe.uk` (your production URL)
3. **Auto Resubscribe**: Enable (helps with Safari)
4. **Default Icon URL**: `https://locksafe.uk/icons/icon-192x192.png`

### Service Worker Settings
1. **Service Worker Path**: `/OneSignalSDKWorker.js`
2. **Service Worker Scope**: `/`

### Safari Web Push (For iOS)
1. Go to **Settings > Platforms > Web Push**
2. Click **"Safari Web Push"**
3. Upload Safari push package (OneSignal guides you through this)
4. Copy the **Safari Web ID** (starts with `web.onesignal.auto.`)

## Step 4: Get API Keys

1. Go to **Settings > Keys & IDs**
2. Copy:
   - **OneSignal App ID** → `NEXT_PUBLIC_ONESIGNAL_APP_ID`
   - **REST API Key** → `ONESIGNAL_REST_API_KEY`
   - **Safari Web ID** → `NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID` (optional)

## Step 5: Add to Environment Variables

Add these to your `.env.local` file:

```env
# OneSignal Push Notifications
NEXT_PUBLIC_ONESIGNAL_APP_ID=your-app-id-here
ONESIGNAL_REST_API_KEY=your-rest-api-key-here
NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID=web.onesignal.auto.xxxxx  # Optional, for iOS
```

## Step 6: Create Segments (For Targeted Marketing)

In OneSignal Dashboard > **Audience > Segments**, create these segments:

### 1. Customers Segment
- **Name**: `customers`
- **Filter**: Tag `user_type` is `customer`

### 2. Locksmiths Segment
- **Name**: `locksmiths`
- **Filter**: Tag `user_type` is `locksmith`

### 3. Available Locksmiths
- **Name**: `available_locksmiths`
- **Filter**: Tag `user_type` is `locksmith` AND Tag `is_available` is `true`

### 4. Verified Locksmiths
- **Name**: `verified_locksmiths`
- **Filter**: Tag `user_type` is `locksmith` AND Tag `is_verified` is `true`

### 5. Active Jobs
- **Name**: `active_jobs`
- **Filter**: Tag `has_active_job` is `true`

### 6. Returning Customers
- **Name**: `returning_customers`
- **Filter**: Tag `user_type` is `customer` AND Tag `job_count` > `1`

## Step 7: Test Push Notifications

### Test on Desktop
1. Open your app in Chrome/Firefox/Safari
2. Click "Enable Notifications" in the banner
3. Go to OneSignal Dashboard > **Messages > Push**
4. Click **"New Push"**
5. Send a test message to yourself

### Test on Android (PWA)
1. Open Chrome on Android
2. Visit your site
3. Install the PWA (Add to Home Screen)
4. Open the PWA
5. Enable notifications when prompted
6. Send a test push from OneSignal dashboard

### Test on iOS (PWA)
1. Use Safari on iOS 16.4+
2. Visit your site
3. Tap Share > Add to Home Screen
4. Open the PWA
5. Enable notifications when prompted
6. Send a test push from OneSignal dashboard

**Note for iOS**: The notification permission prompt only shows once. If denied, users must go to iOS Settings > Safari > Notifications to re-enable.

## Available Notification Templates

The system includes pre-built templates for common scenarios:

### Customer Notifications
| Template | Description |
|----------|-------------|
| `LOCKSMITH_ASSIGNED` | When a locksmith accepts the job |
| `LOCKSMITH_EN_ROUTE` | Locksmith is on the way |
| `LOCKSMITH_ARRIVED` | Locksmith has arrived |
| `QUOTE_READY` | Quote is ready for review |
| `WORK_COMPLETE` | Work finished, please sign |
| `SIGNATURE_REMINDER` | Reminder to sign off |

### Locksmith Notifications
| Template | Description |
|----------|-------------|
| `NEW_JOB_AVAILABLE` | New job in your area |
| `JOB_ACCEPTED` | Customer accepted your application |
| `QUOTE_ACCEPTED` | Customer accepted your quote |
| `QUOTE_DECLINED` | Customer declined your quote |
| `CUSTOMER_SIGNED` | Customer signed, payment processing |
| `PAYOUT_SENT` | Payout has been sent |

## API Usage

### Send a notification programmatically:

```typescript
import { sendNotification, notifyCustomer, notifyLocksmith } from "@/lib/onesignal";

// Send to specific player
await sendNotification({
  playerIds: ["player-id-1", "player-id-2"],
  title: "Hello!",
  message: "This is a test notification",
  url: "/customer/dashboard",
});

// Send using template to customer
await notifyCustomer(oneSignalPlayerId, "LOCKSMITH_ARRIVED", {
  jobId: "job-123",
});

// Broadcast to all locksmiths
await broadcastToSegment("locksmiths", "New Feature!", "Check out our new feature.");
```

## Troubleshooting

### Notifications not showing on iOS
1. Ensure iOS 16.4 or later
2. App must be installed as PWA (Add to Home Screen)
3. User must grant permission in the PWA
4. Check if Safari Web Push is configured in OneSignal

### Notifications not showing on Android
1. Check if service worker is registered
2. Verify HTTPS is enabled
3. Check browser notification permissions

### OneSignal SDK not loading
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_ONESIGNAL_APP_ID` is set
3. Check if ad blockers are interfering

## Analytics & Dashboard

OneSignal provides analytics at:
- **Delivery**: Track sent, delivered, and clicked rates
- **Audience**: See subscriber growth over time
- **A/B Testing**: Test different notification content
- **Automated Messages**: Set up drip campaigns

## Cost

- **Free Tier**: 10,000 web push subscribers
- **Growth Plan**: $9/month for 10,000+ subscribers
- **Professional Plan**: $99/month for advanced features

For LockSafe's scale, the free tier should be sufficient initially.
