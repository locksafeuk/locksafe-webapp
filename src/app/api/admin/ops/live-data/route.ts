import { prisma } from "@/lib/db";
import {
  extractUkPostcode,
  isCoordinatePair,
  normalizeUkPostcode,
} from "@/lib/location-display";
import { geocodePostcode } from "@/lib/locksmith-matcher";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

async function geocodeAddressFallback(
  address: string,
  postcode?: string | null,
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const query = [address, postcode, "United Kingdom"]
      .filter(Boolean)
      .join(", ");
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "LockSafe-UK/1.0 (ops-live-map)",
        },
      },
    );
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        latitude: Number.parseFloat(data[0].lat),
        longitude: Number.parseFloat(data[0].lon),
      };
    }
  } catch {
    // best-effort fallback only
  }
  return null;
}

async function requireAdmin(request: NextRequest) {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token");
  if (!authToken) return null;
  const { verifyToken } = await import("@/lib/auth");
  const payload = await verifyToken(authToken.value);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

const ACTIVE_STATUSES = [
  "PHONE_INITIATED",
  "PENDING",
  "SCHEDULED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "DIAGNOSING",
  "QUOTED",
  "QUOTE_ACCEPTED",
  "IN_PROGRESS",
  "PENDING_CUSTOMER_CONFIRMATION",
] as const;

// GET /api/admin/ops/live-data — all active jobs with coordinates + locksmith positions
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [jobs, locksmiths, cancelledRaw] = await Promise.all([
      prisma.job.findMany({
        where: {
          status: {
            in: ACTIVE_STATUSES as unknown as (
              | "PHONE_INITIATED"
              | "PENDING"
              | "SCHEDULED"
              | "ACCEPTED"
              | "EN_ROUTE"
              | "ARRIVED"
              | "DIAGNOSING"
              | "QUOTED"
              | "QUOTE_ACCEPTED"
              | "IN_PROGRESS"
              | "PENDING_CUSTOMER_CONFIRMATION"
            )[],
          },
        },
        select: {
          id: true,
          jobNumber: true,
          status: true,
          problemType: true,
          propertyType: true,
          postcode: true,
          address: true,
          latitude: true,
          longitude: true,
          acceptedAt: true,
          enRouteAt: true,
          arrivedAt: true,
          createdAt: true,
          acceptedEta: true,
          // GPS snapshots
          acceptedGps: true,
          arrivalGps: true,
          locksmith: {
            select: {
              id: true,
              name: true,
              phone: true,
              baseLat: true,
              baseLng: true,
              rating: true,
            },
          },
          customer: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.locksmith.findMany({
        where: {
          baseLat: { not: null },
          baseLng: { not: null },
        },
        select: {
          id: true,
          name: true,
          baseLat: true,
          baseLng: true,
          coverageRadius: true,
          isActive: true,
          isAvailable: true,
          onboardingCompleted: true,
        },
        orderBy: { name: "asc" },
      }),
      // Recently cancelled jobs (last 48h) — surfaced in Live Ops so unmatched
      // demand (e.g. requests where no locksmith was available) stays visible
      // instead of vanishing the moment the job leaves an active status.
      prisma.job.findMany({
        where: {
          status: "CANCELLED",
          createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          jobNumber: true,
          status: true,
          problemType: true,
          propertyType: true,
          postcode: true,
          address: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          customer: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    // Build response with resolved locksmith position
    // For jobs missing lat/lng, geocode from postcode and persist
    const enriched = await Promise.all(
      jobs.map(async (job) => {
        let latitude = job.latitude;
        let longitude = job.longitude;

        if ((!latitude || !longitude) && job.postcode) {
          try {
            const normalizedPostcode =
              (job.postcode && !isCoordinatePair(job.postcode)
                ? normalizeUkPostcode(job.postcode)
                : null) || extractUkPostcode(job.address);
            const coords =
              (normalizedPostcode
                ? await geocodePostcode(normalizedPostcode)
                : null) ??
              (job.address
                ? await geocodeAddressFallback(job.address, normalizedPostcode)
                : null);
            if (coords) {
              latitude = coords.latitude;
              longitude = coords.longitude;
              // Persist so future calls don't need to geocode again
              await prisma.job.update({
                where: { id: job.id },
                data: { latitude, longitude },
              });
            }
          } catch {
            // Geocode failed — job will appear in list without a map pin
          }
        }

        // Determine best locksmith lat/lng for display
        let locksmithLat: number | null = null;
        let locksmithLng: number | null = null;

        if (job.arrivalGps && typeof job.arrivalGps === "object") {
          const gps = job.arrivalGps as { lat?: number; lng?: number };
          locksmithLat = gps.lat ?? null;
          locksmithLng = gps.lng ?? null;
        } else if (job.acceptedGps && typeof job.acceptedGps === "object") {
          const gps = job.acceptedGps as { lat?: number; lng?: number };
          locksmithLat = gps.lat ?? null;
          locksmithLng = gps.lng ?? null;
        } else if (job.locksmith?.baseLat && job.locksmith?.baseLng) {
          locksmithLat = job.locksmith.baseLat;
          locksmithLng = job.locksmith.baseLng;
        }

        return {
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          problemType: job.problemType,
          propertyType: job.propertyType,
          postcode:
            (job.postcode && !isCoordinatePair(job.postcode)
              ? normalizeUkPostcode(job.postcode)
              : null) ||
            extractUkPostcode(job.address) ||
            "Postcode missing",
          address: job.address,
          jobLat: latitude,
          jobLng: longitude,
          createdAt: job.createdAt,
          acceptedAt: job.acceptedAt,
          enRouteAt: job.enRouteAt,
          arrivedAt: job.arrivedAt,
          acceptedEta: job.acceptedEta,
          locksmith: job.locksmith
            ? {
                id: job.locksmith.id,
                name: job.locksmith.name,
                phone: job.locksmith.phone,
                rating: job.locksmith.rating,
                lat: locksmithLat,
                lng: locksmithLng,
              }
            : null,
          customer: job.customer,
        };
      }),
    );

    // Recently cancelled jobs — same shape as active jobs so the client can
    // reuse JobEntry. No geocode/persist here (keeps the 5s poll fast); pins
    // only show when stored coordinates exist, otherwise they list without a pin.
    const recentCancelled = cancelledRaw.map((job) => ({
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      problemType: job.problemType,
      propertyType: job.propertyType,
      postcode:
        (job.postcode && !isCoordinatePair(job.postcode)
          ? normalizeUkPostcode(job.postcode)
          : null) ||
        extractUkPostcode(job.address) ||
        "Postcode missing",
      address: job.address,
      jobLat: job.latitude,
      jobLng: job.longitude,
      createdAt: job.createdAt,
      acceptedAt: null,
      enRouteAt: null,
      arrivedAt: null,
      acceptedEta: null,
      locksmith: null,
      customer: job.customer,
    }));

    // Summary stats
    const stats = {
      total: enriched.length,
      pending: enriched.filter(
        (j) =>
          j.status === "PENDING" ||
          j.status === "PHONE_INITIATED" ||
          j.status === "SCHEDULED",
      ).length,
      enRoute: enriched.filter((j) => j.status === "EN_ROUTE").length,
      onSite: enriched.filter((j) =>
        [
          "ARRIVED",
          "DIAGNOSING",
          "QUOTED",
          "QUOTE_ACCEPTED",
          "IN_PROGRESS",
          "PENDING_CUSTOMER_CONFIRMATION",
        ].includes(j.status),
      ).length,
      accepted: enriched.filter((j) => j.status === "ACCEPTED").length,
      cancelled48h: recentCancelled.length,
    };

    const mappedLocksmiths = locksmiths.map((locksmith) => ({
      id: locksmith.id,
      name: locksmith.name,
      baseLat: locksmith.baseLat,
      baseLng: locksmith.baseLng,
      coverageRadius: locksmith.coverageRadius ?? 10,
      isActive: locksmith.isActive,
      isAvailable: locksmith.isAvailable,
      // Onboarding completeness drives CAMPAIGN eligibility. The Google Ads
      // coverage gate (enforceCoverageGate → computeCoverageMap) only counts
      // locksmiths with onboardingCompleted=true. Surfacing it here keeps the
      // live map honest — otherwise it shows "available" locksmiths the ad
      // engine can't actually dispatch ad-driven jobs to (2026-06-14: 23 of 53
      // active locksmiths were available-on-map but not onboarding-complete).
      onboardingCompleted: locksmith.onboardingCompleted,
      eligibleForAds: locksmith.isActive && locksmith.onboardingCompleted,
    }));

    // Count of locksmiths that look available on the map but are NOT
    // campaign-eligible because onboarding isn't complete.
    const availableNotOnboarded = mappedLocksmiths.filter(
      (l) => l.isActive && l.isAvailable && !l.onboardingCompleted,
    ).length;

    return NextResponse.json({
      success: true,
      jobs: enriched,
      recentCancelled,
      locksmiths: mappedLocksmiths,
      stats: { ...stats, availableNotOnboarded },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/admin/ops/live-data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
