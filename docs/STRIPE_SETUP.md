# LockSafe UK - Stripe Integration Guide

## Table of Contents
1. [Payment Flow Overview](#payment-flow-overview)
2. [Stripe Account Setup](#stripe-account-setup)
3. [Environment Variables](#environment-variables)
4. [Webhook Configuration](#webhook-configuration)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Testing](#testing)
8. [Go Live Checklist](#go-live-checklist)

---

## Payment Flow Overview

LockSafe uses a **two-charge payment flow** where both the assessment fee and final work payment are charged to the customer's saved card and **automatically transferred to the locksmith's connected Stripe account** with a 15% platform fee deducted.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOCKSAFE TWO-CHARGE PAYMENT FLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. CUSTOMER REQUESTS JOB
   └── Job created with status: PENDING

2. LOCKSMITH APPLIES (sets assessment fee, e.g., £35)
   └── Application stored, locksmith must have Stripe Connect verified

3. CUSTOMER ACCEPTS APPLICATION
   ├── Customer enters card details (saved for future use)
   ├── ┌────────────────────────────────────────────────────┐
   │   │ CHARGE #1: ASSESSMENT FEE (£35)                    │
   │   │ ├── Customer charged: £35.00                       │
   │   │ ├── Platform fee (15%): £5.25 → LockSafe           │
   │   │ └── Locksmith receives: £29.75 → Stripe Connect    │
   │   └────────────────────────────────────────────────────┘
   └── Job status: ACCEPTED, Card saved on file

4. LOCKSMITH ARRIVES & DIAGNOSES
   ├── GPS location captured
   ├── Job status: ARRIVED → DIAGNOSING
   └── Locksmith creates quote (e.g., £180 for work)

5. CUSTOMER ACCEPTS QUOTE
   └── Job status: QUOTE_ACCEPTED → IN_PROGRESS

6. WORK COMPLETION & CONFIRMATION
   ├── Locksmith marks work complete + uploads photos
   ├── Customer confirms satisfaction + signs digitally
   ├── ┌────────────────────────────────────────────────────┐
   │   │ CHARGE #2: FINAL PAYMENT (£180)                    │
   │   │ ├── Customer charged: £180.00 (using saved card)   │
   │   │ ├── Platform fee (15%): £27.00 → LockSafe          │
   │   │ └── Locksmith receives: £153.00 → Stripe Connect   │
   │   └────────────────────────────────────────────────────┘
   └── Job status: COMPLETED → SIGNED

TOTAL EXAMPLE:
├── Customer paid: £35 + £180 = £215
├── Platform earned: £5.25 + £27 = £32.25 (15%)
└── Locksmith earned: £29.75 + £153 = £182.75 (85%)
```

### Key Features

- **Destination Charges**: Payments go directly to locksmith with automatic platform fee
- **Card on File**: Card saved using `setup_future_usage: "off_session"`
- **Off-Session Charging**: Second charge uses saved card without customer present
- **Automatic Splits**: Stripe handles all money movement automatically

---

## Stripe Account Setup

### Step 1: Create Stripe Account
1. Go to [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Complete business verification
3. Enable **Stripe Connect** (required for locksmith payouts)

### Step 2: Get API Keys
1. Go to **Developers → API Keys**
2. Copy your keys:
   - **Publishable key**: `pk_test_...` (for frontend)
   - **Secret key**: `sk_test_...` (for backend - NEVER expose!)

### Step 3: Enable Stripe Connect
1. Go to **Settings → Connect settings**
2. Configure:
   - **Platform profile**: LockSafe UK
   - **Account types**: Express accounts (recommended)
   - **Branding**: Upload your logo
   - **Payout schedule**: Daily automatic (recommended)

### Step 4: Configure Connect Settings
1. Go to **Settings → Connect settings → Onboarding**
2. Set redirect URLs:
   ```
   Return URL: https://your-domain.com/locksmith/earnings?stripe=success
   Refresh URL: https://your-domain.com/locksmith/earnings?stripe=refresh
   ```

### Step 5: Configure Payment Methods
1. Go to **Settings → Payment Methods**
2. Enable:
   - ✅ Cards (Visa, Mastercard, Amex)
   - ✅ Apple Pay
   - ✅ Google Pay
   - ✅ Link (Stripe's fast checkout)

---

## Environment Variables

Add these to your `.env` file:

```env
# =====================================
# STRIPE CONFIGURATION
# =====================================

# API Keys (use test keys for development)
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Webhook Signing Secret
# Get from: https://dashboard.stripe.com/webhooks (after creating endpoint)
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Stripe Connect Webhook Secret (for connected account events)
# Create separate webhook or use same secret
STRIPE_CONNECT_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Platform fee percentage (15% = 0.15)
STRIPE_PLATFORM_FEE_PERCENT="0.15"

# =====================================
# APPLICATION URLs
# =====================================
NEXT_PUBLIC_BASE_URL="https://your-domain.com"

# Stripe Connect redirect URLs
STRIPE_CONNECT_RETURN_URL="${NEXT_PUBLIC_BASE_URL}/locksmith/earnings?stripe=success"
STRIPE_CONNECT_REFRESH_URL="${NEXT_PUBLIC_BASE_URL}/locksmith/earnings?stripe=refresh"
```

### Test vs Live Keys

| Environment | Secret Key Prefix | Publishable Key Prefix |
|-------------|-------------------|------------------------|
| Test        | `sk_test_`        | `pk_test_`             |
| Live        | `sk_live_`        | `pk_live_`             |

⚠️ **NEVER commit live keys to git!**

---

## Webhook Configuration

### Step 1: Create Main Webhook Endpoint

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
   ```
   https://your-domain.com/api/webhooks/stripe
   ```

### Step 2: Select Events to Listen To

Click **Select events** and choose the following:

#### Payment Events (Required)
| Event | Description | What We Do |
|-------|-------------|------------|
| `payment_intent.succeeded` | Payment completed successfully | Update job, record payment, notify locksmith |
| `payment_intent.payment_failed` | Payment failed | Update status, notify customer |
| `payment_intent.requires_action` | 3D Secure needed | Frontend handles this |

#### Setup Intent Events (Card Saving)
| Event | Description | What We Do |
|-------|-------------|------------|
| `setup_intent.succeeded` | Card saved successfully | Store payment method ID on customer |

#### Stripe Connect Events (Locksmith Payouts)
| Event | Description | What We Do |
|-------|-------------|------------|
| `account.updated` | Connect account status changed | Update locksmith verification status |
| `transfer.created` | Transfer to locksmith initiated | Log for records |
| `transfer.reversed` | Transfer reversed (refund) | Handle refund logic |
| `payout.paid` | Money sent to locksmith's bank | Send notification email |
| `payout.failed` | Payout to bank failed | Alert admin + locksmith |

#### Refund Events
| Event | Description | What We Do |
|-------|-------------|------------|
| `charge.refunded` | Payment refunded | Update payment status |

#### Platform Revenue
| Event | Description | What We Do |
|-------|-------------|------------|
| `application_fee.created` | Platform commission collected | Log for accounting |

### Step 3: For Connected Account Events

You need to also listen to events from **Connected accounts** (locksmith accounts):

1. In the same webhook endpoint, scroll down to **"Listen to events on"**
2. Select **"Connected accounts"** in addition to **"Your account"**
3. Add these additional events:
   - `payout.paid`
   - `payout.failed`
   - `account.updated`

### Step 4: Copy Webhook Secret

After creating the webhook:
1. Click on the webhook endpoint
2. Click **"Reveal"** next to **Signing secret**
3. Copy the `whsec_...` value
4. Add to your `.env` file:
   ```env
   STRIPE_WEBHOOK_SECRET="whsec_your_signing_secret_here"
   ```

### Step 5: Local Development with Stripe CLI

For local testing, use the Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# macOS:
brew install stripe/stripe-cli/stripe

# Windows (with scoop):
scoop install stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Output will show:
# > Ready! Your webhook signing secret is whsec_xxxxx
# Use this secret for local testing
```

#### Useful Stripe CLI Commands

```bash
# Trigger specific test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger setup_intent.succeeded
stripe trigger account.updated
stripe trigger payout.paid

# View recent events
stripe events list --limit 10

# View real-time logs
stripe logs tail

# Test a specific scenario
stripe trigger payment_intent.succeeded --add payment_intent:metadata[type]=assessment_fee
```

---

## API Endpoints

### Available Payment Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create-intent` | POST | Create payment intent with transfer to locksmith |
| `/api/payments/setup-card` | POST | Create SetupIntent to save card |
| `/api/payments/setup-card` | PUT | Confirm card was saved |
| `/api/payments/charge-saved-card` | POST | Charge saved card for assessment/work |
| `/api/payments/saved-cards` | GET | List customer's saved cards |
| `/api/payments/saved-cards` | DELETE | Remove a saved card |
| `/api/webhooks/stripe` | POST | Handle Stripe webhook events |
| `/api/stripe-connect` | GET | Get locksmith's Connect account status |
| `/api/stripe-connect/onboard` | POST | Start locksmith Stripe onboarding |

### Example: Create Payment Intent

```typescript
// POST /api/payments/create-intent
const response = await fetch('/api/payments/create-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'assessment_fee', // or 'work_quote'
    amount: 35.00,
    jobId: 'job_123',
    customerId: 'cust_456',
    locksmithId: 'lock_789',
    applicationId: 'app_111', // for assessment_fee
    quoteId: 'quote_222',      // for work_quote
  }),
});

const {
  clientSecret,
  paymentIntentId,
  platformFee,
  locksmithShare,
  transfersToLocksmith
} = await response.json();
```

### Example: Charge Saved Card

```typescript
// POST /api/payments/charge-saved-card
const response = await fetch('/api/payments/charge-saved-card', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'work_quote',
    amount: 180.00,
    jobId: 'job_123',
    customerId: 'cust_456',
    locksmithId: 'lock_789',
    quoteId: 'quote_222',
  }),
});

const {
  success,
  paymentIntentId,
  amount,
  platformFee,
  locksmithShare
} = await response.json();
```

---

## Frontend Components

### Available Components

| Component | Location | Description |
|-----------|----------|-------------|
| `StripePaymentForm` | `components/payments/StripePaymentForm.tsx` | Full payment form with Stripe Elements |
| `SaveCardForm` | `components/payments/SaveCardForm.tsx` | Save card for future use |
| `ChargeSavedCardButton` | `components/payments/ChargeSavedCardButton.tsx` | Charge a saved card |
| `SavedCardDisplay` | `components/payments/ChargeSavedCardButton.tsx` | Display saved card info |
| `CompletePaymentFlow` | `components/payments/CompletePaymentFlow.tsx` | Full two-charge flow demo |

### Example: Complete Payment Flow

```tsx
import { CompletePaymentFlow } from '@/components/payments/CompletePaymentFlow';

export default function PaymentPage() {
  return (
    <CompletePaymentFlow
      jobId="job_123"
      jobNumber="LRS-2026-001234"
      customerId="cust_456"
      customerEmail="customer@example.com"
      customerName="John Smith"
      locksmithId="lock_789"
      locksmithStripeAccountId="acct_xxx"
      locksmithName="Mike's Locks"
      assessmentFee={35.00}
      workQuoteTotal={180.00}
      applicationId="app_111"
      quoteId="quote_222"
      onAssessmentPaid={() => console.log('Assessment paid!')}
      onWorkQuotePaid={() => console.log('Work quote paid!')}
      onComplete={() => console.log('All payments complete!')}
    />
  );
}
```

---

## Testing

### Test Card Numbers

| Scenario | Card Number | CVC | Expiry |
|----------|-------------|-----|--------|
| ✅ Success | `4242 4242 4242 4242` | Any 3 digits | Any future date |
| ❌ Decline | `4000 0000 0000 0002` | Any 3 digits | Any future date |
| 🔐 Requires 3D Secure | `4000 0025 0000 3155` | Any 3 digits | Any future date |
| 💳 Insufficient Funds | `4000 0000 0000 9995` | Any 3 digits | Any future date |
| 🇬🇧 UK Visa Debit | `4000 0082 6000 0000` | Any 3 digits | Any future date |

### Test the Full Flow

1. **Create a job** (customer submits request)
2. **Locksmith applies** (sets £35 assessment fee)
3. **Accept application** (customer enters test card `4242 4242 4242 4242`)
4. **Verify assessment charged** (check Stripe Dashboard → Payments)
5. **Verify transfer created** (check Stripe Dashboard → Connect → Transfers)
6. **Create quote** (locksmith quotes £180)
7. **Accept quote** (customer accepts)
8. **Complete work** (locksmith marks complete)
9. **Confirm completion** (customer signs)
10. **Verify final payment** (check Stripe Dashboard)
11. **Verify locksmith received funds** (check connected account)

### Testing Connect Payouts

To test locksmith payouts:

1. Create a test locksmith account
2. Complete Stripe Connect onboarding (use test data)
3. Process a payment
4. Check **Stripe Dashboard → Connect → Accounts → [Account] → Payouts**

---

## Go Live Checklist

### Before Going Live

- [ ] Switch from test keys (`sk_test_`) to live keys (`sk_live_`)
- [ ] Update all environment variables in production
- [ ] Create production webhook endpoint with live URL
- [ ] Copy new webhook signing secret
- [ ] Complete Stripe business verification
- [ ] Verify Connect settings for production
- [ ] Test with a real £1 charge (then refund)
- [ ] Set up Radar fraud rules

### Webhook Checklist

- [ ] Webhook endpoint responding with 200 status
- [ ] All required events selected
- [ ] Connected accounts events enabled
- [ ] Webhook secret stored securely
- [ ] Verify signature validation working

### Security Checklist

- [ ] API keys stored in environment variables only
- [ ] Never log full card numbers
- [ ] HTTPS enforced everywhere
- [ ] Webhook signatures verified
- [ ] Rate limiting on payment endpoints
- [ ] PCI compliance maintained (Stripe handles card data)

### Monitoring

- [ ] Set up Stripe Dashboard email alerts
- [ ] Monitor webhook delivery success rate (aim for >99%)
- [ ] Track payment success/failure rates
- [ ] Set up alerts for disputes
- [ ] Monitor Connect account health

---

## Troubleshooting

### Common Issues

**Webhook signature verification fails**
- Ensure you're using the raw request body, not parsed JSON
- Check that the correct webhook secret is being used
- For local testing, use the secret provided by `stripe listen`

**Card saves but charges fail**
- Check that `off_session: true` is set for saved card charges
- Ensure customer has a valid `stripePaymentMethodId`
- Some cards require 3D Secure - handle `requires_action` status

**Transfers not appearing for locksmith**
- Verify locksmith has `stripeConnectVerified: true`
- Check that `transfer_data.destination` is set correctly
- Ensure locksmith account has payouts enabled

**Platform fee not collected**
- Verify `application_fee_amount` is set on payment intent
- Fee must be in smallest currency unit (pence for GBP)
- Check that locksmith account is Express or Custom type

### Support Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe API Reference**: https://stripe.com/docs/api
- **Connect Documentation**: https://stripe.com/docs/connect
- **Webhook Testing**: https://stripe.com/docs/webhooks/test
- **Stripe Support**: https://support.stripe.com
- **LockSafe Support**: support@locksafe.uk

---

## Quick Reference: Webhook Events

```
Customer Payment Flow
        │
        ▼
┌───────────────────┐
│ setup_intent      │──► Card saved to customer
│ .succeeded        │
└───────────────────┘
        │
        ▼
┌───────────────────┐     ┌──────────────────┐
│ payment_intent    │────►│ application_fee  │ Platform receives 15%
│ .succeeded        │     │ .created         │
│ (assessment_fee)  │     └──────────────────┘
└───────────────────┘
        │                 ┌──────────────────┐
        └────────────────►│ transfer.created │ Locksmith receives 85%
                          └──────────────────┘
        │
        ▼
┌───────────────────┐     ┌──────────────────┐
│ payment_intent    │────►│ application_fee  │ Platform receives 15%
│ .succeeded        │     │ .created         │
│ (work_quote)      │     └──────────────────┘
└───────────────────┘
        │                 ┌──────────────────┐
        └────────────────►│ transfer.created │ Locksmith receives 85%
                          └──────────────────┘
        │
        ▼
┌───────────────────┐
│ payout.paid       │──► Money arrives in locksmith's bank
└───────────────────┘
```
