import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token
    let decoded: { id: string; type: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { id: string; type: string };
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    if (decoded.type !== "locksmith") {
      return NextResponse.json(
        { success: false, error: "Not a locksmith account" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      locksmithId,
      insuranceDocumentUrl,
      insuranceExpiryDate,
      certificationDocumentUrl,
      additionalDocumentUrls,
      profilePhotoUrl,
    } = body;

    // Verify the locksmith ID matches the token
    if (locksmithId !== decoded.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Validate that profile photo is provided (required)
    if (!profilePhotoUrl) {
      return NextResponse.json(
        { success: false, error: "Profile photo is required" },
        { status: 400 }
      );
    }

    // Validate that insurance document is provided (required)
    if (!insuranceDocumentUrl) {
      return NextResponse.json(
        { success: false, error: "Insurance document is required" },
        { status: 400 }
      );
    }

    // Validate that insurance expiry date is provided (required)
    if (!insuranceExpiryDate) {
      return NextResponse.json(
        { success: false, error: "Insurance expiry date is required" },
        { status: 400 }
      );
    }

    // Parse the expiry date and determine status
    const expiryDate = new Date(insuranceExpiryDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    let insuranceStatus = "pending"; // Default - needs admin verification
    if (expiryDate < now) {
      insuranceStatus = "expired";
    } else if (expiryDate <= thirtyDaysFromNow) {
      insuranceStatus = "expiring_soon";
    }

    // Update locksmith with terms acceptance, documents, and profile photo
    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        termsAcceptedAt: new Date(),
        onboardingCompleted: true,
        profileImage: profilePhotoUrl,
        insuranceDocumentUrl,
        insuranceExpiryDate: expiryDate,
        insuranceStatus,
        certificationDocumentUrl: certificationDocumentUrl || null,
        additionalDocumentUrls: additionalDocumentUrls || [],
        documentationUploadedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Terms accepted and documents uploaded successfully",
      locksmith: {
        id: locksmith.id,
        termsAcceptedAt: locksmith.termsAcceptedAt,
        onboardingCompleted: locksmith.onboardingCompleted,
        profileImage: locksmith.profileImage,
        insuranceDocumentUrl: locksmith.insuranceDocumentUrl,
        insuranceExpiryDate: locksmith.insuranceExpiryDate,
        insuranceStatus: locksmith.insuranceStatus,
        certificationDocumentUrl: locksmith.certificationDocumentUrl,
        additionalDocumentUrls: locksmith.additionalDocumentUrls,
        documentationUploadedAt: locksmith.documentationUploadedAt,
      },
    });
  } catch (error) {
    console.error("Error accepting terms:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept terms" },
      { status: 500 }
    );
  }
}
