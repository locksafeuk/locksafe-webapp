import { NextRequest, NextResponse } from "next/server";
import { verifyProfilePhoto } from "@/lib/credential-verifier";
import prisma from "@/lib/db";

/**
 * POST /api/locksmith/verify-profile-photo
 *
 * Runs AI face verification on a profile photo URL.
 * Called from the onboarding modal after the locksmith uploads a photo.
 *
 * Body: { locksmithId: string, photoUrl: string, locksmithName?: string }
 *
 * Response: { success, isRealFace, confidence, rejectionReason?, notes }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locksmithId, photoUrl, locksmithName } = body as {
      locksmithId?: string;
      photoUrl?: string;
      locksmithName?: string;
    };

    if (!locksmithId || !photoUrl) {
      return NextResponse.json(
        { success: false, error: "locksmithId and photoUrl are required" },
        { status: 400 }
      );
    }

    // Basic URL validation — must be a Vercel Blob or known CDN URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(photoUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid photoUrl" },
        { status: 400 }
      );
    }

    // Only allow fetching from trusted hosts (Vercel Blob)
    const allowedHosts = ["public.blob.vercel-storage.com"];
    if (!allowedHosts.some((h) => parsedUrl.hostname.endsWith(h))) {
      return NextResponse.json(
        { success: false, error: "Photo URL host not allowed" },
        { status: 400 }
      );
    }

    const result = await verifyProfilePhoto(photoUrl, locksmithName);

    // Persist result to Locksmith record (non-blocking on failure)
    prisma.locksmith
      .update({
        where: { id: locksmithId },
        data: {
          profilePhotoVerified: result.isRealFace,
          profilePhotoVerifiedAt: result.isRealFace ? new Date() : null,
          profilePhotoRejectionReason: result.rejectionReason ?? null,
          profilePhotoAiConfidence: result.confidence,
        },
      })
      .catch((err) =>
        console.error("[VerifyProfilePhoto] DB update failed:", err)
      );

    return NextResponse.json({
      success: true,
      isRealFace: result.isRealFace,
      confidence: result.confidence,
      notes: result.notes,
      rejectionReason: result.rejectionReason ?? null,
    });
  } catch (error) {
    console.error("[VerifyProfilePhoto] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Face verification failed",
      },
      { status: 500 }
    );
  }
}
