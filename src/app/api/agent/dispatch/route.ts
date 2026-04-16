/**
 * Agent API: Dispatch Endpoint
 *
 * GET /api/agent/dispatch?jobId=xxx - Find best locksmiths for a job
 * POST /api/agent/dispatch - Auto-dispatch a job to a locksmith
 *
 * Uses the intelligent dispatch algorithm to match jobs with locksmiths.
 */

import { verifyApiKey } from "@/lib/agent-auth";
import prisma from "@/lib/db";
import {
  autoDispatchJob,
  checkCoverage,
  findBestLocksmiths,
} from "@/lib/intelligent-dispatch";
import {
  sendJobNotificationEmail,
  sendJobNotificationSMS,
} from "@/lib/job-notifications";
import { notifyLocksmithApplication } from "@/lib/telegram";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Verify authentication
  const auth = verifyApiKey(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const maxCandidates = Number.parseInt(
      searchParams.get("maxCandidates") || "5",
    );

    // If coordinates provided, check coverage
    if (lat && lng) {
      const coverage = await checkCoverage(
        Number.parseFloat(lat),
        Number.parseFloat(lng),
      );
      return NextResponse.json({
        success: true,
        coverage,
      });
    }

    // If job ID provided, find best locksmiths
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "jobId or lat/lng required" },
        { status: 400 },
      );
    }

    const result = await findBestLocksmiths(jobId, maxCandidates);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Agent API] Error in dispatch:", error);
    return NextResponse.json(
      { success: false, error: "Failed to find locksmiths" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  // Verify authentication
  const auth = verifyApiKey(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      jobId,
      locksmithId,
      assessmentFee,
      etaMinutes,
      notifyLocksmith = true,
    } = body;

    // Validate required fields
    if (!jobId || !locksmithId) {
      return NextResponse.json(
        { success: false, error: "jobId and locksmithId are required" },
        { status: 400 },
      );
    }

    // Get job and locksmith details for notifications
    const [job, locksmith] = await Promise.all([
      prisma.job.findUnique({
        where: { id: jobId },
        include: { customer: true },
      }),
      prisma.locksmith.findUnique({
        where: { id: locksmithId },
      }),
    ]);

    if (!job || !locksmith) {
      return NextResponse.json(
        { success: false, error: "Job or locksmith not found" },
        { status: 404 },
      );
    }

    // Check if locksmith has set their assessment fee
    if (!locksmith.defaultAssessmentFee || locksmith.defaultAssessmentFee <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Locksmith has not set their assessment fee. They must configure this in their settings to be eligible for auto-dispatch.",
        },
        { status: 400 },
      );
    }

    // Use locksmith's default assessment fee (this is the key change - use locksmith's fee, not job default)
    const fee = assessmentFee || locksmith.defaultAssessmentFee;
    const eta = etaMinutes || 20;

    // Auto-dispatch the job
    const result = await autoDispatchJob(jobId, locksmithId, fee, eta);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 },
      );
    }

    // Send notifications if requested
    if (notifyLocksmith) {
      // Notify locksmith via SMS
      if (locksmith.smsNotifications) {
        try {
          await sendJobNotificationSMS({
            locksmithPhone: locksmith.phone,
            locksmithName: locksmith.name,
            jobNumber: job.jobNumber,
            jobId: job.id,
            problemType: job.problemType,
            propertyType: job.propertyType,
            postcode: job.postcode,
            address: job.address,
            customerName: job.customer?.name || "Customer",
            isAutoDispatch: true,
          });
        } catch (e) {
          console.error("[Agent Dispatch] Failed to send SMS:", e);
        }
      }

      // Notify locksmith via email
      if (locksmith.emailNotifications && locksmith.email) {
        try {
          await sendJobNotificationEmail({
            locksmithEmail: locksmith.email,
            locksmithName: locksmith.name,
            jobNumber: job.jobNumber,
            jobId: job.id,
            problemType: job.problemType,
            propertyType: job.propertyType,
            postcode: job.postcode,
            address: job.address,
            customerName: job.customer?.name || "Customer",
            assessmentFee: fee,
            isAutoDispatch: true,
          });
        } catch (e) {
          console.error("[Agent Dispatch] Failed to send email:", e);
        }
      }

      // Send Telegram notification
      try {
        await notifyLocksmithApplication({
          jobNumber: job.jobNumber,
          jobId: job.id,
          locksmithName: locksmith.name,
          locksmithCompany: locksmith.companyName,
          locksmithPhone: locksmith.phone,
          customerName: job.customer?.name || "Customer",
          estimatedArrival: `${eta} mins (auto-dispatched)`,
        });
      } catch (e) {
        console.error("[Agent Dispatch] Failed to send Telegram:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      applicationId: result.applicationId,
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
      },
      locksmith: {
        id: locksmith.id,
        name: locksmith.name,
      },
      dispatch: {
        assessmentFee: fee,
        etaMinutes: eta,
        notificationsSent: notifyLocksmith,
      },
    });
  } catch (error) {
    console.error("[Agent API] Error in dispatch:", error);
    return NextResponse.json(
      { success: false, error: "Failed to dispatch job" },
      { status: 500 },
    );
  }
}
