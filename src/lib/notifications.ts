import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { sendSignatureReminderEmail, sendAutoCompletionEmail, sendTransferNotificationEmail, sendPaymentReceiptEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/config";
import { stripe, formatAmountForStripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe";
import { notifyJobAutoCompleted } from "@/lib/telegram";

// Notification types
export type NotificationType =
  | "signature_reminder"
  | "auto_completed"
  | "job_update"
  | "payment"
  | "locksmith_applied"
  | "quote_received"
  | "work_completed"
  | "locksmith_arrived"
  | "warning";

interface CreateNotificationParams {
  customerId?: string;
  locksmithId?: string;
  jobId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  data?: Prisma.InputJsonValue;
}

/**
 * Create an in-app notification
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        customerId: params.customerId,
        locksmithId: params.locksmithId,
        jobId: params.jobId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        actionLabel: params.actionLabel,
        data: params.data,
      },
    });

    return notification;
  } catch (error) {
    console.error("[Notifications] Failed to create notification:", error);
    return null;
  }
}

/**
 * Send signature reminder notification to customer
 */
export async function sendSignatureReminder(jobId: string, reminderNumber: number) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        locksmith: true,
        quote: true,
      },
    });

    if (!job || !job.customer) {
      console.error("[Notifications] Job or customer not found:", jobId);
      return false;
    }

    const confirmUrl = `${SITE_URL}/customer/job/${job.id}`;
    const totalAmount = job.quote?.total || job.assessmentFee;

    // Calculate time remaining
    const deadline = job.confirmationDeadline;
    let timeRemaining = "24 hours";
    if (deadline) {
      const msRemaining = new Date(deadline).getTime() - Date.now();
      const hoursRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60)));
      timeRemaining = hoursRemaining > 1 ? `${hoursRemaining} hours` : "less than 1 hour";
    }

    // Create in-app notification
    await createNotification({
      customerId: job.customerId,
      jobId: job.id,
      type: "signature_reminder",
      title: reminderNumber === 1 ? "Please Sign Off Your Job" : `Reminder: Sign Off Required (${timeRemaining} left)`,
      message: `Your locksmith ${job.locksmith?.name || "has"} completed the work. Please confirm and sign to process payment of £${totalAmount.toFixed(2)}.`,
      actionUrl: confirmUrl,
      actionLabel: "Sign Now",
      data: {
        reminderNumber,
        totalAmount,
        locksmithName: job.locksmith?.name,
        deadline: deadline?.toISOString(),
      },
    });

    // Send email notification
    if (job.customer.email) {
      await sendSignatureReminderEmail(job.customer.email, {
        customerName: job.customer.name,
        jobNumber: job.jobNumber,
        locksmithName: job.locksmith?.name || "Your locksmith",
        totalAmount,
        confirmUrl,
        timeRemaining,
        reminderNumber,
      });
    }

    // Update reminder count
    await prisma.job.update({
      where: { id: jobId },
      data: {
        confirmationRemindersSent: { increment: 1 },
      },
    });

    console.log(`[Notifications] Sent signature reminder #${reminderNumber} for job ${job.jobNumber}`);
    return true;
  } catch (error) {
    console.error("[Notifications] Failed to send signature reminder:", error);
    return false;
  }
}

/**
 * Auto-complete a job after deadline passes
 * Also processes payment if customer has saved card
 */
export async function autoCompleteJob(jobId: string) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        locksmith: true,
        quote: true,
        payments: {
          where: { status: "succeeded" },
        },
      },
    });

    if (!job) {
      console.error("[Notifications] Job not found for auto-completion:", jobId);
      return false;
    }

    // Only auto-complete if still pending confirmation
    if (job.status !== "PENDING_CUSTOMER_CONFIRMATION") {
      console.log(`[Notifications] Job ${job.jobNumber} not in PENDING_CUSTOMER_CONFIRMATION status, skipping auto-completion`);
      return false;
    }

    const quoteTotal = job.quote?.total || 0;
    const assessmentFee = job.assessmentFee || 0;
    const assessmentFeePaid = job.payments
      .filter((p) => p.type === "assessment" && p.status === "succeeded")
      .reduce((sum, p) => sum + p.amount, 0);

    // Final amount to charge
    const finalAmount = Math.max(0, quoteTotal - assessmentFeePaid);

    // Platform commission
    const platformCommissionOnFinal = Math.round(finalAmount * PLATFORM_FEE_PERCENT * 100) / 100;
    const locksmithAmountFromFinal = Math.round((finalAmount - platformCommissionOnFinal) * 100) / 100;

    console.log("[Auto-Complete] Payment calculation:", {
      jobNumber: job.jobNumber,
      quoteTotal,
      assessmentFeePaid,
      finalAmount,
      platformCommissionOnFinal,
      locksmithAmountFromFinal,
    });

    let paymentProcessed = false;
    let paymentError: string | null = null;

    // Try to process payment if there's an amount to charge and customer has saved card
    if (finalAmount > 0 && job.locksmith && job.customer?.stripeCustomerId && job.customer?.stripePaymentMethodId) {
      try {
        const locksmithStripeAccountId = job.locksmith.stripeConnectId;

        if (locksmithStripeAccountId) {
          // Use Stripe Connect destination charges
          const paymentIntent = await stripe.paymentIntents.create({
            amount: formatAmountForStripe(finalAmount),
            currency: "gbp",
            customer: job.customer.stripeCustomerId,
            payment_method: job.customer.stripePaymentMethodId,
            off_session: true,
            confirm: true,
            transfer_data: {
              destination: locksmithStripeAccountId,
            },
            application_fee_amount: formatAmountForStripe(platformCommissionOnFinal),
            metadata: {
              type: "work_quote_auto_complete",
              jobId: job.id,
              jobNumber: job.jobNumber,
              customerId: job.customerId,
              locksmithId: job.locksmithId || "",
            },
            description: `LockSafe Auto-Complete Payment - Job ${job.jobNumber}`,
          });

          if (paymentIntent.status === "succeeded") {
            // Record the payment
            await prisma.payment.create({
              data: {
                jobId: job.id,
                type: "final_payment",
                amount: finalAmount,
                status: "succeeded",
                stripePaymentId: paymentIntent.id,
              },
            });

            paymentProcessed = true;
            console.log(`[Auto-Complete] Payment processed: £${finalAmount} for job ${job.jobNumber}`);
          }
        } else {
          // No Stripe Connect - charge customer and record for manual payout
          const paymentIntent = await stripe.paymentIntents.create({
            amount: formatAmountForStripe(finalAmount),
            currency: "gbp",
            customer: job.customer.stripeCustomerId,
            payment_method: job.customer.stripePaymentMethodId,
            off_session: true,
            confirm: true,
            metadata: {
              type: "work_quote_auto_complete",
              jobId: job.id,
              jobNumber: job.jobNumber,
              payoutType: "manual",
            },
            description: `LockSafe Auto-Complete Payment - Job ${job.jobNumber}`,
          });

          if (paymentIntent.status === "succeeded") {
            await prisma.payment.create({
              data: {
                jobId: job.id,
                type: "final_payment",
                amount: finalAmount,
                status: "succeeded",
                stripePaymentId: paymentIntent.id,
              },
            });
            paymentProcessed = true;
          }
        }
      } catch (err) {
        paymentError = err instanceof Error ? err.message : "Unknown payment error";
        console.error("[Auto-Complete] Payment failed:", paymentError);

        // Record failed payment attempt
        await prisma.payment.create({
          data: {
            jobId: job.id,
            type: "final_payment",
            amount: finalAmount,
            status: "failed",
            stripePaymentId: `failed_${Date.now()}`,
          },
        });
      }
    } else if (finalAmount > 0) {
      // Customer doesn't have saved card - record as pending
      await prisma.payment.create({
        data: {
          jobId: job.id,
          type: "final_payment",
          amount: finalAmount,
          status: "pending",
          stripePaymentId: `pending_auto_${Date.now()}`,
        },
      });
      console.log(`[Auto-Complete] No saved card - payment of £${finalAmount} marked as pending`);
    }

    // Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        autoCompletedAt: new Date(),
      },
    });

    // Create auto-signature
    await prisma.signature.upsert({
      where: { jobId },
      create: {
        jobId,
        signatureData: "AUTO_COMPLETED",
        signerName: "System (Auto-Completed)",
        signerIp: "system",
        deviceInfo: "auto-completion-system",
        confirmsWork: true,
        confirmsPrice: true,
        confirmsSatisfied: true,
      },
      update: {
        signatureData: "AUTO_COMPLETED",
        signerName: "System (Auto-Completed)",
        confirmsWork: true,
        confirmsPrice: true,
        confirmsSatisfied: true,
        signedAt: new Date(),
      },
    });

    // Update locksmith stats
    if (job.locksmithId) {
      await prisma.locksmith.update({
        where: { id: job.locksmithId },
        data: {
          totalJobs: { increment: 1 },
          totalEarnings: { increment: locksmithAmountFromFinal },
        },
      });
    }

    // Notify customer
    await createNotification({
      customerId: job.customerId,
      jobId: job.id,
      type: "auto_completed",
      title: "Job Auto-Completed",
      message: paymentProcessed
        ? `Your job #${job.jobNumber} has been automatically completed. Payment of £${finalAmount.toFixed(2)} has been processed.`
        : `Your job #${job.jobNumber} has been automatically completed as the 24-hour confirmation period expired.`,
      actionUrl: `/customer/job/${job.id}`,
      actionLabel: "View Details",
    });

    // Notify locksmith
    if (job.locksmithId) {
      await createNotification({
        locksmithId: job.locksmithId,
        jobId: job.id,
        type: "auto_completed",
        title: "Job Auto-Completed",
        message: paymentProcessed
          ? `Job #${job.jobNumber} has been auto-completed. You've earned £${locksmithAmountFromFinal.toFixed(2)}.`
          : `Job #${job.jobNumber} has been auto-completed after the 24-hour deadline.`,
        actionUrl: `/locksmith/job/${job.id}/work`,
        actionLabel: "View Job",
      });

      // Send payment notification to locksmith if payment succeeded
      if (paymentProcessed && job.locksmith?.email) {
        try {
          await sendTransferNotificationEmail(job.locksmith.email, {
            locksmithName: job.locksmith.name,
            amount: locksmithAmountFromFinal,
            jobNumber: job.jobNumber,
            customerName: job.customer?.name || "Customer",
            platformFee: platformCommissionOnFinal,
          });
        } catch (emailError) {
          console.error("[Auto-Complete] Failed to send locksmith email:", emailError);
        }
      }
    }

    // Send emails to customer
    if (job.customer?.email) {
      try {
        await sendAutoCompletionEmail(job.customer.email, {
          customerName: job.customer.name,
          jobNumber: job.jobNumber,
          locksmithName: job.locksmith?.name || "Your locksmith",
          totalAmount: quoteTotal,
          reportUrl: `${SITE_URL}/customer/job/${job.id}`,
        });

        // Send payment receipt if payment succeeded
        if (paymentProcessed) {
          await sendPaymentReceiptEmail(job.customer.email, {
            customerName: job.customer.name,
            jobNumber: job.jobNumber,
            locksmithName: job.locksmith?.name || "Your locksmith",
            paymentType: "work_quote",
            quoteTotal,
            assessmentFeeDeducted: assessmentFeePaid,
            amountPaid: finalAmount,
            paymentDate: new Date(),
            address: job.address,
          });
        }
      } catch (emailError) {
        console.error("[Auto-Complete] Failed to send customer emails:", emailError);
      }
    }

    // Send Telegram notification (non-blocking)
    notifyJobAutoCompleted({
      jobNumber: job.jobNumber,
      jobId: job.id,
      locksmithName: job.locksmith?.name || "Locksmith",
      customerName: job.customer?.name || "Customer",
      total: quoteTotal,
      paymentProcessed,
    }).catch((err) => console.error("[Telegram] Failed to send auto-completion notification:", err));

    console.log(`[Notifications] Auto-completed job ${job.jobNumber} - Payment: ${paymentProcessed ? "processed" : paymentError || "not required"}`);
    return true;
  } catch (error) {
    console.error("[Notifications] Failed to auto-complete job:", error);
    return false;
  }
}

/**
 * Get jobs that need signature reminders
 */
export async function getJobsNeedingReminders() {
  const now = new Date();

  // Get jobs in PENDING_CUSTOMER_CONFIRMATION with deadline set
  const jobs = await prisma.job.findMany({
    where: {
      status: "PENDING_CUSTOMER_CONFIRMATION",
      confirmationDeadline: { not: null },
    },
    include: {
      customer: true,
      locksmith: true,
    },
  });

  const needsReminder: Array<{ job: typeof jobs[0]; reminderNumber: number }> = [];
  const needsAutoComplete: string[] = [];

  for (const job of jobs) {
    if (!job.confirmationDeadline) continue;

    const deadline = new Date(job.confirmationDeadline);
    const msUntilDeadline = deadline.getTime() - now.getTime();

    // Check if past deadline - auto-complete
    if (msUntilDeadline <= 0) {
      needsAutoComplete.push(job.id);
      continue;
    }

    // Reminder schedule:
    // Reminder 1: After 1 hour (23 hours remaining)
    // Reminder 2: After 4 hours (20 hours remaining)
    // Reminder 3: After 12 hours (12 hours remaining)
    // Reminder 4: After 20 hours (4 hours remaining) - urgent

    const hoursSinceWorkCompleted = (now.getTime() - new Date(job.workCompletedAt || job.createdAt).getTime()) / (1000 * 60 * 60);
    const remindersSent = job.confirmationRemindersSent || 0;

    let shouldSendReminder = false;
    const reminderNumber = remindersSent + 1;

    if (remindersSent === 0 && hoursSinceWorkCompleted >= 1) {
      shouldSendReminder = true;
    } else if (remindersSent === 1 && hoursSinceWorkCompleted >= 4) {
      shouldSendReminder = true;
    } else if (remindersSent === 2 && hoursSinceWorkCompleted >= 12) {
      shouldSendReminder = true;
    } else if (remindersSent === 3 && hoursSinceWorkCompleted >= 20) {
      shouldSendReminder = true;
    }

    if (shouldSendReminder) {
      needsReminder.push({ job, reminderNumber });
    }
  }

  return { needsReminder, needsAutoComplete };
}
