# Forgot Password Implementation - Complete Documentation

## Overview
Complete password reset functionality has been implemented for both **Clients** and **Locksmiths** using the Resend API for email delivery.

## What Was Implemented

### 1. Database Schema Updates
**File:** `prisma/schema.prisma`

Added password reset fields to the `Locksmith` model (Customer model already had them):
```prisma
// Password reset
resetToken             String?
resetTokenExpiry       DateTime?
```

### 2. API Endpoints Updated

#### `/api/auth/forgot-password` (POST)
**Updated to support both user types:**
- Accepts optional `userType` parameter: `"customer"` or `"locksmith"`
- If no userType specified, automatically checks both tables
- Generates secure 64-character reset token
- Sets 1-hour expiration
- Sends password reset email via Resend
- Returns success message (prevents email enumeration)

**Request Body:**
```json
{
  "email": "user@example.com",
  "userType": "locksmith" // optional: "customer" or "locksmith"
}
```

#### `/api/auth/reset-password` (POST)
**Updated to support both user types:**
- Accepts optional `userType` parameter
- Validates token and expiration
- Updates password and clears reset token
- Returns userType in response

**Request Body:**
```json
{
  "token": "abc123...",
  "password": "newPassword123",
  "userType": "locksmith" // optional
}
```

### 3. Frontend Pages

#### `/forgot-password` Page
**Enhanced with user type support:**
- Accepts `?type=locksmith` or `?type=customer` query parameter
- Dynamically adjusts page title and navigation based on user type
- Redirects to appropriate login page (/login or /locksmith/login)
- Sends userType to API endpoint

**URLs:**
- Clients: `/forgot-password` or `/forgot-password?type=customer`
- Locksmiths: `/forgot-password?type=locksmith`

#### `/reset-password` Page
**Enhanced with user type support:**
- Accepts `?token=xxx&type=locksmith` query parameters
- Redirects to appropriate login page after success
- Handles invalid/expired tokens gracefully

#### Login Pages
Both login pages now have "Forgot Password" links:

**Client Login (`/login`):**
- Link already existed at line 298-300
- Points to: `/forgot-password`

**Locksmith Login (`/locksmith/login`):**
- Updated existing link (was pointing to `#`)
- Now points to: `/forgot-password?type=locksmith`

### 4. Email Service
**File:** `src/lib/email.ts`

The `sendPasswordResetEmail` function was already implemented:
- Uses Resend API (configured with `RESEND_API_KEY`)
- Professional email template with branding
- Includes security notice about 1-hour expiration
- Sends from: `LockSafe UK <noreply@locksafe.uk>`

## User Flow

### For Clients (Customers)
1. Visit `/login`
2. Click "Forgot password?" link
3. Enter email address
4. Receive email with reset link
5. Click link → redirected to `/reset-password?token=xxx`
6. Enter new password
7. Redirected to `/login`

### For Locksmiths
1. Visit `/locksmith/login`
2. Click "Forgot password?" link
3. Redirected to `/forgot-password?type=locksmith`
4. Enter email address
5. Receive email with reset link including `&type=locksmith`
6. Click link → redirected to `/reset-password?token=xxx&type=locksmith`
7. Enter new password
8. Redirected to `/locksmith/login`

## Security Features

1. **Token Security:**
   - 64-character random token
   - 1-hour expiration
   - One-time use (cleared after password reset)

2. **Email Enumeration Prevention:**
   - Always returns success message
   - 500ms delay for non-existent accounts
   - No information leaked about account existence

3. **Password Requirements:**
   - Minimum 8 characters
   - Password strength indicator on reset page

4. **Database Security:**
   - Passwords hashed using `hashPassword()` from `lib/auth.ts`
   - Reset tokens stored securely in MongoDB

## Environment Variables Required

```env
RESEND_API_KEY="re_xxxxx"
EMAIL_FROM="noreply@locksafe.uk"
NEXT_PUBLIC_BASE_URL="https://locksafe.uk"
```

## Testing Checklist

### Client Password Reset
- [ ] Navigate to `/login`
- [ ] Click "Forgot password?"
- [ ] Enter valid customer email
- [ ] Check email inbox for reset link
- [ ] Click reset link
- [ ] Enter new password
- [ ] Verify redirect to `/login`
- [ ] Login with new password

### Locksmith Password Reset
- [ ] Navigate to `/locksmith/login`
- [ ] Click "Forgot password?"
- [ ] Verify redirect to `/forgot-password?type=locksmith`
- [ ] Enter valid locksmith email
- [ ] Check email inbox for reset link
- [ ] Click reset link
- [ ] Verify URL contains `&type=locksmith`
- [ ] Enter new password
- [ ] Verify redirect to `/locksmith/login`
- [ ] Login with new password

### Edge Cases
- [ ] Invalid email (should still return success)
- [ ] Expired token (should show error)
- [ ] Used token (should show error)
- [ ] Password too short (should show error)
- [ ] Passwords don't match (should show error)

## Files Modified

1. `prisma/schema.prisma` - Added reset fields to Locksmith model
2. `src/app/api/auth/forgot-password/route.ts` - Updated for both user types
3. `src/app/api/auth/reset-password/route.ts` - Updated for both user types
4. `src/app/forgot-password/page.tsx` - Added user type support
5. `src/app/reset-password/page.tsx` - Added user type support
6. `src/app/locksmith/login/page.tsx` - Updated forgot password link

## Notes

- The system automatically detects user type if not specified
- Email template is user-friendly and professionally branded
- All sensitive operations are logged for security auditing
- Works with existing Resend API configuration
- Compatible with existing authentication system
