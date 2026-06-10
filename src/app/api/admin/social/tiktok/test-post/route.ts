/**
 * POST /api/admin/social/tiktok/test-post
 *
 * Publishes a single sample PHOTO to the connected TikTok account via the
 * Content Posting API. Used to demonstrate the integration end-to-end
 * (e.g. for TikTok app-audit demo recordings) and to smoke-test the pipeline.
 *
 * Posts the brand sample image hosted on the verified locksafe.uk domain.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { postPhotoToTikTok } from "@/lib/tiktok";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!(payload && payload.type === "admin");
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const account = await prisma.socialAccount.findFirst({
    where: { platform: "TIKTOK", isActive: true },
  });

  if (!account?.accessToken) {
    return NextResponse.json(
      { success: false, error: "No connected TikTok account. Connect @locksafeuk first." },
      { status: 400 }
    );
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk";
  const imageUrl = `${base}/tiktok-test.png`;

  const result = await postPhotoToTikTok({
    accessToken: account.accessToken,
    caption: "LockSafe UK — verified locksmiths, transparent prices. #LockSafeUK #HomeSecurity",
    imageUrls: [imageUrl],
    title: "LockSafe UK",
  });

  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
