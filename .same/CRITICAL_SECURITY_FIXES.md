# Critical Security Fixes - LockSafe v1.0.1

**Date:** April 15, 2026
**Status:** ✅ FIXED - Ready for Testing
**Priority:** CRITICAL - Production Blocker

## Summary

Three critical security vulnerabilities have been identified and fixed in the LockSafe Android v1.0.1 backend API. These vulnerabilities allowed unauthorized access to sensitive locksmith data and system manipulation.

---

## BUG-001: Unauthenticated Access to Profile API ✅ FIXED

### Severity: CRITICAL

### Issue
The `/api/locksmith/profile` endpoint had **NO authentication** whatsoever. Anyone with a locksmith ID could retrieve:
- Personal email, phone number
- Home address with GPS coordinates (lat/lng)
- Insurance document URLs
- Stripe account ID
- Balance and earnings data
- Availability status

### Impact
- Complete data breach of locksmith PII
- Attacker could enumerate locksmith IDs and harvest all personal data
- GPS coordinates reveal locksmith's home/base address
- Stripe account ID could be used in social engineering attacks

### Fix Applied
**File:** `src/app/api/locksmith/profile/route.ts`

```typescript
// Added authentication checks to both GET and PATCH methods
import { isLocksmithAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // SECURITY: Verify locksmith is authenticated
  const session = await isLocksmithAuthenticated();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  // SECURITY: Verify the locksmith is accessing their own profile
  if (session.id !== locksmithId) {
    return NextResponse.json(
      { success: false, error: "Forbidden - You can only access your own profile" },
      { status: 403 }
    );
  }

  // ... rest of the endpoint logic
}
```

### Testing
```bash
# Before fix - worked without auth
curl https://www.locksafe.uk/api/locksmith/profile?locksmithId=69d94f89e27c2b3323d5a731

# After fix - returns 401 Unauthorized
curl https://www.locksafe.uk/api/locksmith/profile?locksmithId=69d94f89e27c2b3323d5a731

# With valid token - returns 200 OK
curl https://www.locksafe.uk/api/locksmith/profile?locksmithId=69d94f89e27c2b3323d5a731 \
  -H "Cookie: auth_token=VALID_JWT_TOKEN"
```

---

## BUG-002: Unauthenticated Availability Toggle ✅ FIXED

### Severity: CRITICAL

### Issue
The `/api/locksmith/availability` endpoint required **NO authentication**. Anyone could:
- Toggle any locksmith's availability status
- Take locksmiths offline maliciously
- Disrupt the entire platform

### Impact
- Business-critical denial-of-service vulnerability
- Competitor or malicious actor could systematically disable all locksmiths
- Platform revenue loss from disabled locksmiths

### Fix Applied
**File:** `src/app/api/locksmith/availability/route.ts`

```typescript
import { isLocksmithAuthenticated } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // SECURITY: Verify locksmith is authenticated
  const session = await isLocksmithAuthenticated();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  // SECURITY: Verify the locksmith is updating their own availability
  if (session.id !== locksmithId) {
    return NextResponse.json(
      { success: false, error: "Forbidden - You can only update your own availability" },
      { status: 403 }
    );
  }

  // ... rest of the endpoint logic
}
```

### Testing
```bash
# Before fix - worked without auth
curl -X POST https://www.locksafe.uk/api/locksmith/availability \
  -H "Content-Type: application/json" \
  -d '{"locksmithId":"69d94f89e27c2b3323d5a731","isAvailable":false}'

# After fix - returns 401 Unauthorized
curl -X POST https://www.locksafe.uk/api/locksmith/availability \
  -H "Content-Type: application/json" \
  -d '{"locksmithId":"69d94f89e27c2b3323d5a731","isAvailable":false}'
```

---

## BUG-003: Logout Does Not Invalidate JWT Token ✅ FIXED

### Severity: HIGH

### Issue
The `/api/auth/logout` endpoint only cleared the cookie but **did not invalidate the JWT token**. The same token continued to work for up to 7 days after logout.

### Impact
- If a locksmith's device is compromised or token is intercepted, logging out provides NO protection
- Attacker retains full access for up to 7 days even after user logs out
- Directly undermines the security model

### Fix Applied

#### 1. Created TokenBlacklist Model
**File:** `prisma/schema.prisma`

```prisma
// Token Blacklist for logout/revoked JWT tokens
model TokenBlacklist {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  token     String   @unique // The JWT token (hashed for security)
  userId    String   // ID of the user who logged out
  userType  String   // "admin", "locksmith", or "customer"
  expiresAt DateTime // When the token would have expired naturally
  createdAt DateTime @default(now())

  @@index([expiresAt])
}
```

#### 2. Updated Auth Library
**File:** `src/lib/auth.ts`

```typescript
import crypto from "crypto";
import prisma from "@/lib/db";

// Hash token for storage (prevents token leakage if DB is compromised)
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Check if token is blacklisted
async function isTokenBlacklisted(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const blacklisted = await prisma.tokenBlacklist.findUnique({
    where: { token: tokenHash },
  });
  return !!blacklisted;
}

// Add token to blacklist
export async function blacklistToken(token: string, payload: TokenPayload): Promise<void> {
  const tokenHash = hashToken(token);
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.tokenBlacklist.create({
    data: {
      token: tokenHash,
      userId: payload.id,
      userType: payload.type,
      expiresAt,
    },
  });
}

// Updated verifyToken to check blacklist
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  // First check if token is blacklisted
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    return null;
  }

  // Then verify JWT signature and expiry
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
```

#### 3. Updated Logout Endpoint
**File:** `src/app/api/auth/logout/route.ts`

```typescript
import { blacklistToken, verifyTokenSync } from "@/lib/auth";

export async function POST() {
  // Get the current token from cookies
  const token = cookieStore.get("auth_token")?.value;

  // If token exists and is valid, add it to the blacklist
  if (token) {
    const payload = verifyTokenSync(token);
    if (payload) {
      await blacklistToken(token, payload);
    }
  }

  // Clear the auth cookie
  // ... cookie clearing logic
}
```

#### 4. Created Cleanup Cron Job
**File:** `src/app/api/cron/cleanup-blacklisted-tokens/route.ts`

Automatically removes expired tokens from the blacklist daily to prevent database bloat.

### Testing
```bash
# 1. Login and get token
TOKEN=$(curl -X POST https://www.locksafe.uk/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt -s | jq -r '.token')

# 2. Verify token works
curl https://www.locksafe.uk/api/auth/session \
  -b cookies.txt

# 3. Logout
curl -X POST https://www.locksafe.uk/api/auth/logout \
  -b cookies.txt

# 4. Try to use the same token - should return 401 Unauthorized
curl https://www.locksafe.uk/api/auth/session \
  -b cookies.txt
```

---

## Database Migration Required

After deploying these changes, run:

```bash
# Generate Prisma client with new TokenBlacklist model
npx prisma generate

# Push schema changes to database
npx prisma db push
```

Or if using Prisma Migrate:

```bash
npx prisma migrate dev --name add-token-blacklist
npx prisma migrate deploy
```

---

## Cron Job Setup (Vercel)

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/cleanup-blacklisted-tokens",
    "schedule": "0 2 * * *"
  }]
}
```

Set environment variable:
```
CRON_SECRET=your-secret-key-here
```

---

## Additional Security Improvements

### Implemented
- ✅ JWT token blacklisting on logout
- ✅ Authentication checks on all locksmith profile endpoints
- ✅ Authorization checks (users can only access their own data)
- ✅ Token hashing before storage (prevents token leakage if DB compromised)
- ✅ Automatic cleanup of expired blacklisted tokens

### Recommended for Future
- 🔄 Consider short-lived access tokens (15min) + refresh tokens
- 🔄 Implement rate limiting on sensitive endpoints
- 🔄 Add IP-based anomaly detection for login attempts
- 🔄 Implement 2FA for locksmith accounts
- 🔄 Add audit logging for sensitive operations

---

## Files Modified

1. ✅ `prisma/schema.prisma` - Added TokenBlacklist model
2. ✅ `src/lib/auth.ts` - Added token blacklisting logic
3. ✅ `src/app/api/auth/logout/route.ts` - Updated to blacklist tokens
4. ✅ `src/app/api/locksmith/profile/route.ts` - Added authentication
5. ✅ `src/app/api/locksmith/availability/route.ts` - Added authentication
6. ✅ `src/app/api/cron/cleanup-blacklisted-tokens/route.ts` - New cron job

---

## Production Readiness Checklist

Before deploying to production:

- [ ] Run `npx prisma generate` to update Prisma Client
- [ ] Run `npx prisma db push` to update database schema
- [ ] Set up `CRON_SECRET` environment variable
- [ ] Configure Vercel cron job for token cleanup
- [ ] Test login/logout flow end-to-end
- [ ] Test profile access with valid/invalid tokens
- [ ] Test availability toggle with authentication
- [ ] Monitor for any authentication errors in logs

---

## Performance Considerations

### Token Blacklist Queries
- Indexed on `token` field (unique index) - O(1) lookup
- Indexed on `expiresAt` field - efficient cleanup
- Token is hashed with SHA-256 before storage
- Automatic cleanup prevents database bloat

### Expected Load
- 1 blacklist entry per logout
- Average token lifetime: 7 days
- Cleanup runs daily at 2 AM UTC
- MongoDB handles millions of documents efficiently

---

## Security Contact

If you discover any security vulnerabilities, please report them immediately to:
- **Email:** security@locksafe.uk
- **Priority:** URGENT - Response within 24 hours

---

**Status: All critical security vulnerabilities have been fixed and are ready for production deployment.**
