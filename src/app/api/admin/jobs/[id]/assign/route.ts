import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";
import { sendLocksmithAssignmentEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { sendLocksmithPushNotification } from "@/lib/job-notifications";
import { SITE_URL } from "@/lib/config";

// Verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

/**
 * POST /api/admin/jobs/[id]/assign
 *
 * Admin assigns a locksmith to a job. This:
 * 1. Creates a LocksmithApplication with status "admin_assigned"
 * 2. Sends SMS notification to the locksmith
 * 3. Sends email notification to the locksmith
 * 4. Sends push notification to the locksmith
 *
 * The locksmith must then accept or decline the assignment.
 * If they accept, they confirm the assessment fee and it follows the normal apply flow.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;
    const body = await request.json();
    const { locksmithId } = body;

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "locksmithId is required" },
        { status: 400 }
      );
    }

    // Get the job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        locksmith: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Check if job is in a valid state for assignment
    if (job.status !== "PENDING" && job.status !== "PHONE_INITIATED") {
      return NextResponse.json(
        {
          success: false,
          error: `Job ${job.jobNumber} cannot be assigned (status: ${job.status})`
        },
        { status: 409 }
      );
    }

    // Get the locksmith
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Check for existing application
    const existingApplication = await prisma.locksmithApplication.findUnique({
      where: {
        jobId_locksmithId: {
          jobId,
          locksmithId,
        },
      },
    });

    if (existingApplication) {
      return NextResponse.json(
        {
          success: false,
          error: `${locksmith.name} already has an application for this job`
        },
        { status: 409 }
      );
    }

    // Create the LocksmithApplication with admin_assigned status
    const defaultFee = locksmith.defaultAssessmentFee || 29.00;

    const application = await prisma.locksmithApplication.create({
      data: {
        jobId,
        locksmithId,
        assessmentFee: defaultFee,
        eta: 30, // Default 30 minutes
        status: "admin_assigned", // Special status for admin-assigned jobs
        message: "Assigned by admin",
      },
    });

    // Build job details URL
    const jobDetailsUrl = `${SITE_URL}/locksmith/job/${jobId}`;

    // Send SMS notification to locksmith
    if (locksmith.phone && locksmith.smsNotifications !== false) {
      const smsMessage = `🔔 LockSafe UK: You've been assigned a new job!

Job: ${job.jobNumber}
Type: ${formatProblemType(job.problemType)}
Location: ${job.postcode}
Assessment Fee: £${defaultFee.toFixed(2)}

Please accept or decline this job:
${jobDetailsUrl}

Reply STOP to opt out.`;

      sendSMS(locksmith.phone, smsMessage).catch((err) => {
        console.error("[Admin Assign] Failed to send SMS:", err);
      });
    }

    // Send email notification to locksmith
    if (locksmith.email && locksmith.emailNotifications !== false) {
      sendLocksmithAssignmentEmail(locksmith.email, {
        locksmithName: locksmith.name,
        jobNumber: job.jobNumber,
        problemType: formatProblemType(job.problemType),
        propertyType: job.propertyType,
        postcode: job.postcode,
        address: job.address,
        customerName: job.customer?.name || "Customer",
        defaultAssessmentFee: defaultFee,
        jobDetailsUrl,
      }).catch((err) => {
        console.error("[Admin Assign] Failed to send email:", err);
      });
    }

    // Create in-app notification
    await createNotification({
      locksmithId,
      jobId,
      type: "job_assigned",
      title: "New Job Assignment",
      message: `You've been assigned job ${job.jobNumber} - ${formatProblemType(job.problemType)} in ${job.postcode}. Please accept or decline.`,
      actionUrl: `/locksmith/job/${jobId}`,
      actionLabel: "View Job",
      data: {
        assessmentFee: defaultFee,
        problemType: job.problemType,
        postcode: job.postcode,
      },
    }).catch((err) => {
      console.error("[Admin Assign] Failed to create notification:", err);
    });

    // Send push notification
    if (locksmith.pushNotifications !== false) {
      sendLocksmithPushNotification(locksmithId, "JOB_ASSIGNED", {
        jobId,
        variables: {
          jobNumber: job.jobNumber,
          problemType: formatProblemType(job.problemType),
          postcode: job.postcode,
        },
      }).catch((err) => {
        console.error("[Admin Assign] Failed to send push notification:", err);
      });
    }

    console.log(`[Admin Assign] Admin assigned locksmith ${locksmith.name} to job ${job.jobNumber}`);

    return NextResponse.json({
      success: true,
      message: `${locksmith.name} has been notified about job ${job.jobNumber}. They must accept or decline.`,
      application: {
        id: application.id,
        status: application.status,
        assessmentFee: application.assessmentFee,
        eta: application.eta,
      },
      notifications: {
        sms: locksmith.smsNotifications !== false,
        email: locksmith.emailNotifications !== false,
        push: locksmith.pushNotifications !== false,
      },
    });
  } catch (error) {
    console.error("[Admin Assign] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to assign locksmith" },
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
