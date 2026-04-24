import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { sendJobConfirmationEmail, sendLocksmithBookedEmail } from "@/lib/email";
import { notifyApplicationAccepted, notifyAssessmentFeePaid } from "@/lib/telegram";
import { sendJobNotification, type JobSMSContext } from "@/lib/sms";
import {
  sendCustomerPushNotification,
  sendLocksmithPushNotification,
} from "@/lib/job-notifications";

// Problem type labels for email
const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

// POST - Customer accepts a locksmith application
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      applicationId,
      paymentIntentId,
      stripeCustomerId,      // From payment flow
      stripePaymentMethodId  // From payment flow
    } = body;

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: "Application ID is required" },
        { status: 400 }
      );
    }

    // Get the application
    const application = await prisma.locksmithApplication.findUnique({
      where: { id: applicationId },
      include: {
        locksmith: true,
        job: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!application || application.jobId !== id) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    if (application.job.status !== JobStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: "Job is no longer available" },
        { status: 400 }
      );
    }

    // Update the job with accepted locksmith
    const updatedJob = await prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.ACCEPTED,
        locksmithId: application.locksmithId,
        assessmentFee: application.assessmentFee,
        assessmentPaid: true,
        acceptedAt: new Date(),
        acceptedEta: application.eta, // Save ETA for cancellation/refund tracking
      },
      include: {
        locksmith: true,
        customer: true,
      },
    });

    // Update application status
    await prisma.locksmithApplication.update({
      where: { id: applicationId },
      data: { status: "accepted" },
    });

    // Reject other applications
    await prisma.locksmithApplication.updateMany({
      where: {
        jobId: id,
        id: { not: applicationId },
      },
      data: { status: "rejected" },
    });

    // Create payment record (only if it doesn't already exist from webhook)
    // Use stripePaymentId to check for duplicates
    const existingPayment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntentId },
    });

    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          jobId: id,
          type: "assessment",
          amount: application.assessmentFee,
          status: "succeeded",
          stripePaymentId: paymentIntentId,
        },
      });
      console.log(`[Accept Application] Created payment record for ${paymentIntentId}`);
    } else {
      console.log(`[Accept Application] Payment record already exists for ${paymentIntentId}`);
    }

    // Save Stripe customer info for future payments (card on file)
    if (stripeCustomerId || stripePaymentMethodId) {
      const customerId = application.job.customerId;
      const updateData: { stripeCustomerId?: string; stripePaymentMethodId?: string } = {};

      if (stripeCustomerId) {
        updateData.stripeCustomerId = stripeCustomerId;
      }
      if (stripePaymentMethodId) {
        updateData.stripePaymentMethodId = stripePaymentMethodId;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.customer.update({
          where: { id: customerId },
          data: updateData,
        });
        console.log(`[Accept Application] Saved Stripe customer info for customer ${customerId}`);
      }
    }

    // Send email notifications (non-blocking)
    const sendEmails = async () => {
      try {
        // Send confirmation email to customer
        if (updatedJob.customer?.email) {
          await sendJobConfirmationEmail(updatedJob.customer.email, {
            customerName: updatedJob.customer.name,
            jobId: updatedJob.id,
            jobNumber: updatedJob.jobNumber,
            locksmithName: updatedJob.locksmith?.name || "Your Locksmith",
            assessmentFee: application.assessmentFee,
            eta: application.eta,
            address: `${updatedJob.address}, ${updatedJob.postcode}`,
          });
          console.log(`[Email] Sent job confirmation to customer: ${updatedJob.customer.email}`);
        }

        // Send booking notification to locksmith
        if (updatedJob.locksmith?.email) {
          await sendLocksmithBookedEmail(updatedJob.locksmith.email, {
            locksmithName: updatedJob.locksmith.name,
            jobNumber: updatedJob.jobNumber,
            customerName: updatedJob.customer?.name || "Customer",
            customerPhone: updatedJob.customer?.phone || "",
            address: updatedJob.address,
            postcode: updatedJob.postcode,
            problemType: problemLabels[updatedJob.problemType] || updatedJob.problemType,
            assessmentFee: application.assessmentFee,
            jobId: updatedJob.id,
          });
          console.log(`[Email] Sent booking notification to locksmith: ${updatedJob.locksmith.email}`);
        }
      } catch (emailError) {
        console.error("[Email] Error sending notification emails:", emailError);
        // Don't fail the request if emails fail
      }
    };

    // Fire and forget - don't block the response
    sendEmails();

    // Send Telegram notifications (non-blocking)
    notifyApplicationAccepted({
      jobNumber: updatedJob.jobNumber,
      jobId: updatedJob.id,
      locksmithName: updatedJob.locksmith?.name || "Locksmith",
      locksmithPhone: updatedJob.locksmith?.phone || "",
      customerName: updatedJob.customer?.name || "Customer",
      customerPhone: updatedJob.customer?.phone || "",
      address: updatedJob.address,
      postcode: updatedJob.postcode,
      estimatedArrival: `${application.eta} minutes`,
    }).catch((err) => console.error("[Telegram] Failed to send application accepted notification:", err));

    notifyAssessmentFeePaid({
      jobNumber: updatedJob.jobNumber,
      jobId: updatedJob.id,
      customerName: updatedJob.customer?.name || "Customer",
      locksmithName: updatedJob.locksmith?.name || "Locksmith",
      amount: application.assessmentFee,
    }).catch((err) => console.error("[Telegram] Failed to send assessment fee notification:", err));

    // Send SMS notifications to both customer and locksmith
    const smsContext: JobSMSContext = {
      jobId: updatedJob.id,
      jobNumber: updatedJob.jobNumber,
      customerName: updatedJob.customer?.name || "Customer",
      customerPhone: updatedJob.customer?.phone || "",
      locksmithName: updatedJob.locksmith?.name,
      locksmithPhone: updatedJob.locksmith?.phone || undefined,
      problemType: updatedJob.problemType,
      postcode: updatedJob.postcode || undefined,
      address: updatedJob.address || undefined,
      eta: `${application.eta} minutes`,
      assessmentFee: application.assessmentFee,
    };

    // This sends SMS to both customer and locksmith
    sendJobNotification("locksmith_accepted", smsContext).catch((err) =>
      console.error("[SMS] Failed to send locksmith accepted notifications:", err)
    );

    // Send OneSignal push notifications
    // Notify customer that locksmith has been assigned
    if (updatedJob.customer) {
      sendCustomerPushNotification(updatedJob.customerId, "LOCKSMITH_ASSIGNED", {
        jobId: updatedJob.id,
        variables: { jobNumber: updatedJob.jobNumber },
      }).catch((err) =>
        console.error("[Push] Failed to send locksmith assigned push notification:", err)
      );
    }

    // Notify locksmith that they've been selected
    if (updatedJob.locksmithId) {
      sendLocksmithPushNotification(updatedJob.locksmithId, "JOB_ACCEPTED", {
        jobId: updatedJob.id,
        variables: { jobNumber: updatedJob.jobNumber },
      }).catch((err) =>
        console.error("[Push] Failed to send job accepted push notification:", err)
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        id: updatedJob.id,
        jobNumber: updatedJob.jobNumber,
        status: updatedJob.status,
        locksmith: {
          id: updatedJob.locksmith?.id,
          name: updatedJob.locksmith?.name,
          phone: updatedJob.locksmith?.phone,
        },
      },
    });
  } catch (error) {
    console.error("Error accepting application:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept application" },
      { status: 500 }
    );
  }
}
