import Stripe from "stripe";

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

// Platform fee percentages
// Assessment fee: 15% commission (locksmith keeps 85%)
// Work quote: 25% commission (locksmith keeps 75%)
export const ASSESSMENT_FEE_COMMISSION = 0.15;
export const WORK_QUOTE_COMMISSION = 0.25;

// Legacy constant for backward compatibility - defaults to assessment fee rate
export const PLATFORM_FEE_PERCENT = ASSESSMENT_FEE_COMMISSION;

// Helper to format amount for Stripe (pence)
export function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100);
}

// Helper to format amount from Stripe (pounds)
export function formatAmountFromStripe(amount: number): number {
  return amount / 100;
}

// Get commission rate based on payment type
export function getCommissionRate(paymentType: "assessment_fee" | "work_quote"): number {
  return paymentType === "assessment_fee" ? ASSESSMENT_FEE_COMMISSION : WORK_QUOTE_COMMISSION;
}

// Calculate platform fee based on payment type
export function calculatePlatformFee(
  amount: number,
  paymentType: "assessment_fee" | "work_quote" = "assessment_fee"
): number {
  const commissionRate = getCommissionRate(paymentType);
  return Math.round(formatAmountForStripe(amount) * commissionRate);
}

// Calculate locksmith share after commission
export function calculateLocksmithShare(
  amount: number,
  paymentType: "assessment_fee" | "work_quote" = "assessment_fee"
): number {
  const commissionRate = getCommissionRate(paymentType);
  return amount * (1 - commissionRate);
}

// ===========================
// STRIPE CUSTOMER FUNCTIONS
// ===========================

// Create or retrieve a Stripe customer
export async function getOrCreateStripeCustomer(
  email: string | null,
  name: string,
  phone?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  // If email provided, try to find existing customer
  if (email) {
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: email || undefined,
    name,
    phone: phone || undefined,
    metadata: {
      platform: "locksafe",
      ...metadata,
    },
  });

  return customer;
}

// Get Stripe customer by ID
export async function getStripeCustomer(customerId: string): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return customer as Stripe.Customer;
  } catch {
    return null;
  }
}

// Update customer's default payment method
export async function updateCustomerDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  return stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

// ===========================
// SETUP INTENT (SAVE CARD)
// ===========================

// Create a SetupIntent to save a card for future use
export async function createSetupIntent(
  stripeCustomerId: string,
  metadata?: Record<string, string>
): Promise<Stripe.SetupIntent> {
  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    usage: "off_session", // Allow charging the card when customer is not present
    metadata: {
      platform: "locksafe",
      ...metadata,
    },
  });

  return setupIntent;
}

// Retrieve SetupIntent
export async function getSetupIntent(setupIntentId: string): Promise<Stripe.SetupIntent> {
  return stripe.setupIntents.retrieve(setupIntentId);
}

// List customer's saved payment methods
export async function listPaymentMethods(
  stripeCustomerId: string
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
  });

  return paymentMethods.data;
}

// Detach a payment method from customer
export async function detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.detach(paymentMethodId);
}

// ===========================
// CHARGE SAVED CARD FUNCTIONS
// ===========================

// Charge a saved card for assessment fee with transfer to locksmith
export async function chargeAssessmentFee(
  amount: number,
  stripeCustomerId: string,
  paymentMethodId: string,
  locksmithStripeAccountId: string,
  metadata: {
    jobId: string;
    customerId: string;
    locksmithId: string;
    applicationId?: string;
  }
): Promise<Stripe.PaymentIntent> {
  const amountInPence = formatAmountForStripe(amount);
  const platformFee = Math.round(amountInPence * PLATFORM_FEE_PERCENT);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInPence,
    currency: "gbp",
    customer: stripeCustomerId,
    payment_method: paymentMethodId,
    off_session: true, // Charge when customer is not present
    confirm: true, // Immediately confirm and charge
    transfer_data: {
      destination: locksmithStripeAccountId,
    },
    application_fee_amount: platformFee,
    metadata: {
      type: "assessment_fee",
      platformFee: platformFee.toString(),
      locksmithShare: (amountInPence - platformFee).toString(),
      ...metadata,
    },
    description: `LockSafe Assessment Fee - Job ${metadata.jobId}`,
  });

  return paymentIntent;
}

// Charge a saved card for final work payment with transfer to locksmith
export async function chargeFinalPayment(
  amount: number,
  stripeCustomerId: string,
  paymentMethodId: string,
  locksmithStripeAccountId: string,
  metadata: {
    jobId: string;
    customerId: string;
    locksmithId: string;
    quoteId?: string;
  }
): Promise<Stripe.PaymentIntent> {
  const amountInPence = formatAmountForStripe(amount);
  // Work quote uses 25% commission
  const platformFee = Math.round(amountInPence * WORK_QUOTE_COMMISSION);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInPence,
    currency: "gbp",
    customer: stripeCustomerId,
    payment_method: paymentMethodId,
    off_session: true, // Charge when customer is not present
    confirm: true, // Immediately confirm and charge
    transfer_data: {
      destination: locksmithStripeAccountId,
    },
    application_fee_amount: platformFee,
    metadata: {
      type: "work_quote",
      platformFee: platformFee.toString(),
      locksmithShare: (amountInPence - platformFee).toString(),
      ...metadata,
    },
    description: `LockSafe Work Payment - Job ${metadata.jobId}`,
  });

  return paymentIntent;
}

// Generic function to charge saved card with destination charge
export async function chargeSavedCard(
  amount: number,
  stripeCustomerId: string,
  paymentMethodId: string,
  locksmithStripeAccountId: string | null,
  paymentType: "assessment_fee" | "work_quote",
  metadata: {
    jobId: string;
    customerId: string;
    locksmithId: string;
    applicationId?: string;
    quoteId?: string;
  }
): Promise<Stripe.PaymentIntent> {
  const amountInPence = formatAmountForStripe(amount);
  // Use appropriate commission rate based on payment type
  const commissionRate = getCommissionRate(paymentType);
  const platformFee = locksmithStripeAccountId
    ? Math.round(amountInPence * commissionRate)
    : 0;

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: amountInPence,
    currency: "gbp",
    customer: stripeCustomerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    metadata: {
      type: paymentType,
      platformFee: platformFee.toString(),
      locksmithShare: (amountInPence - platformFee).toString(),
      ...metadata,
    },
    description: `LockSafe ${paymentType === "assessment_fee" ? "Assessment Fee" : "Work Payment"} - Job ${metadata.jobId}`,
  };

  // Add transfer to locksmith if they have Stripe Connect
  if (locksmithStripeAccountId) {
    paymentIntentParams.transfer_data = {
      destination: locksmithStripeAccountId,
    };
    paymentIntentParams.application_fee_amount = platformFee;
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
  return paymentIntent;
}

// Create a payment intent for manual card entry (requires customer confirmation)
export async function createPaymentIntentWithTransfer(
  amount: number,
  locksmithStripeAccountId: string | null,
  paymentType: "assessment_fee" | "work_quote",
  metadata: {
    jobId: string;
    customerId?: string;
    locksmithId: string;
    applicationId?: string;
    quoteId?: string;
  },
  stripeCustomerId?: string
): Promise<Stripe.PaymentIntent> {
  const amountInPence = formatAmountForStripe(amount);
  // Use appropriate commission rate based on payment type
  const commissionRate = getCommissionRate(paymentType);
  const platformFee = locksmithStripeAccountId
    ? Math.round(amountInPence * commissionRate)
    : 0;

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: amountInPence,
    currency: "gbp",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      type: paymentType,
      platformFee: platformFee.toString(),
      locksmithShare: (amountInPence - platformFee).toString(),
      ...metadata,
    },
    setup_future_usage: "off_session", // Save the card for future use
  };

  // Attach to customer if provided
  if (stripeCustomerId) {
    paymentIntentParams.customer = stripeCustomerId;
  }

  // Add transfer to locksmith if they have Stripe Connect
  if (locksmithStripeAccountId) {
    paymentIntentParams.transfer_data = {
      destination: locksmithStripeAccountId,
    };
    paymentIntentParams.application_fee_amount = platformFee;
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
  return paymentIntent;
}

// Create a payment intent for assessment fee (LEGACY - kept for backward compatibility)
export async function createAssessmentFeePaymentIntent(
  amount: number,
  metadata: {
    jobId: string;
    customerId: string;
    locksmithId: string;
    applicationId: string;
  },
  locksmithStripeAccountId?: string | null
) {
  const amountInPence = formatAmountForStripe(amount);
  const platformFee = locksmithStripeAccountId
    ? Math.round(amountInPence * PLATFORM_FEE_PERCENT)
    : 0;

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: amountInPence,
    currency: "gbp",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      type: "assessment_fee",
      platformFee: platformFee.toString(),
      locksmithShare: (amountInPence - platformFee).toString(),
      ...metadata,
    },
    setup_future_usage: "off_session", // Save card for future charges
  };

  // Add transfer to locksmith if they have Stripe Connect
  if (locksmithStripeAccountId) {
    paymentIntentParams.transfer_data = {
      destination: locksmithStripeAccountId,
    };
    paymentIntentParams.application_fee_amount = platformFee;
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
  return paymentIntent;
}

// Create a payment intent for work quote with application fee for platform
export async function createWorkQuotePaymentIntent(
  amount: number,
  locksmithStripeAccountId: string | null,
  metadata: {
    jobId: string;
    customerId: string;
    locksmithId: string;
    quoteId: string;
  }
) {
  const amountInPence = formatAmountForStripe(amount);
  // Work quote uses 25% commission
  const platformFee = locksmithStripeAccountId
    ? Math.round(amountInPence * WORK_QUOTE_COMMISSION)
    : 0;

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: amountInPence,
    currency: "gbp",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      type: "work_quote",
      platformFee: platformFee.toString(),
      locksmithShare: (amountInPence - platformFee).toString(),
      ...metadata,
    },
  };

  // If locksmith has Stripe Connect, use destination charges
  if (locksmithStripeAccountId) {
    paymentIntentParams.transfer_data = {
      destination: locksmithStripeAccountId,
    };
    paymentIntentParams.application_fee_amount = platformFee;
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
  return paymentIntent;
}

// Retrieve payment intent
export async function getPaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

// ===========================
// STRIPE CONNECT FUNCTIONS
// ===========================

// Create a Stripe Connect account for locksmiths
export async function createConnectAccount(
  email: string,
  locksmithId: string,
  businessProfile?: {
    name?: string;
    phone?: string;
    url?: string;
  }
) {
  const account = await stripe.accounts.create({
    type: "express",
    country: "GB",
    email,
    business_type: "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      mcc: "7251", // Repair Shops and Related Services
      name: businessProfile?.name || undefined,
      support_phone: businessProfile?.phone || undefined,
      url: businessProfile?.url || undefined,
    },
    metadata: {
      locksmithId,
      platform: "locksafe",
    },
  });

  return account;
}

// Create account link for onboarding
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return accountLink;
}

// Create login link for existing connected accounts
export async function createLoginLink(accountId: string) {
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink;
}

// Get account status and capabilities
export async function getConnectAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);

  return {
    id: account.id,
    email: account.email,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
    capabilities: account.capabilities,
    defaultCurrency: account.default_currency,
    externalAccounts: account.external_accounts?.data || [],
  };
}

// Create a transfer to locksmith
export async function createTransfer(
  amount: number,
  destinationAccountId: string,
  metadata: {
    jobId: string;
    type: "assessment_fee" | "work_payment";
    description?: string;
  }
) {
  const transfer = await stripe.transfers.create({
    amount: formatAmountForStripe(amount),
    currency: "gbp",
    destination: destinationAccountId,
    metadata,
    description: metadata.description || `LockSafe - ${metadata.type} for job ${metadata.jobId}`,
  });

  return transfer;
}

// Create a payout to locksmith's bank account
export async function createPayout(
  amount: number,
  stripeAccountId: string,
  metadata?: Record<string, string>
) {
  const payout = await stripe.payouts.create(
    {
      amount: formatAmountForStripe(amount),
      currency: "gbp",
      metadata,
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  return payout;
}

// Get account balance
export async function getAccountBalance(stripeAccountId: string) {
  const balance = await stripe.balance.retrieve({
    stripeAccount: stripeAccountId,
  });

  return {
    available: balance.available.map((b) => ({
      amount: formatAmountFromStripe(b.amount),
      currency: b.currency,
    })),
    pending: balance.pending.map((b) => ({
      amount: formatAmountFromStripe(b.amount),
      currency: b.currency,
    })),
  };
}

// List transfers to a connected account
export async function listTransfers(
  stripeAccountId: string,
  limit = 10
) {
  const transfers = await stripe.transfers.list({
    destination: stripeAccountId,
    limit,
  });

  return transfers.data.map((t) => ({
    id: t.id,
    amount: formatAmountFromStripe(t.amount),
    currency: t.currency,
    created: new Date(t.created * 1000),
    description: t.description,
    metadata: t.metadata,
  }));
}

// List payouts for a connected account
export async function listPayouts(stripeAccountId: string, limit = 10) {
  const payouts = await stripe.payouts.list(
    { limit },
    { stripeAccount: stripeAccountId }
  );

  return payouts.data.map((p) => ({
    id: p.id,
    amount: formatAmountFromStripe(p.amount),
    currency: p.currency,
    status: p.status,
    arrivalDate: new Date(p.arrival_date * 1000),
    created: new Date(p.created * 1000),
    method: p.method,
    type: p.type,
  }));
}

// Update payout schedule for connected account
export async function updatePayoutSchedule(
  stripeAccountId: string,
  schedule: {
    interval: "daily" | "weekly" | "monthly";
    weeklyAnchor?: "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
    monthlyAnchor?: number; // 1-31
  }
) {
  const params: Stripe.AccountUpdateParams = {
    settings: {
      payouts: {
        schedule: {
          interval: schedule.interval,
        },
      },
    },
  };

  if (schedule.interval === "weekly" && schedule.weeklyAnchor) {
    params.settings!.payouts!.schedule!.weekly_anchor = schedule.weeklyAnchor;
  }
  if (schedule.interval === "monthly" && schedule.monthlyAnchor) {
    params.settings!.payouts!.schedule!.monthly_anchor = schedule.monthlyAnchor;
  }

  const account = await stripe.accounts.update(stripeAccountId, params);
  return account;
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
) {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// Get all earnings for a locksmith
export async function getLocksmithEarnings(
  stripeAccountId: string,
  startDate?: Date,
  endDate?: Date
) {
  const created: Stripe.RangeQueryParam = {};
  if (startDate) created.gte = Math.floor(startDate.getTime() / 1000);
  if (endDate) created.lte = Math.floor(endDate.getTime() / 1000);

  const transfers = await stripe.transfers.list({
    destination: stripeAccountId,
    limit: 100,
    created: Object.keys(created).length > 0 ? created : undefined,
  });

  const total = transfers.data.reduce((sum, t) => sum + t.amount, 0);

  return {
    totalEarnings: formatAmountFromStripe(total),
    transferCount: transfers.data.length,
    transfers: transfers.data.map((t) => ({
      id: t.id,
      amount: formatAmountFromStripe(t.amount),
      created: new Date(t.created * 1000),
      metadata: t.metadata,
    })),
  };
}

// ===========================
// REFUNDS
// ===========================

/**
 * Create a refund for a payment with proper handling of connected account transfers
 *
 * For destination charges (payments with transfer_data.destination):
 * - reverse_transfer: true - recovers funds from the connected account (locksmith)
 * - refund_application_fee: true - recovers the platform fee
 *
 * This ensures the locksmith is also debited their share when a refund is processed.
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number, // If not provided, full refund
  reason?: "duplicate" | "fraudulent" | "requested_by_customer",
  options?: {
    reverseTransfer?: boolean; // Default true - reverse the transfer to connected account
    refundApplicationFee?: boolean; // Default true - recover the platform fee
    isNoShowRefund?: boolean; // If true, platform keeps fee and locksmith pays full amount
  }
): Promise<Stripe.Refund> {
  const {
    reverseTransfer = true,
    refundApplicationFee = true,
    isNoShowRefund = false,
  } = options || {};

  // For no-show refunds, we DON'T refund the application fee
  // This means the platform keeps its commission
  // The locksmith's transfer is reversed, and they owe the additional amount
  const shouldRefundApplicationFee = isNoShowRefund ? false : refundApplicationFee;

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
    reason,
    // IMPORTANT: These ensure the connected account (locksmith) is debited
    reverse_transfer: reverseTransfer,
    refund_application_fee: shouldRefundApplicationFee,
  };

  if (amount) {
    refundParams.amount = formatAmountForStripe(amount);
  }

  console.log(`[Stripe] Creating refund for ${paymentIntentId} with reverse_transfer=${reverseTransfer}, refund_application_fee=${shouldRefundApplicationFee}, isNoShowRefund=${isNoShowRefund}`);

  const refund = await stripe.refunds.create(refundParams);

  console.log(`[Stripe] Refund ${refund.id} created. Status: ${refund.status}`);

  return refund;
}

/**
 * Create a no-show refund specifically for locksmith no-shows
 *
 * This function:
 * 1. Refunds the customer in full
 * 2. Reverses the transfer to the locksmith (their 85% share)
 * 3. KEEPS the platform's application fee (platform doesn't lose commission)
 * 4. Returns info about the penalty amount the locksmith owes
 *
 * The locksmith ends up paying:
 * - Their share is reversed (e.g., £34 on a £40 fee)
 * - They owe an additional penalty equal to the platform fee (e.g., £6)
 * - Total locksmith liability: Full refund amount (e.g., £40)
 */
export async function createNoShowRefund(
  paymentIntentId: string,
  reason?: "duplicate" | "fraudulent" | "requested_by_customer"
): Promise<{
  refund: Stripe.Refund;
  totalRefunded: number;
  transferReversed: number;
  platformFeeKept: number;
  locksmithPenalty: number;
  locksmithTotalLiability: number;
}> {
  // First, get the payment intent to understand the amounts
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const charge = paymentIntent.latest_charge as Stripe.Charge;
  const totalAmount = formatAmountFromStripe(paymentIntent.amount);

  // Get the application fee amount
  let applicationFeeAmount = 0;
  if (charge && charge.application_fee_amount) {
    applicationFeeAmount = formatAmountFromStripe(charge.application_fee_amount);
  } else {
    // Fallback: calculate based on metadata or default rate
    const paymentType = paymentIntent.metadata?.type as "assessment_fee" | "work_quote" | undefined;
    const commissionRate = paymentType ? getCommissionRate(paymentType) : ASSESSMENT_FEE_COMMISSION;
    applicationFeeAmount = totalAmount * commissionRate;
  }

  // Calculate locksmith's share (what was transferred to them)
  const transferAmount = totalAmount - applicationFeeAmount;

  console.log(`[Stripe] Creating no-show refund for ${paymentIntentId}:`);
  console.log(`  - Total amount: £${totalAmount}`);
  console.log(`  - Platform fee (kept): £${applicationFeeAmount}`);
  console.log(`  - Transfer to reverse: £${transferAmount}`);

  // Create the refund with:
  // - reverse_transfer: true (get back locksmith's share)
  // - refund_application_fee: false (platform keeps its commission)
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    reason,
    reverse_transfer: true,
    refund_application_fee: false, // Platform keeps its fee!
  });

  console.log(`[Stripe] No-show refund ${refund.id} created. Status: ${refund.status}`);

  // Calculate the penalty
  // The locksmith's transfer was reversed (e.g., £34)
  // But they owe the FULL refund amount (e.g., £40)
  // So the penalty is the platform fee (e.g., £6)
  const locksmithPenalty = applicationFeeAmount;
  const locksmithTotalLiability = totalAmount; // They're responsible for the full refund

  return {
    refund,
    totalRefunded: totalAmount,
    transferReversed: transferAmount,
    platformFeeKept: applicationFeeAmount,
    locksmithPenalty,
    locksmithTotalLiability,
  };
}

/**
 * NOTE: Stripe does not support direct debits from connected accounts to the platform.
 * For no-show penalties where the locksmith owes more than what was transferred:
 * 1. The reverse_transfer handles the amount that was transferred to them
 * 2. The additional penalty (platform fee portion) is tracked in the database
 * 3. The penalty is deducted from the locksmith's totalEarnings field
 * 4. For actual fund recovery, this would need to be handled through:
 *    - Future payout deductions
 *    - Manual invoicing
 *    - Or the locksmith's negative Stripe balance (if they have one)
 */

/**
 * Get the transfer associated with a payment intent
 * Used to find out how much was sent to the connected account
 */
export async function getTransferForPayment(paymentIntentId: string): Promise<Stripe.Transfer | null> {
  try {
    // Get the payment intent to find the charge
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });

    const charge = paymentIntent.latest_charge as Stripe.Charge;
    if (!charge || !charge.transfer) {
      return null;
    }

    // Retrieve the full transfer object
    const transferId = typeof charge.transfer === "string" ? charge.transfer : charge.transfer.id;
    const transfer = await stripe.transfers.retrieve(transferId);

    return transfer;
  } catch (error) {
    console.error("[Stripe] Error getting transfer for payment:", error);
    return null;
  }
}

/**
 * Reverse a transfer to a connected account
 * This is called automatically when reverse_transfer is true in createRefund,
 * but can also be called manually if needed
 */
export async function reverseTransfer(
  transferId: string,
  amount?: number, // If not provided, full reversal
  metadata?: Record<string, string>
): Promise<Stripe.TransferReversal> {
  const reversalParams: { amount?: number; metadata?: Record<string, string> } = {};

  if (metadata) {
    reversalParams.metadata = metadata;
  }

  if (amount) {
    reversalParams.amount = formatAmountForStripe(amount);
  }

  console.log(`[Stripe] Reversing transfer ${transferId}${amount ? ` for £${amount}` : " (full amount)"}`);

  const reversal = await stripe.transfers.createReversal(transferId, reversalParams);

  console.log(`[Stripe] Transfer reversal ${reversal.id} created. Amount: £${formatAmountFromStripe(reversal.amount)}`);

  return reversal;
}

/**
 * Get payment intent details including fee breakdown
 */
export async function getPaymentIntentWithFees(paymentIntentId: string): Promise<{
  paymentIntent: Stripe.PaymentIntent;
  totalAmount: number;
  applicationFee: number;
  transferAmount: number;
  paymentType: string | null;
}> {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const charge = paymentIntent.latest_charge as Stripe.Charge;
  const totalAmount = formatAmountFromStripe(paymentIntent.amount);

  let applicationFee = 0;
  if (charge && charge.application_fee_amount) {
    applicationFee = formatAmountFromStripe(charge.application_fee_amount);
  }

  const transferAmount = totalAmount - applicationFee;
  const paymentType = paymentIntent.metadata?.type || null;

  return {
    paymentIntent,
    totalAmount,
    applicationFee,
    transferAmount,
    paymentType,
  };
}
