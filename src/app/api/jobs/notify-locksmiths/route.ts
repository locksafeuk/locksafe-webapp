import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { geocodePostcode } from "@/lib/locksmith-matcher";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";
import { requireAdminFromCookies } from "@/lib/agent-api-auth";

/**
 * POST /api/jobs/notify-locksmiths
 *
 * Manually trigger locksmith notifications for a job.
 * Used by admin or called automatically after job creation.
 *
 * Input: { jobId: string }
 * Returns: { notifiedCount, locksmithIds, locksmiths }
 */
export async function POST(request: NextRequest) {
  // Admin-only: this endpoint can blast SMS/push to locksmiths, so it must
  // never be publicly callable. (Surfaced by scripts/system-full-test.ts.)
  const admin = await requireAdminFromCookies();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { jobId } = body as { jobId?: string };

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { success: false, error: "jobId is required" },
        { status: 400 }
      );
    }

    // Mongo ObjectIds are 24 hex chars — guard against Prisma throwing on
    // malformed input so we return a clean 404 instead of a 500.
    if (!/^[a-f0-9]{24}$/i.test(jobId)) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Fetch job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Get coordinates
    let latitude = job.latitude;
    let longitude = job.longitude;

    if (!latitude || !longitude) {
      const coords = await geocodePostcode(job.postcode);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;

        // Update job coordinates
        await prisma.job.update({
          where: { id: jobId },
          data: { latitude, longitude },
        });
      }
    }

    if (!latitude || !longitude) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot determine job location - postcode geocoding failed",
        },
        { status: 400 }
      );
    }

    // Notify nearby locksmiths (SMS + email + native APNs/FCM push)
    const result = await notifyNearbyLocksmiths({
      id: job.id,
      jobNumber: job.jobNumber,
      problemType: job.problemType,
      propertyType: job.propertyType ?? undefined,
      postcode: job.postcode,
      address: job.address,
      latitude,
      longitude,
      createdAt: job.createdAt.toISOString(),
    });

    if (result.notifiedCount === 0) {
      return NextResponse.json({
        success: true,
        notifiedCount: 0,
        locksmithIds: [],
        locksmiths: [],
        message: "No locksmiths found within range",
      });
    }

    // Update job with notified locksmiths
    await prisma.job.update({
      where: { id: jobId },
      data: {
        notifiedLocksmithIds: result.locksmithIds,
        notifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      notifiedCount: result.notifiedCount,
      locksmithIds: result.locksmithIds,
    });
  } catch (error) {
    console.error("[API] Notify locksmiths error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to notify locksmiths" },
      { status: 500 }
    );
  }
}
