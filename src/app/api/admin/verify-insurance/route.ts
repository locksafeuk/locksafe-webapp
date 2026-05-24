/**
 * Admin credential verification — insurance + DBS.
 *
 * Most documents are auto-verified by the vision model on upload.
 * This route handles the remaining "pending_review" cases where AI
 * confidence was 0.60–0.84, and the override actions (force-verify, reject).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { isFullyCredentialed } from "@/lib/credential-verifier";

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
    // action: "verify" | "reject" | "update_expiry" | "verify_dbs" | "reject_dbs"
    const { locksmithId, action, newExpiryDate, dbsNewExpiryDate } = body;

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
        insuranceStatus: true,
        dbsStatus: true,
        insuranceVerificationNotes: true,
        insuranceAiConfidence: true,
        dbsVerificationNotes: true,
        dbsAiConfidence: true,
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
          isVerified: false,
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

    // ── DBS actions ──────────────────────────────────────────────────────────

    if (action === "verify_dbs") {
      const expiryInput = dbsNewExpiryDate ? new Date(dbsNewExpiryDate) : null;
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      let newDbsStatus = "verified";
      if (expiryInput) {
        if (expiryInput < now) newDbsStatus = "expired";
        else if (expiryInput <= thirtyDaysFromNow) newDbsStatus = "expiring_soon";
      }

      const insuranceStatus = locksmith?.insuranceStatus ?? "pending";
      const shouldBeVerified = isFullyCredentialed(insuranceStatus, newDbsStatus);

      const updated = await prisma.locksmith.update({
        where: { id: locksmithId },
        data: {
          dbsStatus: newDbsStatus,
          dbsVerifiedAt: new Date(),
          dbsVerifiedById: admin.id,
          ...(expiryInput ? { dbsExpiryDate: expiryInput } : {}),
          ...(shouldBeVerified ? { isVerified: true } : {}),
        },
      });

      return NextResponse.json({
        success: true,
        message: "DBS certificate verified",
        locksmith: {
          id: updated.id,
          dbsStatus: updated.dbsStatus,
          dbsVerifiedAt: updated.dbsVerifiedAt,
          isVerified: updated.isVerified,
        },
      });
    }

    if (action === "reject_dbs") {
      const updated = await prisma.locksmith.update({
        where: { id: locksmithId },
        data: {
          dbsStatus: "pending",
          dbsVerifiedAt: null,
          dbsVerifiedById: null,
          isVerified: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: "DBS verification removed",
        locksmith: {
          id: updated.id,
          dbsStatus: updated.dbsStatus,
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
