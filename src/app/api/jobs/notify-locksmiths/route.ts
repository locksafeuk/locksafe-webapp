import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  findNearbyLocksmiths,
  notifyLocksmitheEmergency,
  geocodePostcode,
} from "@/lib/locksmith-matcher";

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

    // Fetch job with customer
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
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

    // Find nearby locksmiths
    const nearbyLocksmiths = await findNearbyLocksmiths(latitude, longitude, {
      sortBy: "distance",
    });

    if (nearbyLocksmiths.length === 0) {
      return NextResponse.json({
        success: true,
        notifiedCount: 0,
        locksmithIds: [],
        locksmiths: [],
        message: "No locksmiths found within range",
      });
    }

    // Notify them
    const result = await notifyLocksmitheEmergency({
      locksmiths: nearbyLocksmiths,
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        problemType: job.problemType,
        propertyType: job.propertyType,
        postcode: job.postcode,
        address: job.address,
        customerName: job.customer.name,
        isEmergency: job.isEmergency,
      },
    });

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
      locksmiths: nearbyLocksmiths.map((ls) => ({
        id: ls.id,
        name: ls.name,
        distance: ls.distance,
        rating: ls.rating,
        defaultAssessmentFee: ls.defaultAssessmentFee,
      })),
    });
  } catch (error) {
    console.error("[API] Notify locksmiths error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to notify locksmiths" },
      { status: 500 }
    );
  }
}
