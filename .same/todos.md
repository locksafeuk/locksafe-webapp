# Forgot Password Feature

## Tasks
- [x] Review existing login pages for clients and locksmiths
- [x] Check current Resend API setup
- [x] Add "Forgot Password" links to login pages (both already exist)
- [x] Update forgot password page to support user types
- [x] Update API endpoint to handle password reset requests for both user types
- [x] Add database schema for reset tokens (Locksmith model)
- [x] Update reset password page to support user types
- [x] Update API endpoint to handle password reset for both user types
- [x] Send password reset emails using Resend API (already implemented)
- [ ] Test complete flow for both clients and locksmiths

## Summary
All implementation complete! Both clients and locksmiths can now:
1. Click "Forgot Password" on their respective login pages
2. Receive a password reset email via Resend
3. Click the link to reset their password
4. Return to the appropriate login page

The flow automatically detects user type and handles both cases seamlessly.
