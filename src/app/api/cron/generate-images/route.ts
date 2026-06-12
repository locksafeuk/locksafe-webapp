/**
 * Cron Job: /api/cron/generate-images
 *
 * Generates AI images for scheduled social posts that have an imagePrompt
 * but no imageUrl yet. Uses Flux Schnell via local ComfyUI.
 *
 * Pipeline:
 *   1. generate-organic (5am)  → creates SocialPost with imagePrompt
 *   2. generate-images  (7am)  → this route: generates + uploads image → sets imageUrl
 *   3. publish-organic  (9am)  → publishes post WITH image to Facebook/Instagram
 *
 * Requirements:
 *   COMFYUI_BASE_URL  — ComfyUI server (default: http://localhost:8188)
 *   BLOB_READ_WRITE_TOKEN — Vercel Blob token for image storage
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { generatePendingPostImages } from "@/lib/generate-post-images";

async function verifyAccess(request: NextRequest): Promise<boolean> {
  if (verifyCronAuth(request)) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.type === "admin") return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const hasAccess = await verifyAccess(request);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Note: image generation needs ComfyUI reachable from the executing environment.
  // On Vercel that is usually NOT the case, so the reliable path is the Mac Studio
  // agent runner, which calls generatePendingPostImages() on every tick.
  const summary = await generatePendingPostImages();
  return NextResponse.json({ success: true, ...summary });
}
