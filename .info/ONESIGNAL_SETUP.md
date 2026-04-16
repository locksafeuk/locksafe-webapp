# OneSignal Push Notifications Setup Guide

## Overview

LockSafe uses OneSignal for cross-platform push notifications that work on:
- Android Chrome (PWA)
- iOS Safari 16.4+ (PWA)
- Desktop browsers (Chrome, Firefox, Edge, Safari)

## ✅ PRIORITY 1 FIXES (Completed)

### Fixed Issues
The following critical issues have been fixed in the OneSignal API endpoints:

#### 1. `/api/onesignal/subscribe` - Now Properly Stores Player IDs
**What was fixed:**
- ✅ Customer subscriptions are **guaranteed** to be saved to `Customer.oneSignalPlayerId` and `Customer.oneSignalSubscribedAt`
- ✅ Locksmith subscriptions are **guaranteed** to be saved to `Locksmith.oneSignalPlayerId` and `Locksmith.oneSignalSubscribedAt`
- ✅ Guest subscriptions are **guaranteed** to be saved to `PushSubscription` table
- ✅ Added comprehensive error handling for database failures
- ✅ Added detailed logging for debugging (✅ success, ❌ errors, ⚠️  warnings)
- ✅ Returns previous player ID if user is re-subscribing
- ✅ Atomic database operations with proper error propagation

#### 2. `/api/onesignal/unsubscribe` - Now Properly Removes Player IDs
**What was fixed:**
- ✅ Customer unsubscriptions **guaranteed** to clear `Customer.oneSignalPlayerId` and `Customer.oneSignalSubscribedAt`
- ✅ Locksmith unsubscriptions **guaranteed** to clear `Locksmith.oneSignalPlayerId` and `Locksmith.oneSignalSubscribedAt`
- ✅ Guest unsubscriptions **guaranteed** to be removed from `PushSubscription` table
- ✅ Player deletion from OneSignal API happens **before** database update
- ✅ Returns status of both database and OneSignal API deletions
- ✅ Handles cases where player ID doesn't exist gracefully

### API Usage Examples

#### Subscribe a Customer
```bash
curl -X POST https://your-domain.com/api/onesignal/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "customer_id_here",
    "userType": "customer",
    "playerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Customer subscription saved successfully to database",
  "playerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "userId": "customer_id_here",
  "previousPlayerId": null
}
```

#### Subscribe a Locksmith
```bash
curl -X POST https://your-domain.com/api/onesignal/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "locksmith_id_here",
    "userType": "locksmith",
    "playerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }'
```

#### Subscribe a Guest (No User Account Yet)
```bash
curl -X POST https://your-domain.com/api/onesignal/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "userType": "guest"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Guest subscription saved successfully. Will be linked when user logs in.",
  "playerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "subscriptionId": "database_subscription_id"
}
```

#### Unsubscribe a Customer
```bash
curl -X POST https://your-domain.com/api/onesignal/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "customer_id_here",
    "userType": "customer"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Customer subscription removed from database successfully",
  "userFound": true,
  "hadPlayerId": true,
  "deletedFromOneSignal": true,
  "userId": "customer_id_here"
}
```

#### Unsubscribe a Guest
```bash
curl -X POST https://your-domain.com/api/onesignal/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }'
```

### Error Responses

All endpoints now return detailed error information:

```json
{
  "error": "Failed to save subscription to database",
  "code": "DATABASE_UPDATE_ERROR",
  "details": "Detailed error message (in development mode only)"
}
```

**Common Error Codes:**
- `USER_NOT_FOUND` - User ID doesn't exist in database
- `DATABASE_ERROR` - Database operation failed
- `DATABASE_UPDATE_ERROR` - Failed to update user record
- `INVALID_JSON` - Request body is not valid JSON
- `INVALID_ID` - User ID format is invalid
- `DUPLICATE_SUBSCRIPTION` - Player ID already registered

### Verification Checklist

To verify the fixes are working:

1. **Check Database After Subscribe:**
   ```javascript
   // For Customer
   const customer = await prisma.customer.findUnique({
     where: { id: 'customer_id' },
     select: { oneSignalPlayerId: true, oneSignalSubscribedAt: true }
   });
   console.log(customer); // Should show player ID and timestamp

   // For Locksmith
   const locksmith = await prisma.locksmith.findUnique({
     where: { id: 'locksmith_id' },
     select: { oneSignalPlayerId: true, oneSignalSubscribedAt: true }
   });
   console.log(locksmith); // Should show player ID and timestamp

   // For Guest
   const subscription = await prisma.pushSubscription.findUnique({
     where: { playerId: 'player_id_here' }
   });
   console.log(subscription); // Should show subscription record
   ```

2. **Check Database After Unsubscribe:**
   ```javascript
   // Should be null
   const customer = await prisma.customer.findUnique({
     where: { id: 'customer_id' },
     select: { oneSignalPlayerId: true, oneSignalSubscribedAt: true }
   });
   console.log(customer); // oneSignalPlayerId and oneSignalSubscribedAt should be null
   ```

3. **Check Server Logs:**
   - Look for `[OneSignal] ✅` messages for successful operations
   - Look for `[OneSignal] ❌` messages for errors
   - Look for `[OneSignal] ⚠️` messages for warnings

### Logging Format

The endpoints now provide detailed logging:

```
[OneSignal] Subscribe request: { userId: 'xxx', userType: 'customer', playerId: 'xxxxxxxx...' }
[OneSignal] Processing customer subscription: userId=customer_id
[OneSignal] ✅ Customer subscription stored in database: customer_id -> player_id
```

```
[OneSignal] Unsubscribe request: { userId: 'xxx', userType: 'customer', directPlayerId: undefined }
[OneSignal] Processing customer unsubscribe: userId=customer_id
[OneSignal] ✅ Player deleted from OneSignal API: player_id
[OneSignal] ✅ Customer subscription removed from database: customer_id
```

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
