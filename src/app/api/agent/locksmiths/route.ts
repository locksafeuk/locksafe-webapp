/**
 * Agent API: Locksmiths Endpoint
 *
 * GET /api/agent/locksmiths - List locksmiths with filters
 * PATCH /api/agent/locksmiths - Update locksmith availability
 *
 * Query params:
 * - available: Filter by availability (true/false)
 * - verified: Filter by verification status (true/false)
 * - postcode: Filter by coverage area
 * - insuranceExpiring: Show only locksmiths with expiring insurance
 * - limit: Number of results (default 20, max 100)
 */

import { verifyApiKey } from "@/lib/agent-auth";
import prisma from "@/lib/db";
import { findNearbyLocksmiths } from "@/lib/intelligent-dispatch";
import { type NextRequest, NextResponse } from "next/server";

// Geocoding function (simplified - in production use a proper geocoding API)
async function postcodeToCoords(
  postcode: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    // Use postcodes.io for UK postcodes
    const cleanPostcode = postcode.replace(/\s+/g, "").toUpperCase();
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${cleanPostcode}`,
    );
    const data = await response.json();

    if (data.status === 200 && data.result) {
      return {
        lat: data.result.latitude,
        lng: data.result.longitude,
      };
    }
    return null;
  } catch {
    return null;
  }
}

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

    // Parse filters
    const available = searchParams.get("available");
    const verified = searchParams.get("verified");
    const postcode = searchParams.get("postcode");
    const insuranceExpiring = searchParams.get("insuranceExpiring") === "true";
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") || "20"),
      100,
    );
    const skip = Number.parseInt(searchParams.get("skip") || "0");

    // If postcode is provided, use nearby search
    if (postcode) {
      const coords = await postcodeToCoords(postcode);
      if (!coords) {
        return NextResponse.json(
          { success: false, error: "Invalid postcode" },
          { status: 400 },
        );
      }

      const nearby = await findNearbyLocksmiths(coords.lat, coords.lng, 15);

      // Apply additional filters
      let filtered = nearby;
      if (available !== null) {
        const isAvailable = available === "true";
        filtered = filtered.filter((ls) => ls.isAvailable === isAvailable);
      }

      return NextResponse.json({
        success: true,
        locksmiths: filtered.slice(skip, skip + limit).map((ls) => ({
          ...ls,
          distanceMiles: Math.round(ls.distanceMiles * 10) / 10,
        })),
        searchLocation: { postcode, ...coords },
        total: filtered.length,
      });
    }

    // Build where clause for general query
    // biome-ignore lint/suspicious/noExplicitAny: dynamic query building
    const where: any = {
      isActive: true,
    };

    if (available !== null) {
      where.isAvailable = available === "true";
    }

    if (verified !== null) {
      where.isVerified = verified === "true";
    }

    if (insuranceExpiring) {
      // Insurance expiring in next 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      where.insuranceExpiryDate = {
        lte: sevenDaysFromNow,
        gte: new Date(),
      };
    }

    // Fetch locksmiths
    const [locksmiths, total] = await Promise.all([
      prisma.locksmith.findMany({
        where,
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          phone: true,
          rating: true,
          totalJobs: true,
          totalEarnings: true,
          isVerified: true,
          isAvailable: true,
          baseAddress: true,
          coverageRadius: true,
          stripeConnectOnboarded: true,
          insuranceExpiryDate: true,
          insuranceStatus: true,
          lastAvailabilityChange: true,
          _count: {
            select: {
              jobs: {
                where: {
                  status: {
                    notIn: ["CANCELLED", "SIGNED", "COMPLETED"],
                  },
                },
              },
            },
          },
        },
        orderBy: [{ isAvailable: "desc" }, { rating: "desc" }],
        take: limit,
        skip,
      }),
      prisma.locksmith.count({ where }),
    ]);

    // Format response
    const formattedLocksmiths = locksmiths.map((ls) => ({
      id: ls.id,
      name: ls.name,
      companyName: ls.companyName,
      email: ls.email,
      phone: ls.phone,
      rating: ls.rating,
      totalJobs: ls.totalJobs,
      totalEarnings: ls.totalEarnings,
      isVerified: ls.isVerified,
      isAvailable: ls.isAvailable,
      baseAddress: ls.baseAddress,
      coverageRadius: ls.coverageRadius,
      stripeConnected: ls.stripeConnectOnboarded,
      activeJobCount: ls._count.jobs,
      insurance: {
        expiryDate: ls.insuranceExpiryDate,
        status: ls.insuranceStatus,
        daysUntilExpiry: ls.insuranceExpiryDate
          ? Math.ceil(
              (new Date(ls.insuranceExpiryDate).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
      },
      lastAvailabilityChange: ls.lastAvailabilityChange,
    }));

    return NextResponse.json({
      success: true,
      locksmiths: formattedLocksmiths,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error("[Agent API] Error fetching locksmiths:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch locksmiths" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const { locksmithId, isAvailable } = body;

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "locksmithId is required" },
        { status: 400 },
      );
    }

    if (typeof isAvailable !== "boolean") {
      return NextResponse.json(
        { success: false, error: "isAvailable must be a boolean" },
        { status: 400 },
      );
    }

    // Update locksmith availability
    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        isAvailable,
        lastAvailabilityChange: new Date(),
      },
      select: {
        id: true,
        name: true,
        isAvailable: true,
        lastAvailabilityChange: true,
      },
    });

    return NextResponse.json({
      success: true,
      locksmith,
      message: `${locksmith.name} is now ${isAvailable ? "available" : "offline"}`,
    });
  } catch (error) {
    console.error("[Agent API] Error updating locksmith:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update locksmith" },
      { status: 500 },
    );
  }
}
