/**
 * POST /api/admin/google-ads/drafts/[id]/geo-accept
 *
 * Admin action: accept the current live geo targeting as the NEW baseline.
 * Used when the post-publish verifier flagged drift and the admin decides
 * the live state IS correct (e.g., a deliberate UI edit, an expansion the
 * admin approves of, or a Google-side correction we want to keep).
 *
 * Mechanics:
 *   1. Read live campaign criteria via GAQL
 *   2. Update publishedSnapshot.geoTargets to the live set (THIS IS THE
 *      ONLY PATH that mutates the baseline)
 *   3. Append an audit entry with action="accepted_as_new_baseline"
 *
 * The original publishedSnapshot.geoTargets at the time of acceptance is
 * preserved in the audit entry's baselineSnapshot field, so the forensic
 * trail remains intact even after the baseline is moved forward.
 *
 * See google-ads-campaign-playbook.md §15.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getGoogleAdsClientForAccount } from "@/lib/google-ads";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional confirmation in body to prevent accidental clicks.
  let body: { confirm?: boolean; notes?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      {
        error:
          "Confirmation required. POST { \"confirm\": true } to accept current live geo targeting as new baseline. This OVERWRITES the previous publishedSnapshot.geoTargets baseline.",
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draft = await (prisma.googleAdsCampaignDraft as any).findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      accountId: true,
      googleCampaignId: true,
      geoTargets: true,
      publishedSnapshot: true,
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (!draft.googleCampaignId) {
    return NextResponse.json(
      { error: "Draft has no published campaign" },
      { status: 400 },
    );
  }

  const client = await getGoogleAdsClientForAccount(draft.accountId);
  if (!client) {
    return NextResponse.json(
      { error: "No Google Ads client for this draft's account" },
      { status: 500 },
    );
  }

  // 1. Read live geo targets
  const liveRows = await client.query<{
    campaignCriterion: {
      location?: { geoTargetConstant?: string };
      negative?: boolean;
    };
  }>(`
    SELECT
      campaign_criterion.location.geo_target_constant,
      campaign_criterion.negative
    FROM campaign_criterion
    WHERE campaign.id = ${asInt(draft.googleCampaignId)}
      AND campaign_criterion.type = 'LOCATION'
      AND campaign_criterion.status != 'REMOVED'
  `);
  const liveGeoTargets: string[] = (liveRows ?? [])
    .filter((r) => r.campaignCriterion?.negative !== true)
    .map((r) => extractGeoIdFromConstant(r.campaignCriterion.location?.geoTargetConstant))
    .filter((id): id is string => !!id);

  // 2. Capture the OLD baseline (for the audit entry)
  const previousBaseline = extractBaselineGeoTargets(draft);

  // 3. Update publishedSnapshot.geoTargets to live (THE ONLY MUTATION
  //    PATH for the baseline)
  const snapshot = (draft.publishedSnapshot ?? {}) as Record<string, unknown>;
  const newSnapshot = { ...snapshot, geoTargets: liveGeoTargets };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.googleAdsCampaignDraft as any).update({
    where: { id: draft.id },
    data: {
      publishedSnapshot: newSnapshot,
      // Clear the verification status so the next cron tick re-runs without
      // the cached drift_warning. Cron will mark it ok if everything else lines up.
      verificationStatus: null,
      verificationDetails: null,
    },
  });

  // 4. Write the audit entry (preserves both old and new baselines for
  //    forensic reconstruction)
  const previousSet = new Set(previousBaseline);
  const liveSet = new Set(liveGeoTargets);
  const added = liveGeoTargets.filter((id) => !previousSet.has(id));
  const removed = previousBaseline.filter((id) => !liveSet.has(id));
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).googleAdsGeoAuditEntry.create({
      data: {
        draftId: draft.id,
        action: "accepted_as_new_baseline",
        detectedAt: new Date(),
        actedAt: new Date(),
        actedBy: String(admin.id),
        baselineSnapshot: previousBaseline,
        liveGeoTargets,
        geoTargetsAdded: added,
        geoTargetsRemoved: removed,
        notes: body.notes ?? null,
      },
    });
  } catch (auditErr) {
    console.error("[geo-accept] audit write failed:", auditErr);
  }

  return NextResponse.json({
    success: true,
    previousBaseline,
    newBaseline: liveGeoTargets,
    added,
    removed,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractBaselineGeoTargets(draft: {
  geoTargets?: string[] | null;
  publishedSnapshot?: unknown;
}): string[] {
  const snapshot = draft.publishedSnapshot;
  if (snapshot && typeof snapshot === "object" && "geoTargets" in snapshot) {
    const arr = (snapshot as { geoTargets?: unknown }).geoTargets;
    if (Array.isArray(arr) && arr.length > 0) return arr.map(String);
  }
  return Array.isArray(draft.geoTargets) ? draft.geoTargets.map(String) : [];
}

function extractGeoIdFromConstant(ref: string | undefined | null): string | null {
  if (!ref) return null;
  const parts = String(ref).split("/");
  const tail = parts[parts.length - 1];
  return /^\d+$/.test(tail) ? tail : null;
}

function asInt(v: string | number): string {
  const n = Number(String(v).replace(/[^0-9]/g, ""));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`invalid id: ${v}`);
  return String(n);
}
