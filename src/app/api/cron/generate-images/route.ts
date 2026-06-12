/**
 * Cron Job: /api/cron/generate-images
 *
 * Generates poster images for scheduled social posts that have an imagePrompt
 * but no imageUrl yet, then sets imageUrl. Tries local ComfyUI (Flux) first and
 * falls back to the OpenAI Images API — so this works on Vercel **even when the
 * Mac Studio is off** (ComfyUI@localhost is unreachable from Vercel → OpenAI).
 *
 * Two runners share generatePendingPostImages():
 *   - Mac agent runner (every tick) — uses free local ComfyUI when the Mac is on.
 *   - This Vercel cron (hourly) — the cloud safety net via the OpenAI fallback.
 *
 * Requirements: BLOB_READ_WRITE_TOKEN, and either a reachable ComfyUI or OPENAI_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { generatePendingPostImages } from "@/lib/generate-post-images";

// OpenAI image generation can take ~20s each; allow headroom for a small batch.
export const maxDuration = 300;

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

  // Small batch on the cloud path (each OpenAI image ~20s). The Mac runner does
  // the bulk for free when it's on; this is the backup.
  const summary = await generatePendingPostImages({ limit: 4 });
  return NextResponse.json({ success: true, ...summary });
}
