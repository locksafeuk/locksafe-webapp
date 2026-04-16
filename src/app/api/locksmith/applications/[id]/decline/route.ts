import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { notifyLocksmithDeclinedAssignment } from "@/lib/telegram";

/**
 * POST /api/locksmith/applications/[id]/decline
 *
 * Locksmith declines an admin-assigned job. This:
 * 1. Updates the application status from "admin_assigned" to "declined"
 * 2. Notifies admin via Telegram
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;
    const body = await request.json();
    const { reason } = body; // Optional decline reason

    // Get the application
    const application = await prisma.locksmithApplication.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
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
          error: `Application cannot be declined (status: ${application.status})`
        },
        { status: 409 }
      );
    }

    // Update application status to "declined"
    const updatedApplication = await prisma.locksmithApplication.update({
      where: { id: applicationId },
      data: {
        status: "declined",
        message: reason || "Declined by locksmith",
      },
    });

    // Notify admin via Telegram
    notifyLocksmithDeclinedAssignment({
      jobNumber: application.job.jobNumber,
      jobId: application.job.id,
      locksmithName: application.locksmith.name,
      locksmithPhone: application.locksmith.phone || "",
      postcode: application.job.postcode,
      problemType: application.job.problemType,
      reason: reason || "No reason provided",
    }).catch((err) => {
      console.error("[Locksmith Decline] Failed to send Telegram notification:", err);
    });

    console.log(`[Locksmith Decline] ${application.locksmith.name} declined admin-assigned job ${application.job.jobNumber}`);

    return NextResponse.json({
      success: true,
      message: `You've declined job ${application.job.jobNumber}. Admin has been notified.`,
      application: {
        id: updatedApplication.id,
        status: updatedApplication.status,
      },
    });
  } catch (error) {
    console.error("[Locksmith Decline] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to decline job assignment" },
      { status: 500 }
    );
  }
}
