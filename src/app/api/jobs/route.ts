import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { calculateDistanceMiles } from "@/lib/utils";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";
import { notifyNewJob } from "@/lib/telegram";
import { notifyCustomerJobSubmitted, notifyLocksmiths, type JobSMSContext } from "@/lib/sms";
import { generateJobNumber } from "@/lib/job-number";

// Geocode postcode to coordinates
async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)},UK&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "LockSafe-UK/1.0",
        },
      }
    );
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: Number.parseFloat(data[0].lat),
        lng: Number.parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// POST - Create new job request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problemType, propertyType, postcode, address, description, name, phone, customerId, photos, requestGps } = body;

    let customerIdToUse = customerId;

    // If no customerId provided, create or find customer by phone
    if (!customerIdToUse) {
      let customer = await prisma.customer.findFirst({
        where: { phone },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name,
            phone,
          },
        });
      }
      customerIdToUse = customer.id;
    }

    // Geocode the postcode to get coordinates for radius filtering
    let latitude: number | null = null;
    let longitude: number | null = null;

    // First try to use GPS from request if available
    if (requestGps?.lat && requestGps?.lng) {
      latitude = requestGps.lat;
      longitude = requestGps.lng;
    } else {
      // Geocode the postcode
      const coords = await geocodePostcode(postcode);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        jobNumber: await generateJobNumber(postcode),
        customerId: customerIdToUse,
        problemType,
        propertyType,
        postcode: postcode.toUpperCase(),
        address,
        description,
        assessmentFee: 29.0,
        // Coordinates for radius filtering
        latitude,
        longitude,
        // GPS tracking for anti-fraud protection
        requestGps: requestGps || null,
        // Create photo records if provided
        photos: photos && photos.length > 0 ? {
          create: photos.map((url: string) => ({
            url,
            type: "BEFORE" as const, // Customer-uploaded photos are "before" photos
            caption: "Customer uploaded photo",
          })),
        } : undefined,
      },
      include: {
        customer: true,
        photos: true,
      },
    });

    // Notify nearby locksmiths about the new job (async, don't await)
    // This sends both real-time SSE notifications and email notifications
    notifyNearbyLocksmiths({
      id: job.id,
      jobNumber: job.jobNumber,
      problemType: job.problemType,
      propertyType: job.propertyType,
      postcode: job.postcode,
      address: job.address,
      latitude: job.latitude,
      longitude: job.longitude,
      createdAt: job.createdAt.toISOString(),
    }).then((result) => {
      console.log(`[Job Created] Notified ${result.notifiedCount} locksmiths about job ${job.jobNumber} (SSE + Email)`);
    }).catch((err) => {
      console.error(`[Job Created] Failed to notify locksmiths:`, err);
    });

    // Send Telegram notification for new job (non-blocking)
    notifyNewJob({
      jobNumber: job.jobNumber,
      jobId: job.id,
      customerName: job.customer?.name || name || "Unknown",
      customerPhone: job.customer?.phone || phone || "",
      problemType: job.problemType,
      propertyType: job.propertyType,
      postcode: job.postcode,
      address: job.address,
      description: job.description,
      isUrgent: job.problemType.toLowerCase().includes("lockout") || job.problemType.toLowerCase().includes("emergency"),
    }).catch((err) => {
      console.error(`[Job Created] Failed to send Telegram notification:`, err);
    });

    // Send SMS notification to customer confirming job submission
    if (job.customer?.phone) {
      const smsContext: JobSMSContext = {
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerName: job.customer.name,
        customerPhone: job.customer.phone,
        problemType: job.problemType,
        postcode: job.postcode,
        address: job.address,
      };
      notifyCustomerJobSubmitted(smsContext).catch((err) =>
        console.error(`[SMS] Failed to send job submitted notification:`, err)
      );
    }

    // Send SMS to nearby locksmiths about the new job
    if (latitude && longitude) {
      // Find nearby locksmiths (within 15 miles)
      const allLocksmiths = await prisma.locksmith.findMany({
        where: {
          isVerified: true,
          baseLat: { not: null },
          baseLng: { not: null },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          baseLat: true,
          baseLng: true,
          coverageRadius: true,
          smsNotifications: true, // Check if they want SMS notifications
        },
      });

      const nearbyLocksmiths = allLocksmiths.filter((locksmith) => {
        if (!locksmith.baseLat || !locksmith.baseLng) return false;
        // Check if locksmith opted in for SMS notifications
        if (locksmith.smsNotifications === false) return false;

        const distance = calculateDistanceMiles(
          latitude,
          longitude,
          locksmith.baseLat,
          locksmith.baseLng
        );
        const maxRadius = locksmith.coverageRadius || 15;
        return distance <= maxRadius;
      });

      if (nearbyLocksmiths.length > 0) {
        const locksmithsToNotify = nearbyLocksmiths
          .filter((l) => l.phone)
          .map((l) => ({ phone: l.phone!, name: l.name }));

        notifyLocksmiths(locksmithsToNotify, {
          jobId: job.id,
          jobNumber: job.jobNumber,
          customerName: job.customer?.name || name || "Customer",
          customerPhone: job.customer?.phone || phone || "",
          problemType: job.problemType,
          postcode: job.postcode,
          address: job.address,
        }).then((result) => {
          console.log(`[SMS] Notified ${result.sent} locksmiths about job ${job.jobNumber} (${result.failed} failed)`);
        }).catch((err) => {
          console.error(`[SMS] Failed to notify locksmiths:`, err);
        });
      }
    }

    return NextResponse.json({
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      photoCount: job.photos.length,
      success: true,
    });
  } catch (error) {
    console.error("Error creating job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create job" },
      { status: 500 }
    );
  }
}

// GET - Fetch jobs (with filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const locksmithId = searchParams.get("locksmithId");
    const customerId = searchParams.get("customerId");
    const postcode = searchParams.get("postcode");
    const availableForLocksmith = searchParams.get("availableForLocksmith"); // New param for radius filtering

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (locksmithId) {
      where.locksmithId = locksmithId;
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (postcode) {
      where.postcode = { startsWith: postcode.substring(0, 3).toUpperCase() };
    }

    let jobs = await prisma.job.findMany({
      where,
      include: {
        customer: true,
        locksmith: true,
        quote: true,
        _count: {
          select: { applications: true }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If fetching available jobs for a locksmith, filter by their coverage radius
    if (availableForLocksmith) {
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: availableForLocksmith },
        select: {
          baseLat: true,
          baseLng: true,
          coverageRadius: true,
        },
      });

      if (locksmith?.baseLat && locksmith?.baseLng) {
        const coverageRadius = locksmith.coverageRadius || 10;

        // Filter jobs to only those within the locksmith's coverage radius
        jobs = jobs.filter((job) => {
          // If job doesn't have coordinates, try to include it (legacy support)
          if (!job.latitude || !job.longitude) {
            return true; // Include jobs without coordinates for now
          }

          const distance = calculateDistanceMiles(
            locksmith.baseLat!,
            locksmith.baseLng!,
            job.latitude,
            job.longitude
          );

          return distance <= coverageRadius;
        });

        // Add distance to each job for display
        jobs = jobs.map((job) => {
          if (job.latitude && job.longitude) {
            const distance = calculateDistanceMiles(
              locksmith.baseLat!,
              locksmith.baseLng!,
              job.latitude,
              job.longitude
            );
            return { ...job, distanceMiles: Math.round(distance * 10) / 10 };
          }
          return { ...job, distanceMiles: null };
        });

        // Sort by distance (closest first)
        jobs.sort((a: any, b: any) => {
          if (a.distanceMiles === null) return 1;
          if (b.distanceMiles === null) return -1;
          return a.distanceMiles - b.distanceMiles;
        });
      }
    }

    // Return array directly when filtering by customerId for simpler client handling
    if (customerId) {
      return NextResponse.json(jobs);
    }

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
