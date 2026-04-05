import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { locksmithId, action, newExpiryDate } = body;

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "Locksmith ID is required" },
        { status: 400 }
      );
    }

    // Get current locksmith data
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: {
        insuranceExpiryDate: true,
        insuranceDocumentUrl: true,
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    if (action === "verify") {
      // Verify the insurance
      if (!locksmith.insuranceDocumentUrl) {
        return NextResponse.json(
          { success: false, error: "No insurance document uploaded" },
          { status: 400 }
        );
      }

      // Determine status based on expiry date
      let insuranceStatus = "verified";
      const expiryDate = locksmith.insuranceExpiryDate;

      if (expiryDate) {
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        if (expiryDate < now) {
          insuranceStatus = "expired";
        } else if (expiryDate <= thirtyDaysFromNow) {
          insuranceStatus = "expiring_soon";
        }
      }

      const updated = await prisma.locksmith.update({
        where: { id: locksmithId },
        data: {
          insuranceStatus,
          insuranceVerifiedAt: new Date(),
          insuranceVerifiedById: admin.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Insurance verified successfully",
        locksmith: {
          id: updated.id,
          insuranceStatus: updated.insuranceStatus,
          insuranceVerifiedAt: updated.insuranceVerifiedAt,
        },
      });
    }

    if (action === "update_expiry") {
      // Update the expiry date
      if (!newExpiryDate) {
        return NextResponse.json(
          { success: false, error: "New expiry date is required" },
          { status: 400 }
        );
      }

      const expiryDate = new Date(newExpiryDate);
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      let insuranceStatus = "verified";
      if (expiryDate < now) {
        insuranceStatus = "expired";
      } else if (expiryDate <= thirtyDaysFromNow) {
        insuranceStatus = "expiring_soon";
      }

      const updated = await prisma.locksmith.update({
        where: { id: locksmithId },
        data: {
          insuranceExpiryDate: expiryDate,
          insuranceStatus,
          insuranceVerifiedAt: new Date(),
          insuranceVerifiedById: admin.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Insurance expiry date updated",
        locksmith: {
          id: updated.id,
          insuranceExpiryDate: updated.insuranceExpiryDate,
          insuranceStatus: updated.insuranceStatus,
        },
      });
    }

    if (action === "reject") {
      // Reject/invalidate the insurance
      const updated = await prisma.locksmith.update({
        where: { id: locksmithId },
        data: {
          insuranceStatus: "pending",
          insuranceVerifiedAt: null,
          insuranceVerifiedById: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Insurance verification removed",
        locksmith: {
          id: updated.id,
          insuranceStatus: updated.insuranceStatus,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error verifying insurance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify insurance" },
      { status: 500 }
    );
  }
}
