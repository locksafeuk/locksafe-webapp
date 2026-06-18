import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendCustomerCalloutPaymentRequest } from "@/lib/customer-payment-request";

/**
 * POST /api/locksmith/applications/[id]/accept
 *
 * Locksmith accepts an admin-assigned job. This:
 * 1. Updates the application status from "admin_assigned" to "accepted"
 * 2. Sends payment link to customer (for call-out fee)
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

    // Use the chosen assessment fee for the job + notifications.
    const finalAssessmentFee =
      assessmentFee !== undefined && assessmentFee > 0 ? assessmentFee : application.assessmentFee;

    // CRITICAL: actually ASSIGN the job to this locksmith. Previously this
    // endpoint only flipped the application to "accepted" and never touched the
    // Job — so the job stayed PENDING with locksmithId=null. That single
    // omission is why accepted jobs never appeared in the locksmith's active
    // list/history, why the work page showed no action buttons (PENDING →
    // getNextAction → null), and why the customer never got a real assignment.
    // Claim atomically (CAS on PENDING/PHONE_INITIATED) so two locksmiths can't
    // both win. assessmentPaid stays false until the customer actually pays.
    const claim = await prisma.job.updateMany({
      where: {
        id: application.job.id,
        // CAS on status only. Do NOT add `locksmithId: null` — the MongoDB
        // Prisma connector matches that literally and misses jobs whose
        // locksmithId field is simply unset (every fresh job), so the claim
        // would match 0 rows and wrongly 409. status:PENDING is enough to
        // prevent a double-accept (the first accept flips it out of PENDING).
        status: { in: ["PENDING", "PHONE_INITIATED"] },
      },
      data: {
        status: "ACCEPTED",
        locksmithId: application.locksmithId,
        acceptedAt: new Date(),
        acceptedEta: application.eta,
        ...(finalAssessmentFee != null ? { assessmentFee: finalAssessmentFee } : {}),
      },
    });

    if (claim.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Job ${application.job.jobNumber} is no longer available.`,
        },
        { status: 409 }
      );
    }

    // Now mark the application accepted (job is safely assigned above).
    const updateData: any = { status: "accepted" };
    if (assessmentFee !== undefined && assessmentFee > 0) {
      updateData.assessmentFee = assessmentFee;
    }

    const updatedApplication = await prisma.locksmithApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    // Post-acceptance payment request to customer.
    const paymentRequest = await sendCustomerCalloutPaymentRequest({
      jobId: application.job.id,
      jobNumber: application.job.jobNumber,
      applicationId,
      customerId: application.job.customerId,
      customerName: application.job.customer?.name || "Customer",
      customerPhone: application.job.customer?.phone,
      customerEmail: application.job.customer?.email,
      locksmithName: application.locksmith.name,
      locksmithCompany: application.locksmith.companyName,
      assessmentFee: finalAssessmentFee,
      etaMinutes: application.eta,
      problemType: application.job.problemType,
      address: application.job.address,
      postcode: application.job.postcode,
    });

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
      paymentUrl: paymentRequest.paymentUrl,
    });
  } catch (error) {
    console.error("[Locksmith Accept] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept job assignment" },
      { status: 500 }
    );
  }
}
