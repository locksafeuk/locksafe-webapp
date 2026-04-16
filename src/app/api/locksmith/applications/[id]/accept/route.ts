import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import { sendCustomerPaymentLinkEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { sendCustomerPushNotification } from "@/lib/job-notifications";
import { SITE_URL } from "@/lib/config";

/**
 * POST /api/locksmith/applications/[id]/accept
 *
 * Locksmith accepts an admin-assigned job. This:
 * 1. Updates the application status from "admin_assigned" to "accepted"
 * 2. Sends payment link to customer (for assessment fee)
 * 3. Notifies customer via SMS, email, and push
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;
    const body = await request.json();
    const { assessmentFee } = body;

    // Get the application
    const application = await prisma.locksmithApplication.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          include: {
            customer: true,
          },
        },
        locksmith: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // Check if application is in admin_assigned status
    if (application.status !== "admin_assigned") {
      return NextResponse.json(
        {
          success: false,
          error: `Application cannot be accepted (status: ${application.status})`
        },
        { status: 409 }
      );
    }

    // Check if job is still available
    if (application.job.status !== "PENDING" && application.job.status !== "PHONE_INITIATED") {
      return NextResponse.json(
        {
          success: false,
          error: `Job ${application.job.jobNumber} is no longer available (status: ${application.job.status})`
        },
        { status: 409 }
      );
    }

    // Update application status to "accepted" and assessment fee if provided
    const updateData: any = { status: "accepted" };
    if (assessmentFee !== undefined && assessmentFee > 0) {
      updateData.assessmentFee = assessmentFee;
    }

    const updatedApplication = await prisma.locksmithApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    // Use the updated assessment fee for notifications
    const finalAssessmentFee = assessmentFee !== undefined && assessmentFee > 0 ? assessmentFee : application.assessmentFee;

    // Build payment link URL
    const paymentUrl = `${SITE_URL}/customer/job/${application.job.id}/pay?applicationId=${applicationId}`;

    // Send SMS to customer with payment link
    if (application.job.customer?.phone) {
      const smsMessage = `🔐 LockSafe UK: ${application.locksmith.name} has accepted your job ${application.job.jobNumber}.

Assessment Fee: £${finalAssessmentFee.toFixed(2)}
Estimated Arrival: ${application.eta} minutes

Please pay the assessment fee to confirm:
${paymentUrl}

Questions? Call us: 0800 123 4567`;

      sendSMS(application.job.customer.phone, smsMessage).catch((err) => {
        console.error("[Locksmith Accept] Failed to send customer SMS:", err);
      });
    }

    // Send email to customer with payment link
    if (application.job.customer?.email) {
      sendCustomerPaymentLinkEmail(application.job.customer.email, {
        customerName: application.job.customer.name,
        jobNumber: application.job.jobNumber,
        locksmithName: application.locksmith.name,
        locksmithCompany: application.locksmith.companyName || undefined,
        assessmentFee: finalAssessmentFee,
        eta: application.eta,
        paymentUrl,
        problemType: formatProblemType(application.job.problemType),
        address: `${application.job.address}, ${application.job.postcode}`,
      }).catch((err) => {
        console.error("[Locksmith Accept] Failed to send customer email:", err);
      });
    }

    // Create in-app notification for customer
    if (application.job.customerId) {
      await createNotification({
        customerId: application.job.customerId,
        jobId: application.job.id,
        type: "locksmith_accepted",
        title: "Locksmith Assigned",
        message: `${application.locksmith.name} has accepted your job ${application.job.jobNumber}. Please pay the assessment fee to confirm.`,
        actionUrl: `/customer/job/${application.job.id}`,
        actionLabel: "Pay Now",
        data: {
          assessmentFee: application.assessmentFee,
          eta: application.eta,
          locksmithName: application.locksmith.name,
        },
      }).catch((err) => {
        console.error("[Locksmith Accept] Failed to create customer notification:", err);
      });
    }

    // Send push notification to customer
    if (application.job.customerId) {
      sendCustomerPushNotification(application.job.customerId, "LOCKSMITH_ASSIGNED", {
        jobId: application.job.id,
        variables: {
          locksmithName: application.locksmith.name,
          eta: `${application.eta} minutes`,
        },
      }).catch((err) => {
        console.error("[Locksmith Accept] Failed to send customer push notification:", err);
      });
    }

    console.log(`[Locksmith Accept] ${application.locksmith.name} accepted admin-assigned job ${application.job.jobNumber}`);

    return NextResponse.json({
      success: true,
      message: `You've accepted job ${application.job.jobNumber}. Customer has been notified to pay the assessment fee.`,
      application: {
        id: updatedApplication.id,
        status: updatedApplication.status,
        assessmentFee: updatedApplication.assessmentFee,
        eta: updatedApplication.eta,
      },
      paymentUrl,
    });
  } catch (error) {
    console.error("[Locksmith Accept] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept job assignment" },
      { status: 500 }
    );
  }
}

// Helper function to format problem types
function formatProblemType(type: string): string {
  const labels: Record<string, string> = {
    lockout: "Locked Out",
    broken: "Broken Lock",
    "key-stuck": "Key Stuck",
    "lost-keys": "Lost Keys",
    burglary: "After Burglary",
    "lock-change": "Lock Change",
    other: "Other Issue",
  };
  return labels[type] || type;
}
