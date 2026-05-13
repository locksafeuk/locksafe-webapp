import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

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
  "PENDING",
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
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ACTIVE_STATUSES as unknown as ("PENDING" | "ACCEPTED" | "EN_ROUTE" | "ARRIVED" | "DIAGNOSING" | "QUOTED" | "QUOTE_ACCEPTED" | "IN_PROGRESS" | "PENDING_CUSTOMER_CONFIRMATION")[] },
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
    });

    // Build response with resolved locksmith position
    const enriched = jobs.map((job) => {
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
        postcode: job.postcode,
        address: job.address,
        jobLat: job.latitude,
        jobLng: job.longitude,
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
    });

    // Summary stats
    const stats = {
      total: enriched.length,
      pending: enriched.filter((j) => j.status === "PENDING").length,
      enRoute: enriched.filter((j) => j.status === "EN_ROUTE").length,
      onSite: enriched.filter((j) =>
        ["ARRIVED", "DIAGNOSING", "QUOTED", "QUOTE_ACCEPTED", "IN_PROGRESS", "PENDING_CUSTOMER_CONFIRMATION"].includes(j.status)
      ).length,
      accepted: enriched.filter((j) => j.status === "ACCEPTED").length,
    };

    return NextResponse.json({ success: true, jobs: enriched, stats, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("GET /api/admin/ops/live-data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
