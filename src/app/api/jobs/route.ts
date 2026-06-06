import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { calculateDistanceMiles } from "@/lib/utils";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";
import { notifyNewJob } from "@/lib/telegram";
import { notifyCustomerJobSubmitted, notifyLocksmiths, type JobSMSContext } from "@/lib/sms";
import { generateJobNumber } from "@/lib/job-number";
import { shouldTriggerAuction, createAuction } from "@/lib/job-auction";
import { calculateSurgeFee } from "@/lib/surge-pricing";
import { getJobSourceLabel, getJobSourceType, sourceMatchesFilter, type JobSourceFilter } from "@/lib/job-source";
import { isCoordinatePair, normalizeUkPostcode } from "@/lib/location-display";

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
    // Reject obviously incomplete intake early so the error is meaningful
    const missing: string[] = [];
    if (!body.problemType) missing.push("problemType");
    if (!body.propertyType) missing.push("propertyType");
    if (!body.postcode) missing.push("postcode");
    if (!body.address) missing.push("address");
    if (!body.customerId && !body.phone) missing.push("phone (or customerId)");
    if (!body.customerId && !body.name) missing.push("name (or customerId)");
    if (missing.length) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 },
      );
    }
    const {
      problemType, propertyType, postcode, address, description,
      name, phone, customerId, photos, requestGps, scheduledFor,
      organisationId, propertyId,
      // Marketing attribution — the booking client should pass the
      // visitor's anonymous fingerprint so we can look up their landing
      // session and stamp the originating UTM / gclid onto this Job.
      // Without this, completed-job conversions can never be uploaded
      // back to Google Ads and the auction stays optimised for vanity
      // clicks instead of real jobs.
      visitorId,
      // Optional direct overrides — accept them too in case the client
      // passes UTM straight rather than via session lookup (e.g. landing
      // pages with their own attribution capture).
      utmSource: bodyUtmSource,
      utmMedium: bodyUtmMedium,
      utmCampaign: bodyUtmCampaign,
      utmContent: bodyUtmContent,
      utmTerm: bodyUtmTerm,
      gclid: bodyGclid,
      fbclid: bodyFbclid,
      landingPage: bodyLandingPage,
    } = body;

    if (isCoordinatePair(String(postcode))) {
      return NextResponse.json(
        { success: false, error: "Postcode must be a UK postcode format (e.g., SW1A 1AA), not coordinates." },
        { status: 400 },
      );
    }

    const normalizedPostcode = normalizeUkPostcode(String(postcode));
    if (!normalizedPostcode) {
      return NextResponse.json(
        { success: false, error: "Invalid UK postcode format." },
        { status: 400 },
      );
    }

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
      const coords = await geocodePostcode(normalizedPostcode);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

    // Calculate dynamic assessment fee (org contracted rate overrides surge)
    let contractedRate: number | null = null;
    if (organisationId) {
      const org = await prisma.organisation.findUnique({
        where: { id: organisationId },
        select: { contractedRate: true },
      });
      contractedRate = org?.contractedRate ?? null;
    }
    const surge = contractedRate
      ? { fee: contractedRate, multiplier: 1, reasons: ["Contracted rate"], isSurge: false }
      : await calculateSurgeFee(normalizedPostcode);

    // Resolve marketing attribution — per-field merge of (a) explicit body
    // values + (b) values from the visitor's most-recent UserSession.
    //
    // 2026-06-06 fix: the old logic was all-or-nothing — if ANY body field
    // was set, the session lookup was skipped, even when gclid was missing
    // from the body (e.g. nav-stripped between landing and booking). That
    // matched the diag finding "0 of 9 web jobs have gclid".
    //
    // New logic: for each field, prefer the body value, else fall back to
    // the session value. Same pattern applied to /api/marketing/call-intent
    // earlier in this commit chain.
    let attribution: {
      utmSource?:   string | null;
      utmMedium?:   string | null;
      utmCampaign?: string | null;
      utmContent?:  string | null;
      utmTerm?:     string | null;
      gclid?:       string | null;
      fbclid?:      string | null;
      landingPage?: string | null;
    } = {
      utmSource:   bodyUtmSource   ?? null,
      utmMedium:   bodyUtmMedium   ?? null,
      utmCampaign: bodyUtmCampaign ?? null,
      utmContent:  bodyUtmContent  ?? null,
      utmTerm:     bodyUtmTerm     ?? null,
      gclid:       bodyGclid       ?? null,
      fbclid:      bodyFbclid      ?? null,
      landingPage: bodyLandingPage ?? null,
    };

    if (visitorId) {
      try {
        const { getAttributionForVisitor } = await import("@/lib/marketing/tracker");
        const session = (await getAttributionForVisitor(visitorId)) ?? null;
        if (session) {
          attribution = {
            utmSource:   attribution.utmSource   ?? session.utmSource   ?? null,
            utmMedium:   attribution.utmMedium   ?? session.utmMedium   ?? null,
            utmCampaign: attribution.utmCampaign ?? session.utmCampaign ?? null,
            utmContent:  attribution.utmContent  ?? session.utmContent  ?? null,
            utmTerm:     attribution.utmTerm     ?? session.utmTerm     ?? null,
            gclid:       attribution.gclid       ?? session.gclid       ?? null,
            fbclid:      attribution.fbclid      ?? session.fbclid      ?? null,
            landingPage: attribution.landingPage ?? session.landingPage ?? null,
          };
        }
      } catch (err) {
        console.warn("[jobs] attribution lookup failed:", err instanceof Error ? err.message : err);
      }
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        jobNumber: await generateJobNumber(normalizedPostcode),
        customerId: customerIdToUse,
        problemType,
        propertyType,
        postcode: normalizedPostcode,
        address,
        description,
        assessmentFee: surge.fee,
        // Scheduled booking
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        isScheduled: !!scheduledFor,
        status: scheduledFor ? ("SCHEDULED" as const) : ("PENDING" as const),
        // B2B / Organisation linkage
        organisationId: organisationId ?? null,
        propertyId: propertyId ?? null,
        // Coordinates for radius filtering
        latitude,
        longitude,
        // GPS tracking for anti-fraud protection
        requestGps: requestGps || null,
        // Marketing attribution — captured from session or request body
        // and persisted so the Conversions API uploader can credit the
        // right Google Ads click when this Job becomes paid+complete.
        // Cast through `as any` until `npx prisma generate` picks up the
        // new fields on the Job model.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((attribution as any) ?? {}),
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

    // Check if this job should trigger a descending-clock auction (3+ locksmiths in area)
    shouldTriggerAuction(job.postcode, job.latitude, job.longitude)
      .then(async (eligibleIds) => {
        if (eligibleIds) {
          console.log(`[Auction] Triggering auction for job ${job.jobNumber} — ${eligibleIds.length} eligible locksmiths`);
          await createAuction(job.id, eligibleIds);
        }
      })
      .catch((err) => {
        console.error(`[Auction] Failed to evaluate/create auction:`, err);
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
      if (result.locksmithIds.length > 0) {
        prisma.job.update({
          where: { id: job.id },
          data: { notifiedLocksmithIds: result.locksmithIds },
        }).catch((updateErr) => {
          console.error(`[Job Created] Failed to persist notified locksmith IDs:`, updateErr);
        });
      }
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

    // Wake COO agent immediately for instant dispatch (fire-and-forget)
    if (process.env.AGENTS_ENABLED === "true") {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";
      fetch(`${siteUrl}/api/agents/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
        },
        body: JSON.stringify({ agentId: "coo", reason: "new_job" }),
      }).catch(() => {});
    }

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
      assessmentFee: surge.fee,
      surgePricing: surge.isSurge
        ? { multiplier: surge.multiplier, reasons: surge.reasons }
        : null,
      success: true,
    });
  } catch (error) {
    console.error("Error creating job:", error);
    const detail = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const prismaCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "") || undefined
        : undefined;
    // Always log; expose detail in non-production for faster debugging.
    const expose =
      process.env.VERCEL_ENV !== "production" ||
      process.env.JOB_CREATE_VERBOSE_ERRORS === "true";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create job",
        errorName,
        ...(prismaCode ? { prismaCode } : {}),
        ...(expose ? { detail } : {}),
      },
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
    const sourceTypeParam = searchParams.get("sourceType");

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

    const effectiveSourceFilter: JobSourceFilter =
      sourceTypeParam === "auto" || sourceTypeParam === "normal"
        ? sourceTypeParam
        : availableForLocksmith
          ? "normal"
          : "all";

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

    jobs = jobs.filter((job) =>
      sourceMatchesFilter(getJobSourceType(job.createdVia), effectiveSourceFilter),
    );

    const jobsWithSource = jobs.map((job) => {
      const sourceType = getJobSourceType(job.createdVia);
      return {
        ...job,
        sourceType,
        sourceLabel: getJobSourceLabel(sourceType),
      };
    });

    // Return array directly when filtering by customerId for simpler client handling
    if (customerId) {
      return NextResponse.json(jobsWithSource);
    }

    return NextResponse.json({ success: true, jobs: jobsWithSource });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
