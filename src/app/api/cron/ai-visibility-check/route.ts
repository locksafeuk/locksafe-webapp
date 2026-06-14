/**
 * AI Visibility cron — asks ChatGPT / Gemini / Copilot (Bing) the tracked
 * prompts and records whether LockSafe is cited. Weekly.
 *
 * Schedule (vercel.json): 0 7 * * 1  (Mon 07:00 UTC)
 * Auth: Authorization: Bearer $CRON_SECRET (or Vercel cron header)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runAiVisibilityCheck } from "@/lib/ai-visibility/check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runAiVisibilityCheck();
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
