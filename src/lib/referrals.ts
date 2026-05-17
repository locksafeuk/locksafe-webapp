/**
 * LockSafe Referral System
 *
 * Two-sided referral: referrer gets £10 credit after referred user completes their first job.
 * Referred user gets £10 off their first assessment fee at booking.
 *
 * Locksmith referrals: referrer gets £25 credit after referred locksmith completes 3 jobs.
 */

import prisma from "@/lib/db";

const CUSTOMER_REFERRER_REWARD = 10.0; // £10 credit to referrer
const CUSTOMER_REFERRED_DISCOUNT = 10.0; // £10 off referred user's first job
const LOCKSMITH_REFERRER_REWARD = 25.0; // £25 credit to locksmith referrer
const LOCKSMITH_TRIGGER_JOBS = 3; // Referred locksmith must complete N jobs to unlock reward

/**
 * Generate a unique referral code from a name.
 * Format: FIRSTNAME-XXXX (uppercase, 4 random alphanum chars)
 */
export function buildReferralCode(name: string): string {
  const firstName = name
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${firstName}-${suffix}`;
}

/**
 * Get or create a referral code for a customer.
 * Idempotent — calling twice returns the same code.
 */
export async function getOrCreateCustomerReferralCode(customerId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, referralCode: true },
  });

  if (!customer) throw new Error("Customer not found");
  if (customer.referralCode) return customer.referralCode;

  // Generate a unique code (retry on collision)
  let code = buildReferralCode(customer.name);
  for (let attempt = 0; attempt < 10; attempt++) {
    const existing = await prisma.customer.findFirst({ where: { referralCode: code } });
    if (!existing) break;
    code = buildReferralCode(customer.name);
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { referralCode: code },
  });

  // Ensure a Referral row exists for tracking clicks
  await prisma.referral.upsert({
    where: { code },
    create: {
      referrerId: customerId,
      referrerType: "customer",
      referrerName: customer.name,
      code,
      referrerReward: CUSTOMER_REFERRER_REWARD,
      referredReward: CUSTOMER_REFERRED_DISCOUNT,
    },
    update: {},
  });

  return code;
}

/**
 * Get or create a referral code for a locksmith.
 */
export async function getOrCreateLocksmithReferralCode(locksmithId: string): Promise<string> {
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: { id: true, name: true, referralCode: true },
  });

  if (!locksmith) throw new Error("Locksmith not found");
  if (locksmith.referralCode) return locksmith.referralCode;

  let code = buildReferralCode(locksmith.name);
  for (let attempt = 0; attempt < 10; attempt++) {
    const existing = await prisma.locksmith.findFirst({ where: { referralCode: code } });
    if (!existing) break;
    code = buildReferralCode(locksmith.name);
  }

  await prisma.locksmith.update({
    where: { id: locksmithId },
    data: { referralCode: code },
  });

  await prisma.referral.upsert({
    where: { code },
    create: {
      referrerId: locksmithId,
      referrerType: "locksmith",
      referrerName: locksmith.name,
      code,
      referrerReward: LOCKSMITH_REFERRER_REWARD,
      referredReward: 0,
    },
    update: {},
  });

  return code;
}

export interface ReferralValidation {
  valid: boolean;
  discount: number; // £ amount off first job
  referrerName: string;
  code: string;
  error?: string;
}

/**
 * Validate a referral code (called during registration / checkout preview).
 * Also increments the click counter.
 */
export async function validateReferralCode(code: string): Promise<ReferralValidation> {
  const normalised = code.trim().toUpperCase();

  const referral = await prisma.referral.findUnique({
    where: { code: normalised },
    select: {
      code: true,
      status: true,
      referrerName: true,
      referredReward: true,
    },
  });

  if (!referral) {
    return { valid: false, discount: 0, referrerName: "", code: normalised, error: "Invalid referral code" };
  }

  if (referral.status !== "active") {
    return { valid: false, discount: 0, referrerName: "", code: normalised, error: "This referral code has already been used" };
  }

  // Increment click count
  await prisma.referral.update({
    where: { code: normalised },
    data: { clickCount: { increment: 1 } },
  });

  return {
    valid: true,
    discount: referral.referredReward,
    referrerName: referral.referrerName,
    code: normalised,
  };
}

/**
 * Record that a new customer signed up via a referral code.
 * Called during customer registration.
 * Does NOT apply the reward yet — that happens on first completed job.
 */
export async function applyReferralOnRegistration(
  referralCode: string,
  newCustomerId: string,
  newCustomerName: string,
  newCustomerEmail: string,
): Promise<void> {
  const normalised = referralCode.trim().toUpperCase();

  const referral = await prisma.referral.findUnique({
    where: { code: normalised },
    select: { id: true, status: true, referrerType: true },
  });

  if (!referral || referral.status !== "active") return;

  // Mark referral as converted and record who was referred
  await prisma.referral.update({
    where: { code: normalised },
    data: {
      referredId: newCustomerId,
      referredType: "customer",
      referredName: newCustomerName,
      referredEmail: newCustomerEmail,
      status: "converted",
      convertedAt: new Date(),
    },
  });

  // Store the code on the customer for quick lookup
  await prisma.customer.update({
    where: { id: newCustomerId },
    data: { referredByCode: normalised },
  });
}

export interface CreditApplyResult {
  creditApplied: number; // £ actually deducted
  finalAmount: number; // final charge amount
}

/**
 * Apply a customer's referral credits to a payment.
 * Deducts up to the available credit from the amount.
 * Call this BEFORE charging Stripe.
 */
export async function applyReferralCredit(
  customerId: string,
  requestedAmount: number,
): Promise<CreditApplyResult> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { referralCredits: true },
  });

  const available = customer?.referralCredits ?? 0;
  if (available <= 0) {
    return { creditApplied: 0, finalAmount: requestedAmount };
  }

  const creditApplied = Math.min(available, requestedAmount);
  const finalAmount = Math.max(0, requestedAmount - creditApplied);

  // Deduct the credit immediately (optimistic — refund if payment fails)
  await prisma.customer.update({
    where: { id: customerId },
    data: { referralCredits: { decrement: creditApplied } },
  });

  return { creditApplied, finalAmount };
}

/**
 * Revert a credit deduction (call if the payment fails after applyReferralCredit).
 */
export async function revertReferralCredit(customerId: string, amount: number): Promise<void> {
  await prisma.customer.update({
    where: { id: customerId },
    data: { referralCredits: { increment: amount } },
  });
}

/**
 * Called when a referred customer's first job is COMPLETED/SIGNED.
 * - Gives the referrer their £10 reward credit
 * - Marks the Referral as rewarded
 */
export async function triggerReferralReward(customerId: string, jobId: string): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { referredByCode: true },
  });

  if (!customer?.referredByCode) return;

  const referral = await prisma.referral.findUnique({
    where: { code: customer.referredByCode },
    select: {
      id: true,
      status: true,
      referrerId: true,
      referrerType: true,
      referrerReward: true,
    },
  });

  // Only pay out once (converted → rewarded transition)
  if (!referral || referral.status !== "converted") return;

  // Credit the referrer
  if (referral.referrerType === "customer") {
    await prisma.customer.update({
      where: { id: referral.referrerId },
      data: { referralCredits: { increment: referral.referrerReward } },
    });
  }
  // Locksmith referrer reward is handled in triggerLocksmithReferralReward

  await prisma.referral.update({
    where: { code: customer.referredByCode },
    data: {
      status: "rewarded",
      rewardedAt: new Date(),
      triggerJobId: jobId,
    },
  });
}

/**
 * Called when a referred locksmith completes a job.
 * If they've now hit LOCKSMITH_TRIGGER_JOBS completed jobs, pay the referrer.
 */
export async function triggerLocksmithReferralReward(locksmithId: string): Promise<void> {
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: { referredByCode: true, totalJobs: true },
  });

  if (!locksmith?.referredByCode) return;
  if ((locksmith.totalJobs ?? 0) < LOCKSMITH_TRIGGER_JOBS) return;

  const referral = await prisma.referral.findUnique({
    where: { code: locksmith.referredByCode },
    select: {
      id: true,
      status: true,
      referrerId: true,
      referrerType: true,
      referrerReward: true,
    },
  });

  if (!referral || referral.status !== "converted") return;

  if (referral.referrerType === "locksmith") {
    // Add to locksmith's earnings (as a credit off platform commission on next payout)
    await prisma.locksmith.update({
      where: { id: referral.referrerId },
      data: { totalEarnings: { increment: referral.referrerReward } },
    });
  } else if (referral.referrerType === "customer") {
    await prisma.customer.update({
      where: { id: referral.referrerId },
      data: { referralCredits: { increment: referral.referrerReward } },
    });
  }

  await prisma.referral.update({
    where: { code: locksmith.referredByCode },
    data: { status: "rewarded", rewardedAt: new Date() },
  });
}

/**
 * Get referral stats for a customer.
 */
export async function getCustomerReferralStats(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { referralCode: true, referralCredits: true, name: true },
  });

  const code = customer?.referralCode
    ? customer.referralCode
    : await getOrCreateCustomerReferralCode(customerId);

  const referral = await prisma.referral.findUnique({
    where: { code },
    select: { clickCount: true, status: true, referrerReward: true, referredReward: true },
  });

  const totalEarned = await prisma.referral.aggregate({
    where: { referrerId: customerId, referrerType: "customer", status: "rewarded" },
    _sum: { referrerReward: true },
    _count: { id: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.locksafe.uk";

  return {
    code,
    shareUrl: `${baseUrl}/ref/${code}`,
    availableCredits: customer?.referralCredits ?? 0,
    clicks: referral?.clickCount ?? 0,
    totalReferrals: totalEarned._count.id,
    totalEarned: totalEarned._sum.referrerReward ?? 0,
    referrerReward: CUSTOMER_REFERRER_REWARD,
    referredDiscount: CUSTOMER_REFERRED_DISCOUNT,
  };
}
