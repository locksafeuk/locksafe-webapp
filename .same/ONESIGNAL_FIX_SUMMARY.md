# OneSignal API Endpoints - Priority 1 Fixes

## Executive Summary

✅ **COMPLETED** - Fixed broken OneSignal API endpoints to properly store and remove player IDs in the database.

## What Was Broken

The OneSignal subscribe and unsubscribe endpoints were not reliably storing player IDs in the database, which meant:
- Push notifications couldn't be sent to users
- Subscription state wasn't persisted
- No way to track who was subscribed
- Database operations could fail silently

## What Was Fixed

### 1. `/api/onesignal/subscribe` Endpoint

**File:** `src/app/api/onesignal/subscribe/route.ts`

**Changes Made:**
- ✅ **Database persistence guaranteed** - All player IDs are now atomically stored in the database
- ✅ **Comprehensive error handling** - Database failures are caught and returned with detailed error messages
- ✅ **Enhanced logging** - Every database operation is logged with success (✅), error (❌), or warning (⚠️) indicators
- ✅ **Better validation** - Validates UUID format for player IDs before processing
- ✅ **Guest subscription handling** - Properly stores guest subscriptions in `PushSubscription` table with error handling
- ✅ **Customer subscription handling** - Stores in `Customer.oneSignalPlayerId` and `Customer.oneSignalSubscribedAt` with atomic update
- ✅ **Locksmith subscription handling** - Stores in `Locksmith.oneSignalPlayerId` and `Locksmith.oneSignalSubscribedAt` with atomic update
- ✅ **Previous player ID tracking** - Returns the previous player ID if user is re-subscribing
- ✅ **User tags** - Sets OneSignal player tags with user information for segmentation

**Database Fields Updated:**
```typescript
Customer {
  oneSignalPlayerId: string | null      // Player UUID
  oneSignalSubscribedAt: DateTime | null // Subscription timestamp
}

Locksmith {
  oneSignalPlayerId: string | null      // Player UUID
  oneSignalSubscribedAt: DateTime | null // Subscription timestamp
}

PushSubscription {
  playerId: string                       // Player UUID (unique)
  userType: string                       // "guest", "customer", or "locksmith"
  isActive: boolean                      // Active status
  subscribedAt: DateTime                 // Subscription timestamp
}
```

### 2. `/api/onesignal/unsubscribe` Endpoint

**File:** `src/app/api/onesignal/unsubscribe/route.ts`

**Changes Made:**
- ✅ **Database cleanup guaranteed** - All player IDs are atomically removed from the database
- ✅ **OneSignal API deletion** - Deletes player from OneSignal API before updating database
- ✅ **Comprehensive error handling** - Handles missing records gracefully
- ✅ **Enhanced logging** - Tracks both database and API deletion status
- ✅ **Guest unsubscription handling** - Properly removes from `PushSubscription` table
- ✅ **Customer unsubscription handling** - Clears `Customer.oneSignalPlayerId` and `Customer.oneSignalSubscribedAt`
- ✅ **Locksmith unsubscription handling** - Clears `Locksmith.oneSignalPlayerId` and `Locksmith.oneSignalSubscribedAt`
- ✅ **Graceful handling** - Returns success even if player ID doesn't exist (idempotent)
- ✅ **Status reporting** - Returns both database and OneSignal API deletion status

## Testing the Fixes

### 1. Test Customer Subscribe
```bash
curl -X POST http://localhost:3000/api/onesignal/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "CUSTOMER_ID",
    "userType": "customer",
    "playerId": "12345678-1234-1234-1234-123456789abc"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Customer subscription saved successfully to database",
  "playerId": "12345678-1234-1234-1234-123456789abc",
  "userId": "CUSTOMER_ID",
  "previousPlayerId": null
}
```

**Expected Database State:**
```javascript
// Query the customer
const customer = await prisma.customer.findUnique({
  where: { id: "CUSTOMER_ID" },
  select: { oneSignalPlayerId: true, oneSignalSubscribedAt: true }
});

// Result should be:
{
  oneSignalPlayerId: "12345678-1234-1234-1234-123456789abc",
  oneSignalSubscribedAt: "2024-01-15T10:30:00.000Z" // Current timestamp
}
```

### 2. Test Customer Unsubscribe
```bash
curl -X POST http://localhost:3000/api/onesignal/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "CUSTOMER_ID",
    "userType": "customer"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Customer subscription removed from database successfully",
  "userFound": true,
  "hadPlayerId": true,
  "deletedFromOneSignal": true,
  "userId": "CUSTOMER_ID"
}
```

**Expected Database State:**
```javascript
// Query the customer
const customer = await prisma.customer.findUnique({
  where: { id: "CUSTOMER_ID" },
  select: { oneSignalPlayerId: true, oneSignalSubscribedAt: true }
});

// Result should be:
{
  oneSignalPlayerId: null,
  oneSignalSubscribedAt: null
}
```

### 3. Test Guest Subscribe
```bash
curl -X POST http://localhost:3000/api/onesignal/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "12345678-1234-1234-1234-123456789abc",
    "userType": "guest"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Guest subscription saved successfully. Will be linked when user logs in.",
  "playerId": "12345678-1234-1234-1234-123456789abc",
  "subscriptionId": "SUBSCRIPTION_DB_ID"
}
```

**Expected Database State:**
```javascript
// Query the subscription
const subscription = await prisma.pushSubscription.findUnique({
  where: { playerId: "12345678-1234-1234-1234-123456789abc" }
});

// Result should be:
{
  id: "SUBSCRIPTION_DB_ID",
  playerId: "12345678-1234-1234-1234-123456789abc",
  userType: "guest",
  isActive: true,
  subscribedAt: "2024-01-15T10:30:00.000Z"
}
```

## Error Handling

All endpoints now return detailed error information:

### User Not Found Error
```json
{
  "error": "Customer not found. Please ensure the user is registered.",
  "code": "USER_NOT_FOUND"
}
```

### Database Error
```json
{
  "error": "Failed to save subscription to database",
  "code": "DATABASE_UPDATE_ERROR",
  "details": "Detailed error message (only in development)"
}
```

### Invalid Player ID Format
```json
{
  "error": "Invalid playerId format. Expected UUID.",
  "code": "INVALID_FORMAT"
}
```

## Logging Examples

### Successful Subscribe
```
[OneSignal] Subscribe request: { userId: 'cust_123', userType: 'customer', playerId: '12345678...' }
[OneSignal] Processing customer subscription: userId=cust_123
[OneSignal] ✅ Customer subscription stored in database: cust_123 -> 12345678-1234-1234-1234-123456789abc
```

### Successful Unsubscribe
```
[OneSignal] Unsubscribe request: { userId: 'cust_123', userType: 'customer', directPlayerId: undefined }
[OneSignal] Processing customer unsubscribe: userId=cust_123
[OneSignal] ✅ Player deleted from OneSignal API: 12345678-1234-1234-1234-123456789abc
[OneSignal] ✅ Customer subscription removed from database: cust_123
```

### Error Example
```
[OneSignal] Subscribe request: { userId: 'invalid_id', userType: 'customer', playerId: '12345678...' }
[OneSignal] Processing customer subscription: userId=invalid_id
[OneSignal] ❌ Customer not found: invalid_id
```

## Integration Points

These endpoints are used by:

1. **Frontend Hook:** `src/hooks/useOneSignal.ts`
   - Calls subscribe when user enables notifications
   - Calls unsubscribe when user disables notifications

2. **OneSignal Provider:** `src/components/notifications/OneSignalProvider.tsx`
   - Manages OneSignal SDK initialization
   - Handles subscription lifecycle

3. **Notification Banner:** `src/components/notifications/PushNotificationBanner.tsx`
   - Prompts users to enable notifications
   - Calls subscribe endpoint on permission grant

## Verification Checklist

- [x] Subscribe endpoint stores player IDs in database
- [x] Unsubscribe endpoint removes player IDs from database
- [x] Error handling is comprehensive
- [x] Logging is detailed and helpful
- [x] Guest subscriptions work correctly
- [x] Customer subscriptions work correctly
- [x] Locksmith subscriptions work correctly
- [x] OneSignal API deletion works
- [x] Database operations are atomic
- [x] Previous player IDs are tracked
- [x] Error codes are standardized

## Next Steps

1. **Deploy to Production** - The fixes are ready for deployment
2. **Monitor Logs** - Watch for `[OneSignal]` log entries to verify operations
3. **Test Notifications** - Send test notifications to subscribed users
4. **Verify Database** - Check that player IDs are being stored correctly

## Related Files

- `src/app/api/onesignal/subscribe/route.ts` - Subscribe endpoint (fixed)
- `src/app/api/onesignal/unsubscribe/route.ts` - Unsubscribe endpoint (fixed)
- `src/lib/onesignal.ts` - OneSignal server-side library
- `src/hooks/useOneSignal.ts` - Frontend React hook
- `prisma/schema.prisma` - Database schema with OneSignal fields
- `.info/ONESIGNAL_SETUP.md` - Complete setup and usage guide

## Environment Variables Required

```env
# Required for OneSignal to work
NEXT_PUBLIC_ONESIGNAL_APP_ID=your-app-id-here
ONESIGNAL_REST_API_KEY=your-rest-api-key-here

# Optional for iOS Safari support
NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID=web.onesignal.auto.xxxxx
```
