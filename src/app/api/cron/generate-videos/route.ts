/**
 * Cron Job: /api/cron/generate-videos
 *
 * Renders captioned 9:16 short videos (with TTS voiceover) for TikTok-targeted
 * social posts that lack a videoUrl, then sets videoUrl. Requires ffmpeg, so it
 * only does real work on the **Mac Studio agent runner** — on Vercel (no ffmpeg)
 * it returns `{ skipped: true }`. The Mac runner already calls this every tick;
 * this route exists for manual triggering / parity.
 *
 * Requirements: BLOB_READ_WRITE_TOKEN, ffmpeg on PATH, OPENAI_API_KEY (voiceover).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { generatePendingPostVideos } from "@/lib/generate-post-videos";

// Video rendering + TTS can take a while per clip; allow plenty of headroom.
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

  const summary = await generatePendingPostVideos({ limit: 2 });
  return NextResponse.json({ success: true, ...summary });
}
