/**
 * Cron Job: /api/cron/generate-poster-library
 *
 * Pre-generates a batch of TEXT-FREE background assets via Draw Things (rotating
 * prompt library), vision-gates them, and stores the passers as PENDING_REVIEW
 * PosterAssets for a human to approve. The posting pipeline then draws from the
 * APPROVED pool and overlays the post's exact proofread text.
 *
 * Only does real work where DRAWTHINGS_API_URL is set (the Mac agent-runner);
 * on Vercel it returns skipped (Draw Things isn't reachable from the cloud).
 *
 * Generation is slow (~50s/image) — call with a small ?count (default 4).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { generateLibraryAssets } from "@/lib/poster-library";

// Each image ~50s on the Mac; allow headroom for a small batch.
export const maxDuration = 800;

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
  if (!(await verifyAccess(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const raw = Number(new URL(request.url).searchParams.get("count"));
  const count = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 8) : 4;
  const summary = await generateLibraryAssets({ count });
  return NextResponse.json({ success: true, ...summary });
}
