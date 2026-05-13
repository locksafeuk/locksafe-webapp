/**
 * LockSafe Cover — Subscription Management
 *
 * Handles:
 * - Creating a Stripe Checkout session for the subscription
 * - Activating/updating subscriptions from Stripe webhooks
 * - Applying the assessment fee discount to jobs for subscribers
 * - Tracking free callouts
 */

import prisma from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendAdminAlert } from "@/lib/telegram";
import type Stripe from "stripe";

export const COVER_MONTHLY_PRICE_ID = process.env.STRIPE_COVER_MONTHLY_PRICE_ID ?? "";
export const COVER_ANNUAL_PRICE_ID = process.env.STRIPE_COVER_ANNUAL_PRICE_ID ?? "";

// Assessment fee multiplier for subscribers (50% off)
export const SUBSCRIBER_DISCOUNT_MULTIPLIER = 0.5;
// Free callouts per billing period
export const FREE_CALLOUTS_PER_PERIOD = 1;

/**
 * Create a Stripe Checkout session for LockSafe Cover subscription.
 * Returns the Checkout URL to redirect the customer to.
 */
export async function createSubscriptionCheckout(
  customerId: string,
  plan: "cover_monthly" | "cover_annual",
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { stripeCustomerId: true, name: true, email: true },
  });

  if (!customer) throw new Error("Customer not found");

  const priceId = plan === "cover_annual" ? COVER_ANNUAL_PRICE_ID : COVER_MONTHLY_PRICE_ID;
  if (!priceId) throw new Error(`Stripe price ID not configured for plan: ${plan}`);

  let stripeCustomerId = customer.stripeCustomerId;
  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      name: customer.name,
      email: customer.email ?? undefined,
      metadata: { lockSafeCustomerId: customerId },
    });
    stripeCustomerId = stripeCustomer.id;
    await prisma.customer.update({
      where: { id: customerId },
      data: { stripeCustomerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { lockSafeCustomerId: customerId, plan },
    subscription_data: {
      trial_period_days: 7,
      metadata: { lockSafeCustomerId: customerId, plan },
    },
  });

  return session.url!;
}

/**
 * Handle Stripe webhook: customer.subscription.created / updated
 */
export async function handleSubscriptionUpsert(stripeSubscription: Stripe.Subscription) {
  const customerId = stripeSubscription.metadata?.lockSafeCustomerId;
  if (!customerId) return;

  const priceId = stripeSubscription.items.data[0]?.price.id;
  const plan = priceId === COVER_ANNUAL_PRICE_ID ? "cover_annual" : "cover_monthly";

  // In Stripe v20, period is derived from billing_cycle_anchor and cancel_at
  const anchorTs = (stripeSubscription.billing_cycle_anchor as number) * 1000;
  const periodStart = new Date(anchorTs);
  // Estimate period end: anchor + 1 month (monthly) or + 1 year (annual)
  const periodEnd = stripeSubscription.cancel_at
    ? new Date((stripeSubscription.cancel_at as number) * 1000)
    : new Date(anchorTs + (plan === "cover_annual" ? 365 : 31) * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: stripeSubscription.id },
    create: {
      customerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeSubscription.customer as string,
      stripePriceId: priceId ?? "",
      plan,
      status: stripeSubscription.status,
      assessmentFeeDiscount: SUBSCRIBER_DISCOUNT_MULTIPLIER,
      priorityDispatch: true,
      freeCallouts: FREE_CALLOUTS_PER_PERIOD,
      freeCalloutsTotal: FREE_CALLOUTS_PER_PERIOD,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialStart: stripeSubscription.trial_start
        ? new Date((stripeSubscription.trial_start as number) * 1000)
        : null,
      trialEnd: stripeSubscription.trial_end
        ? new Date((stripeSubscription.trial_end as number) * 1000)
        : null,
    },
    update: {
      status: stripeSubscription.status,
      stripePriceId: priceId ?? "",
      plan,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      // Reset free callouts on renewal
      freeCallouts: FREE_CALLOUTS_PER_PERIOD,
    },
  });
}

/**
 * Handle Stripe webhook: customer.subscription.deleted
 */
export async function handleSubscriptionCanceled(stripeSubscription: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: stripeSubscription.id },
    data: {
      status: "canceled",
      canceledAt: new Date(),
    },
  });

  const customerId = stripeSubscription.metadata?.lockSafeCustomerId;
  if (customerId) {
    await sendAdminAlert({
      title: "Subscription Cancelled",
      severity: "info",
      message: `Customer ${customerId} cancelled their LockSafe Cover subscription.`,
    }).catch(console.error);
  }
}

/**
 * Get a customer's active subscription status.
 */
export async function getCustomerSubscription(customerId: string) {
  return prisma.subscription.findUnique({
    where: { customerId },
  });
}

/**
 * Check if a customer has an active subscription (for fee discount / priority dispatch).
 */
export async function isActiveSubscriber(customerId: string): Promise<boolean> {
  const sub = await getCustomerSubscription(customerId);
  return sub?.status === "active" || sub?.status === "trialing";
}

/**
 * Apply subscription assessment fee discount.
 * If subscriber has a free callout remaining, fee is £0.
 * Otherwise, apply 50% discount.
 */
export async function applySubscriberDiscount(
  customerId: string,
  baseFee: number
): Promise<{ fee: number; freeCallout: boolean; isSubscriber: boolean }> {
  const sub = await getCustomerSubscription(customerId);
  if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
    return { fee: baseFee, freeCallout: false, isSubscriber: false };
  }

  if (sub.freeCallouts > 0) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { freeCallouts: sub.freeCallouts - 1 },
    });
    return { fee: 0, freeCallout: true, isSubscriber: true };
  }

  return {
    fee: Math.round(baseFee * sub.assessmentFeeDiscount * 100) / 100,
    freeCallout: false,
    isSubscriber: true,
  };
}
