/**
 * Cron — verify recently published Google Ads campaigns against the
 * playbook's structural floors. Auto-pauses + Telegram-alerts campaigns
 * that publish with empty ad groups (the 2026-06-02 failure mode).
 *
 * Schedule: every 10 minutes (configured in vercel.json).
 *
 * Selection rules:
 *   - draft.status == "PUBLISHED"
 *   - draft.googleCampaignId is set
 *   - draft.createdAt within the last 24h (recent only — older campaigns
 *     are either fine or handled by the daily monitor)
 *   - draft.lastVerifiedAt is null OR was an api_error/google_pending
 *     more than 10 minutes ago (retry transient failures)
 *
 * Safety:
 *   - Limited to 10 drafts per cron tick (avoids long-running cron)
 *   - Each draft verification is independent; one failure doesn't block others
 *   - Telegram alerts use a dedupeKey so the same campaign doesn't spam
 *
 * Auth: x-vercel-cron header OR Authorization: Bearer $CRON_SECRET.
 *
 * See google-ads-campaign-playbook.md §12.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { verifyAndActOnDraft } from "@/lib/google-ads-publish-verifier";
import prisma from "@/lib/db";

const RECHECK_WINDOW_MS = 10 * 60 * 1000;       // 10 minutes
const VERIFICATION_HORIZON_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_DRAFTS_PER_RUN = 10;

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const horizonCutoff = new Date(now - VERIFICATION_HORIZON_MS);
  const recheckCutoff = new Date(now - RECHECK_WINDOW_MS);

  // Select drafts that need verification:
  //   - never verified, OR
  //   - last verification was transient (api_error or google_pending) and
  //     happened more than 10 minutes ago
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drafts = await (prisma.googleAdsCampaignDraft as any).findMany({
    where: {
      status: "PUBLISHED",
      googleCampaignId: { not: null },
      createdAt: { gte: horizonCutoff },
      OR: [
        { lastVerifiedAt: null },
        {
          AND: [
            { verificationStatus: { in: ["api_error", "google_pending"] } },
            { lastVerifiedAt: { lt: recheckCutoff } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      googleCampaignId: true,
      verificationStatus: true,
    },
    orderBy: { createdAt: "asc" },
    take: MAX_DRAFTS_PER_RUN,
  });

  type DraftPick = {
    id: string;
    name: string;
    googleCampaignId: string | null;
    verificationStatus: string | null;
  };

  const results: Array<{
    draftId: string;
    name: string;
    status: string;
    issues?: string[];
    error?: string;
  }> = [];

  for (const draft of drafts as DraftPick[]) {
    try {
      const r = await verifyAndActOnDraft(draft.id);
      results.push({
        draftId: draft.id,
        name: draft.name,
        status: r.status,
        ...(r.issues.length > 0 ? { issues: r.issues } : {}),
        ...(r.error ? { error: r.error } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[verify-published-drafts] draft ${draft.id} threw:`,
        message,
      );
      results.push({ draftId: draft.id, name: draft.name, status: "exception", error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    consideredCount: (drafts as DraftPick[]).length,
    results,
    windowMs: { recheckWindowMs: RECHECK_WINDOW_MS, horizonMs: VERIFICATION_HORIZON_MS },
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
