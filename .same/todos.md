# Email System Fixes

## Current Issue: Locksmith Welcome Email Missing

### EMAIL-001: No Welcome Email Sent to Locksmiths on Signup
- [ ] **Status**: In Progress
- **Issue**: When a locksmith signs up, no email is sent to them
- **Root Cause**: `/api/locksmiths/register` only sends Telegram notification, no email function called
- **Fix Required**:
  - Create `sendLocksmithWelcomeEmail` function in `src/lib/email.ts`
  - Call this function in `/api/locksmiths/register/route.ts`

## Email Use Cases Audit

### Customer Emails ✅
- [x] `sendVerificationEmail` - Email verification on signup
- [x] `sendPasswordResetEmail` - Password reset
- [x] `sendJobConfirmationEmail` - Job booking confirmed
- [x] `sendCustomerPaymentLinkEmail` - Payment link
- [x] `sendQuoteReceivedEmail` - Quote from locksmith
- [x] `sendLocksmithApplicationNotification` - Locksmith applied
- [x] `sendJobCompletionEmail` - Job completed
- [x] `sendWorkCompletionConfirmationEmail` - Sign to confirm
- [x] `sendPaymentReceiptEmail` - Payment receipt
- [x] `sendLocksmithArrivedEmail` - Locksmith arrived
- [x] `sendSignatureReminderEmail` - Reminder to sign
- [x] `sendAutoCompletionEmail` - Auto-completion notice
- [x] `sendPhoneRequestContinuationEmail` - Continue phone request
- [x] `sendCustomerOnboardingEmail` - Admin-created job onboarding
- [x] `sendOnboardingCompleteEmail` - Onboarding complete

### Locksmith Emails
- [ ] `sendLocksmithWelcomeEmail` - **MISSING** - Welcome on signup
- [x] `sendLocksmithAssignmentEmail` - Job assigned by admin
- [x] `sendLocksmithBookedEmail` - Booked by customer
- [x] `sendAutoDispatchEmail` - Auto-dispatch notification
- [x] `sendNewJobInAreaEmail` - New job nearby
- [x] `sendQuoteAcceptedEmail` - Quote accepted
- [x] `sendQuoteDeclinedEmail` - Quote declined
- [x] `sendTransferNotificationEmail` - Payment received
- [x] `sendLocksmithJobCompletionEmail` - Job completion summary
- [x] `sendPayoutNotificationEmail` - Payout sent
- [x] `sendPayoutFailedEmail` - Payout failed
- [x] `sendNewReviewEmail` - New review received
- [x] `sendAccountVerifiedEmail` - Stripe verified
- [x] `sendLocksmithVerifiedEmail` - Admin verified account
- [x] `sendInsuranceExpiryReminderEmail` - Insurance expiring
- [x] `sendEarningsReversalEmail` - Earnings reversed

## Progress
- [ ] Create `sendLocksmithWelcomeEmail` in email.ts
- [ ] Add email call to locksmith registration
- [ ] Test the flow
