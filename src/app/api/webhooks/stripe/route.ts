import { NextRequest, NextResponse } from "next/server";
import { stripe, verifyWebhookSignature, formatAmountFromStripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe";
import prisma from "@/lib/db";
import crypto from "crypto";
import {
  sendAccountVerifiedEmail,
  sendPayoutNotificationEmail,
  sendPayoutFailedEmail,
  sendTransferNotificationEmail,
  sendEarningsReversalEmail,
} from "@/lib/email";

// Disable body parsing - we need the raw body for signature verification
export const runtime = "nodejs";

// ==========================================
// SERVER-SIDE CONVERSION TRACKING
// ==========================================

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const META_ACCESS_TOKEN = process.env.META_CONVERSIONS_API_TOKEN;

// Hash PII for Meta
function hashSHA256(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

// Send server-side conversion event to Meta
async function sendConversionEvent(
  eventName: "Purchase" | "InitiateCheckout" | "Lead" | "CompleteRegistration",
  data: {
    value: number;
    jobId?: string;
    jobNumber?: string;
    email?: string;
    phone?: string;
    firstName?: string;
  }
) {
  // Track in our database
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: `conversion_${eventName.toLowerCase()}`,
        data: {
          ...data,
          source: "stripe_webhook",
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (e) {
    console.error("[Webhook] Failed to store conversion event:", e);
  }

  // Send to Meta Conversions API
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
    console.log("[Webhook] Meta Conversions API not configured - skipping");
    return;
  }

  const eventId = `${data.jobId || "unknown"}_${eventName}_${Date.now()}`;

  const userData: Record<string, string> = {};
  if (data.email) userData.em = hashSHA256(data.email);
  if (data.phone) userData.ph = hashSHA256(data.phone.replace(/\D/g, ""));
  if (data.firstName) userData.fn = hashSHA256(data.firstName);

  const eventPayload = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: userData,
    custom_data: {
      value: data.value,
      currency: "GBP",
      content_ids: data.jobId ? [data.jobId] : undefined,
      content_type: "product",
      order_id: data.jobNumber,
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [eventPayload],
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );

    if (response.ok) {
      console.log(`[Webhook] Meta conversion ${eventName} sent: ${eventId}`);
    } else {
      const error = await response.json();
      console.error("[Webhook] Meta conversion failed:", error);
    }
  } catch (error) {
    console.error("[Webhook] Meta conversion request failed:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[Webhook] No Stripe signature found");
      return NextResponse.json(
        { error: "No signature" },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Verify the webhook signature
    let event;
    try {
      event = verifyWebhookSignature(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      // ===========================================
      // PAYMENT EVENTS
      // ===========================================

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log(`[Webhook] Payment succeeded: ${paymentIntent.id}`);
        console.log(`[Webhook] Payment metadata:`, paymentIntent.metadata);

        // Extract metadata
        const {
          type: paymentType,
          jobId,
          locksmithId,
          customerId,
          platformFee: platformFeeStr,
          locksmithShare: locksmithShareStr,
        } = paymentIntent.metadata || {};

        const amount = formatAmountFromStripe(paymentIntent.amount);
        const platformFee = platformFeeStr ? formatAmountFromStripe(Number.parseInt(platformFeeStr)) : amount * PLATFORM_FEE_PERCENT;
        const locksmithShare = locksmithShareStr ? formatAmountFromStripe(Number.parseInt(locksmithShareStr)) : amount - platformFee;

        // Update payment record if exists
        const updatedPayments = await prisma.payment.updateMany({
          where: { stripePaymentId: paymentIntent.id },
          data: { status: "succeeded" },
        });

        // If no existing payment record, create one (double-check to avoid race condition)
        if (updatedPayments.count === 0 && jobId) {
          // Check again to prevent race condition with accept-application
          const existingPayment = await prisma.payment.findFirst({
            where: { stripePaymentId: paymentIntent.id },
          });

          if (!existingPayment) {
            await prisma.payment.create({
              data: {
                jobId,
                type: paymentType === "assessment_fee" ? "assessment" : "quote",
                amount,
                status: "succeeded",
                stripePaymentId: paymentIntent.id,
              },
            });
            console.log(`[Webhook] Created new payment record for ${paymentType}`);
          } else {
            console.log(`[Webhook] Payment record already exists for ${paymentIntent.id}`);
          }
        }

        // Update job status based on payment type
        if (paymentType === "assessment_fee" && jobId) {
          await prisma.job.update({
            where: { id: jobId },
            data: { assessmentPaid: true },
          });
          console.log(`[Webhook] Marked assessment as paid for job ${jobId}`);
        }

        // Save customer's payment method for future use
        if (paymentIntent.customer && paymentIntent.payment_method && customerId && customerId !== "guest") {
          try {
            await prisma.customer.update({
              where: { id: customerId },
              data: {
                stripeCustomerId: paymentIntent.customer as string,
                stripePaymentMethodId: paymentIntent.payment_method as string,
              },
            });
            console.log(`[Webhook] Saved payment method for customer ${customerId}`);
          } catch (e) {
            console.log(`[Webhook] Could not update customer payment method:`, e);
          }
        }

        // Notify locksmith about the transfer
        if (locksmithId) {
          const locksmith = await prisma.locksmith.findUnique({
            where: { id: locksmithId },
          });

          const job = jobId
            ? await prisma.job.findUnique({
                where: { id: jobId },
                include: { customer: true },
              })
            : null;

          if (locksmith?.email && job) {
            try {
              await sendTransferNotificationEmail(locksmith.email, {
                locksmithName: locksmith.name,
                amount: locksmithShare,
                jobNumber: job.jobNumber,
                customerName: job.customer?.name || "Customer",
                platformFee,
              });
              console.log(`[Webhook] Sent ${paymentType} transfer notification to ${locksmith.email}`);
            } catch (emailError) {
              console.error(`[Webhook] Failed to send email:`, emailError);
            }
          }

          // Update locksmith earnings
          if (locksmith) {
            await prisma.locksmith.update({
              where: { id: locksmithId },
              data: {
                totalEarnings: { increment: locksmithShare },
              },
            });
            console.log(`[Webhook] Updated locksmith earnings: +£${locksmithShare}`);
          }
        }

        // ==========================================
        // FIRE CONVERSION EVENTS (Server-Side)
        // ==========================================
        if (jobId) {
          const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: { customer: true },
          });

          if (job) {
            const customerEmail = job.customer?.email;
            const customerPhone = job.customer?.phone;
            const customerName = job.customer?.name;

            if (paymentType === "assessment_fee") {
              // Assessment fee paid = InitiateCheckout
              await sendConversionEvent("InitiateCheckout", {
                value: amount,
                jobId: job.id,
                jobNumber: job.jobNumber,
                email: customerEmail || undefined,
                phone: customerPhone,
                firstName: customerName,
              });
              console.log(`[Webhook] Fired InitiateCheckout conversion for job ${job.jobNumber}`);
            } else if (paymentType === "quote" || paymentType === "final") {
              // Full job payment = Purchase
              await sendConversionEvent("Purchase", {
                value: amount,
                jobId: job.id,
                jobNumber: job.jobNumber,
                email: customerEmail || undefined,
                phone: customerPhone,
                firstName: customerName,
              });
              console.log(`[Webhook] Fired Purchase conversion for job ${job.jobNumber}: £${amount}`);
            }
          }
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log(`[Webhook] Payment failed: ${paymentIntent.id}`);
        console.log(`[Webhook] Failure reason:`, paymentIntent.last_payment_error?.message);

        await prisma.payment.updateMany({
          where: { stripePaymentId: paymentIntent.id },
          data: { status: "failed" },
        });

        break;
      }

      case "payment_intent.requires_action": {
        const paymentIntent = event.data.object;
        console.log(`[Webhook] Payment requires action: ${paymentIntent.id}`);
        // This happens when 3D Secure or other authentication is required
        // The frontend should handle this with confirmPayment()
        break;
      }

      // ===========================================
      // SETUP INTENT EVENTS (Card Saving)
      // ===========================================

      case "setup_intent.succeeded": {
        const setupIntent = event.data.object;
        console.log(`[Webhook] Setup intent succeeded: ${setupIntent.id}`);

        const { customerId } = setupIntent.metadata || {};

        if (customerId && customerId !== "guest" && setupIntent.payment_method) {
          try {
            await prisma.customer.update({
              where: { id: customerId },
              data: {
                stripeCustomerId: setupIntent.customer as string,
                stripePaymentMethodId: setupIntent.payment_method as string,
              },
            });
            console.log(`[Webhook] Saved card for customer ${customerId}`);
          } catch (e) {
            console.log(`[Webhook] Could not save card for customer:`, e);
          }
        }

        break;
      }

      // ===========================================
      // STRIPE CONNECT ACCOUNT EVENTS
      // ===========================================

      case "account.updated": {
        const account = event.data.object;

        // Log detailed account status
        console.log(`[Webhook] Account updated: ${account.id}`, {
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          capabilities: account.capabilities,
          requirements: account.requirements?.currently_due?.length || 0,
        });

        // Find the locksmith with this Stripe account
        const locksmith = await prisma.locksmith.findFirst({
          where: { stripeConnectId: account.id },
        });

        if (locksmith) {
          const wasVerified = locksmith.stripeConnectVerified;
          const wasOnboarded = locksmith.stripeConnectOnboarded;

          // Account is verified if it can receive charges AND payouts
          const isNowVerified = account.charges_enabled === true && account.payouts_enabled === true;
          const isNowOnboarded = account.details_submitted === true;

          console.log(`[Webhook] Locksmith ${locksmith.id} (${locksmith.name}) status:`, {
            wasOnboarded,
            isNowOnboarded,
            wasVerified,
            isNowVerified,
          });

          // Update locksmith's Stripe status
          // IMPORTANT: Also set isVerified = true when Stripe Connect is verified
          // This auto-verifies the locksmith profile once Stripe identity is confirmed
          await prisma.locksmith.update({
            where: { id: locksmith.id },
            data: {
              stripeConnectOnboarded: isNowOnboarded,
              stripeConnectVerified: isNowVerified,
              // Auto-verify locksmith when Stripe Connect is fully verified
              ...(isNowVerified && !wasVerified ? { isVerified: true } : {}),
            },
          });

          console.log(`[Webhook] Updated locksmith ${locksmith.id}: onboarded=${isNowOnboarded}, verified=${isNowVerified}, isVerified=${isNowVerified}`);

          // If just became verified, send congratulations email
          if (!wasVerified && isNowVerified && locksmith.email) {
            try {
              await sendAccountVerifiedEmail(locksmith.email, {
                locksmithName: locksmith.name,
                accountId: account.id,
              });
              console.log(`[Webhook] Sent account verified email to ${locksmith.email}`);
            } catch (emailError) {
              console.error(`[Webhook] Failed to send verified email:`, emailError);
            }
          }
        } else {
          console.log(`[Webhook] No locksmith found for Stripe account ${account.id}`);
        }

        break;
      }

      // Handle capability updates (important for Connect verification)
      case "capability.updated": {
        const capability = event.data.object;
        const accountId = capability.account;

        console.log(`[Webhook] Capability updated for account ${accountId}:`, {
          capability: capability.id,
          status: capability.status,
        });

        // If a capability became active, check if account is now fully verified
        if (capability.status === "active" && typeof accountId === "string") {
          const locksmith = await prisma.locksmith.findFirst({
            where: { stripeConnectId: accountId },
          });

          if (locksmith && !locksmith.stripeConnectVerified) {
            // Fetch the full account to check status
            try {
              const account = await stripe.accounts.retrieve(accountId);
              const isVerified = account.charges_enabled && account.payouts_enabled;

              if (isVerified) {
                // Auto-verify locksmith profile when Stripe Connect is verified
                await prisma.locksmith.update({
                  where: { id: locksmith.id },
                  data: {
                    stripeConnectVerified: true,
                    isVerified: true,
                  },
                });
                console.log(`[Webhook] Locksmith ${locksmith.id} is now verified via capability update (isVerified=true)`);

                // Send verification email
                if (locksmith.email) {
                  try {
                    await sendAccountVerifiedEmail(locksmith.email, {
                      locksmithName: locksmith.name,
                      accountId,
                    });
                  } catch (emailError) {
                    console.error(`[Webhook] Failed to send verified email:`, emailError);
                  }
                }
              }
            } catch (err) {
              console.error(`[Webhook] Error fetching account ${accountId}:`, err);
            }
          }
        }

        break;
      }

      // Handle account application authorization (when locksmith authorizes connection)
      case "account.application.authorized": {
        const application = event.data.object;
        console.log(`[Webhook] Account application authorized:`, application);
        break;
      }

      // Handle account deauthorization (when locksmith disconnects)
      case "account.application.deauthorized": {
        const application = event.data.object;
        const accountId = event.account;

        console.log(`[Webhook] Account application deauthorized:`, { application, accountId });

        if (accountId) {
          const locksmith = await prisma.locksmith.findFirst({
            where: { stripeConnectId: accountId },
          });

          if (locksmith) {
            await prisma.locksmith.update({
              where: { id: locksmith.id },
              data: {
                stripeConnectVerified: false,
              },
            });
            console.log(`[Webhook] Locksmith ${locksmith.id} disconnected from Stripe`);
          }
        }

        break;
      }

      // ===========================================
      // PAYOUT EVENTS (Stripe Connect)
      // ===========================================

      case "payout.paid": {
        const payout = event.data.object;
        const accountId = event.account; // Connected account ID

        console.log(`[Webhook] Payout paid: ${payout.id} for account ${accountId}`);

        if (accountId) {
          const locksmith = await prisma.locksmith.findFirst({
            where: { stripeConnectId: accountId },
          });

          if (locksmith?.email) {
            // Get bank account last 4 digits if available
            const bankLast4 = payout.destination
              ? (typeof payout.destination === "string"
                  ? "****"
                  : (payout.destination as any).last4 || "****")
              : "****";

            await sendPayoutNotificationEmail(locksmith.email, {
              locksmithName: locksmith.name,
              amount: formatAmountFromStripe(payout.amount),
              currency: payout.currency.toUpperCase(),
              arrivalDate: new Date(payout.arrival_date * 1000).toLocaleDateString("en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
              bankLast4,
              payoutId: payout.id,
            });
            console.log(`[Webhook] Sent payout notification to ${locksmith.email}`);
          }
        }

        break;
      }

      case "payout.failed": {
        const payout = event.data.object;
        const accountId = event.account;

        console.log(`[Webhook] Payout failed: ${payout.id} for account ${accountId}`);

        if (accountId) {
          const locksmith = await prisma.locksmith.findFirst({
            where: { stripeConnectId: accountId },
          });

          if (locksmith?.email) {
            await sendPayoutFailedEmail(locksmith.email, {
              locksmithName: locksmith.name,
              amount: formatAmountFromStripe(payout.amount),
              currency: payout.currency.toUpperCase(),
              failureReason: payout.failure_message || "Unknown reason",
              failureCode: payout.failure_code || "unknown",
              payoutId: payout.id,
            });
            console.log(`[Webhook] Sent payout failed notification to ${locksmith.email}`);
          }
        }

        break;
      }

      // ===========================================
      // TRANSFER EVENTS (Platform to Connected Account)
      // ===========================================

      case "transfer.created": {
        const transfer = event.data.object;
        console.log(`[Webhook] Transfer created: ${transfer.id}`);

        // Log the transfer for tracking
        const amount = formatAmountFromStripe(transfer.amount);
        console.log(`[Webhook] Transfer amount: £${amount}`);

        if (transfer.metadata?.jobId) {
          console.log(`[Webhook] Transfer for job ${transfer.metadata.jobId}: £${amount}`);
        }

        break;
      }

      case "transfer.reversed": {
        const transfer = event.data.object;
        const reversedAmount = formatAmountFromStripe(transfer.amount_reversed || 0);
        const originalAmount = formatAmountFromStripe(transfer.amount || 0);
        console.log(`[Webhook] Transfer reversed: ${transfer.id}, amount: £${reversedAmount}`);

        // Find the locksmith associated with this transfer's destination account
        if (transfer.destination) {
          const destinationAccountId = typeof transfer.destination === "string"
            ? transfer.destination
            : transfer.destination.id;

          const locksmith = await prisma.locksmith.findFirst({
            where: { stripeConnectId: destinationAccountId },
          });

          if (locksmith && reversedAmount > 0) {
            // Deduct the reversed amount from locksmith's earnings
            await prisma.locksmith.update({
              where: { id: locksmith.id },
              data: {
                totalEarnings: {
                  decrement: reversedAmount,
                },
              },
            });
            console.log(`[Webhook] Deducted £${reversedAmount} from locksmith ${locksmith.name}'s earnings due to transfer reversal`);

            // Try to find the job associated with this transfer via metadata
            const jobId = transfer.metadata?.jobId;
            if (jobId) {
              const job = await prisma.job.findUnique({
                where: { id: jobId },
                include: { customer: true },
              });

              if (job) {
                // Send email notification to locksmith
                try {
                  await sendEarningsReversalEmail(locksmith.email, {
                    locksmithName: locksmith.name,
                    jobNumber: job.jobNumber,
                    jobId: job.id,
                    customerName: job.customer?.name || "Customer",
                    originalAmount: originalAmount / 0.85, // Calculate original full amount
                    reversedAmount: reversedAmount,
                    reason: "Refund processed - transfer reversed",
                    refundDate: new Date(),
                  });
                  console.log(`[Webhook] Sent earnings reversal email to ${locksmith.email}`);
                } catch (emailError) {
                  console.error("[Webhook] Failed to send earnings reversal email:", emailError);
                }
              }
            }
          }
        }
        break;
      }

      // ===========================================
      // REFUND EVENTS
      // ===========================================

      case "charge.refunded": {
        const charge = event.data.object;
        const refundedAmount = formatAmountFromStripe(charge.amount_refunded || 0);
        console.log(`[Webhook] Charge refunded: ${charge.id}, refund amount: £${refundedAmount}`);

        // Update payment status if we can find it
        if (charge.payment_intent) {
          const paymentIntentId = typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent.id;

          await prisma.payment.updateMany({
            where: { stripePaymentId: paymentIntentId },
            data: { status: "refunded" },
          });

          // Find the job associated with this payment
          const payment = await prisma.payment.findFirst({
            where: { stripePaymentId: paymentIntentId },
            include: { job: { include: { locksmith: true } } },
          });

          if (payment?.job) {
            console.log(`[Webhook] Refund for job ${payment.job.jobNumber} processed`);

            // If there's a transfer associated, check if it was reversed
            // The locksmith earnings will be deducted in the transfer.reversed event
            if (charge.transfer) {
              const transferId = typeof charge.transfer === "string"
                ? charge.transfer
                : charge.transfer.id;
              console.log(`[Webhook] Associated transfer ${transferId} should be reversed`);
            }
          }
        }

        break;
      }

      case "charge.refund.updated": {
        const refund = event.data.object;
        console.log(`[Webhook] Refund updated: ${refund.id}, status: ${refund.status}`);
        break;
      }

      // ===========================================
      // APPLICATION FEE EVENTS (Platform Revenue)
      // ===========================================

      case "application_fee.created": {
        const appFee = event.data.object;
        console.log(`[Webhook] Application fee created: ${appFee.id}, amount: £${formatAmountFromStripe(appFee.amount)}`);
        // This is platform revenue from the transfer
        break;
      }

      // ===========================================
      // DEFAULT HANDLER
      // ===========================================

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
