import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { geocodePostcode } from "@/lib/locksmith-matcher";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";

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
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "jobId is required" },
        { status: 400 }
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
