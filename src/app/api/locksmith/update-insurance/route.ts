import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import {
  verifyInsuranceDocument,
  isFullyCredentialed,
} from "@/lib/credential-verifier";

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

    // ── AI vision verification (non-blocking race with a 60s deadline) ─────────
    // Fetch locksmith name for Telegram alerts
    const locksmithRecord = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: { name: true, dbsStatus: true },
    });

    let aiInsuranceStatus = "pending";
    let aiVerifiedAt: Date | null = null;
    let aiVerifiedById: string | null = null;
    let aiNotes: string | null = null;
    let aiConfidence: number | null = null;
    // Use the user-supplied expiry as the default; AI may override if it extracts one
    let resolvedExpiryDate = expiryDate;

    try {
      const verification = await verifyInsuranceDocument(
        insuranceDocumentUrl,
        locksmithRecord?.name
      );

      aiInsuranceStatus = verification.status;
      aiConfidence = verification.confidence;
      aiNotes = verification.notes;

      if (verification.autoVerified) {
        aiVerifiedAt = new Date();
        // null means AI auto-verified (no human admin ID)
        aiVerifiedById = null;
      }

      // If AI extracted a better expiry date, prefer it over user input
      if (verification.extractedExpiry) {
        const aiExpiry = new Date(verification.extractedExpiry);
        if (!isNaN(aiExpiry.getTime())) {
          resolvedExpiryDate = aiExpiry;
        }
      }
    } catch (err) {
      // Vision model unavailable (Ollama down, model not pulled) — fall back gracefully.
      // Use "pending_review" (not "pending") so the document is counted as uploaded
      // and awaiting admin review. "pending" means nothing uploaded; "pending_review"
      // means uploaded but not yet verified — which is exactly what happened here.
      console.warn("[update-insurance] Vision verification unavailable:", err);
      aiInsuranceStatus = "pending_review";
    }

    // Calculate insurance status overrides based on resolved expiry
    const now2 = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    if (aiInsuranceStatus === "verified" || aiInsuranceStatus === "pending_review") {
      if (resolvedExpiryDate < now2) {
        aiInsuranceStatus = "expired";
      } else if (resolvedExpiryDate <= thirtyDaysFromNow) {
        aiInsuranceStatus = "expiring_soon";
      }
    }

    // Determine if locksmith should now be fully verified
    const dbsStatus = locksmithRecord?.dbsStatus ?? "pending";
    const shouldBeVerified = isFullyCredentialed(aiInsuranceStatus, dbsStatus);

    // Update locksmith with new insurance details + AI result
    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        insuranceDocumentUrl,
        insuranceExpiryDate: resolvedExpiryDate,
        insuranceStatus: aiInsuranceStatus,
        insuranceVerifiedAt: aiVerifiedAt,
        insuranceVerifiedById: aiVerifiedById,
        insuranceVerificationNotes: aiNotes,
        insuranceAiConfidence: aiConfidence,
        documentationUploadedAt: new Date(),
        insuranceReminderSent: false,
        // Auto-upgrade isVerified when both credentials check out
        ...(shouldBeVerified ? { isVerified: true } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        aiInsuranceStatus === "verified"
          ? "Insurance verified automatically ✓"
          : aiInsuranceStatus === "pending_review"
          ? "Insurance uploaded — awaiting admin review"
          : aiInsuranceStatus === "unreadable"
          ? "Document could not be read — please re-upload a clearer image or PDF"
          : "Insurance details updated successfully",
      locksmith: {
        id: locksmith.id,
        insuranceDocumentUrl: locksmith.insuranceDocumentUrl,
        insuranceExpiryDate: locksmith.insuranceExpiryDate,
        insuranceStatus: locksmith.insuranceStatus,
      },
      verification: {
        autoVerified: aiInsuranceStatus === "verified",
        confidence: aiConfidence,
        requiresManualReview: aiInsuranceStatus === "pending_review",
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
