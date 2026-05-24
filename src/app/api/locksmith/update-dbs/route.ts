/**
 * POST /api/locksmith/update-dbs
 *
 * Locksmith uploads their DBS certificate (stored in certificationDocumentUrl).
 * The vision model (qwen2.5-vl:7b) automatically checks the document and sets
 * dbsStatus — no manual admin step needed if confidence ≥ 0.85.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import {
  verifyDbsDocument,
  isFullyCredentialed,
} from "@/lib/credential-verifier";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function POST(request: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

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

    // ── Input ──────────────────────────────────────────────────────────────
    const body = await request.json();
    const { locksmithId, dbsDocumentUrl } = body;

    if (locksmithId !== decoded.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!dbsDocumentUrl) {
      return NextResponse.json(
        { success: false, error: "DBS document URL is required" },
        { status: 400 }
      );
    }

    // ── Fetch locksmith for context ────────────────────────────────────────
    const locksmithRecord = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: { name: true, insuranceStatus: true },
    });

    if (!locksmithRecord) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // ── AI vision verification ─────────────────────────────────────────────
    let dbsStatus = "pending";
    let dbsVerifiedAt: Date | null = null;
    let dbsVerifiedById: string | null = null;
    let dbsNotes: string | null = null;
    let dbsConfidence: number | null = null;
    let dbsExpiryDate: Date | null = null;

    try {
      const verification = await verifyDbsDocument(
        dbsDocumentUrl,
        locksmithRecord.name
      );

      dbsStatus = verification.status;
      dbsConfidence = verification.confidence;
      dbsNotes = verification.notes;

      if (verification.autoVerified) {
        dbsVerifiedAt = new Date();
        dbsVerifiedById = null; // null = AI auto-verified
      }

      if (verification.extractedExpiry) {
        const parsed = new Date(verification.extractedExpiry);
        if (!isNaN(parsed.getTime())) {
          dbsExpiryDate = parsed;
        }
      }
    } catch (err) {
      // Vision model unavailable — fall back to manual review
      console.warn("[update-dbs] Vision verification unavailable:", err);
      dbsStatus = "pending";
    }

    // ── Determine if locksmith is now fully credentialed ───────────────────
    const insuranceStatus = locksmithRecord.insuranceStatus ?? "pending";
    const shouldBeVerified = isFullyCredentialed(insuranceStatus, dbsStatus);

    // ── Persist ───────────────────────────────────────────────────────────
    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        // certificationDocumentUrl is the DBS cert field (re-used existing slot)
        certificationDocumentUrl: dbsDocumentUrl,
        dbsStatus,
        dbsExpiryDate,
        dbsVerifiedAt,
        dbsVerifiedById,
        dbsVerificationNotes: dbsNotes,
        dbsAiConfidence: dbsConfidence,
        documentationUploadedAt: new Date(),
        dbsReminderSent: false,
        // Auto-upgrade isVerified when both credentials check out
        ...(shouldBeVerified ? { isVerified: true } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        dbsStatus === "verified"
          ? "DBS certificate verified automatically ✓"
          : dbsStatus === "pending_review"
          ? "DBS certificate uploaded — awaiting admin review"
          : dbsStatus === "unreadable"
          ? "Document could not be read — please re-upload a clearer image or PDF"
          : "DBS details updated successfully",
      locksmith: {
        id: locksmith.id,
        dbsStatus: locksmith.dbsStatus,
        dbsExpiryDate: locksmith.dbsExpiryDate,
        certificationDocumentUrl: locksmith.certificationDocumentUrl,
        isVerified: locksmith.isVerified,
      },
      verification: {
        autoVerified: dbsStatus === "verified",
        confidence: dbsConfidence,
        requiresManualReview: dbsStatus === "pending_review",
        fullyCredentialed: shouldBeVerified,
      },
    });
  } catch (error) {
    console.error("[update-dbs] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update DBS details" },
      { status: 500 }
    );
  }
}
