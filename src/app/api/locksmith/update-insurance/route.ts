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
    const { locksmithId, insuranceDocumentUrl, insuranceExpiryDate } = body;

    // Verify the locksmith ID matches the token
    if (locksmithId !== decoded.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!insuranceDocumentUrl) {
      return NextResponse.json(
        { success: false, error: "Insurance document is required" },
        { status: 400 }
      );
    }

    if (!insuranceExpiryDate) {
      return NextResponse.json(
        { success: false, error: "Insurance expiry date is required" },
        { status: 400 }
      );
    }

    // Parse and validate the expiry date
    const expiryDate = new Date(insuranceExpiryDate);
    const now = new Date();

    if (expiryDate <= now) {
      return NextResponse.json(
        { success: false, error: "Insurance expiry date must be in the future" },
        { status: 400 }
      );
    }

    // Calculate insurance status
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    let insuranceStatus = "pending"; // Needs admin verification again
    if (expiryDate <= thirtyDaysFromNow) {
      insuranceStatus = "expiring_soon";
    }

    // Update locksmith with new insurance details
    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        insuranceDocumentUrl,
        insuranceExpiryDate: expiryDate,
        insuranceStatus,
        documentationUploadedAt: new Date(),
        // Reset verification since it's a new document
        insuranceVerifiedAt: null,
        insuranceVerifiedById: null,
        insuranceReminderSent: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Insurance details updated successfully",
      locksmith: {
        id: locksmith.id,
        insuranceDocumentUrl: locksmith.insuranceDocumentUrl,
        insuranceExpiryDate: locksmith.insuranceExpiryDate,
        insuranceStatus: locksmith.insuranceStatus,
      },
    });
  } catch (error) {
    console.error("Error updating insurance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update insurance" },
      { status: 500 }
    );
  }
}
