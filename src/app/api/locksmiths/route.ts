import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/locksmiths - List all locksmiths with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const verified = searchParams.get("verified");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};

    // Search by name, email, or company
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by verification status
    if (verified === "true") {
      where.isVerified = true;
    } else if (verified === "false") {
      where.isVerified = false;
    }

    // Filter by active status
    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const locksmiths = await prisma.locksmith.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        profileImage: true,
        rating: true,
        totalJobs: true,
        totalEarnings: true,
        isVerified: true,
        isActive: true,
        stripeConnectId: true,
        stripeConnectOnboarded: true,
        stripeConnectVerified: true,
        yearsExperience: true,
        services: true,
        coverageAreas: true,
        baseLat: true,
        baseLng: true,
        baseAddress: true,
        coverageRadius: true,
        createdAt: true,
        // Documentation fields
        insuranceDocumentUrl: true,
        certificationDocumentUrl: true,
        additionalDocumentUrls: true,
        documentationUploadedAt: true,
        onboardingCompleted: true,
        termsAcceptedAt: true,
        // Insurance expiry tracking
        insuranceExpiryDate: true,
        insuranceVerifiedAt: true,
        insuranceVerifiedById: true,
        insuranceStatus: true,
        // Profile photo AI verification
        profilePhotoVerified: true,
        profilePhotoVerifiedAt: true,
        profilePhotoRejectionReason: true,
        profilePhotoAiConfidence: true,
        // Availability status
        isAvailable: true,
        lastAvailabilityChange: true,
        scheduleEnabled: true,
        scheduleStartTime: true,
        scheduleEndTime: true,
        scheduleDays: true,
        // Mobile app platform (set by native push-token registration)
        nativeTokenPlatform: true,
        nativeTokenRegisteredAt: true,
        // PWA web-push metadata (safe for admin UI)
        webPushPlatform: true,
        webPushRegisteredAt: true,
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      locksmiths: locksmiths.map((ls) => ({
        ...ls,
        reviewCount: ls._count.reviews,
        _count: undefined,
        onPwa: !!ls.webPushRegisteredAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching locksmiths:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch locksmiths" },
      { status: 500 }
    );
  }
}
