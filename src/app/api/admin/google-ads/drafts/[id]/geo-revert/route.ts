/**
 * POST /api/admin/google-ads/drafts/[id]/geo-revert
 *
 * Admin action: revert a campaign's live geo targeting to the publishedSnapshot
 * baseline. Used when the post-publish verifier flagged drift and the admin
 * decides the live state is wrong.
 *
 * Mechanics:
 *   1. Read draft + publishedSnapshot.geoTargets (the immutable baseline)
 *   2. Query live campaign criteria via GAQL
 *   3. Diff vs baseline → compute REMOVE + ADD ops
 *   4. Apply via campaignCriteria mutate
 *   5. Append an audit entry with action="reverted_to_baseline"
 *
 * Source of truth NOT mutated: publishedSnapshot stays exactly as it was.
 * Only the live Google state is changed (back to match the baseline).
 *
 * See google-ads-campaign-playbook.md §15.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  getGoogleAdsClientForAccount,
  buildResourceName,
} from "@/lib/google-ads";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Baseline: publishedSnapshot.geoTargets > draft.geoTargets
  const baseline = extractBaselineGeoTargets(draft);
  if (baseline.length === 0) {
    return NextResponse.json(
      {
        error:
          "No publishedSnapshot baseline available — nothing to revert to. Use geo-accept to establish a new baseline first.",
      },
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

  // Read live state for the audit trail
  const liveRows = await client.query<{
    campaignCriterion: {
      resourceName: string;
      location?: { geoTargetConstant?: string };
      negative?: boolean;
      type?: string;
    };
  }>(`
    SELECT
      campaign_criterion.resource_name,
      campaign_criterion.location.geo_target_constant,
      campaign_criterion.negative,
      campaign_criterion.type
    FROM campaign_criterion
    WHERE campaign.id = ${asInt(draft.googleCampaignId)}
      AND campaign_criterion.type = 'LOCATION'
      AND campaign_criterion.status != 'REMOVED'
  `);
  const live = (liveRows ?? []).filter(
    (r) => r.campaignCriterion?.negative !== true,
  );
  const liveGeoTargets = live
    .map((r) => extractGeoIdFromConstant(r.campaignCriterion.location?.geoTargetConstant))
    .filter((id): id is string => !!id);

  const baselineSet = new Set(baseline);
  const liveSet = new Set(liveGeoTargets);
  const toRemove = live.filter((r) => {
    const id = extractGeoIdFromConstant(r.campaignCriterion.location?.geoTargetConstant);
    return id && !baselineSet.has(id);
  });
  const toAddIds = baseline.filter((id) => !liveSet.has(id));

  const ops: Record<string, unknown>[] = [];
  for (const r of toRemove) {
    ops.push({ remove: r.campaignCriterion.resourceName });
  }
  for (const id of toAddIds) {
    ops.push({
      create: {
        campaign: buildResourceName(
          (client as { customerIdPlain: string }).customerIdPlain,
          "campaigns",
          draft.googleCampaignId,
        ),
        location: {
          geoTargetConstant: `geoTargetConstants/${id}`,
        },
      },
    });
  }

  if (ops.length === 0) {
    // Already matches baseline; nothing to do but still record an audit entry
    // for the admin's explicit "revert" intent.
    await writeAuditEntry({
      draftId: draft.id,
      action: "reverted_to_baseline",
      detectedAt: new Date(),
      actedAt: new Date(),
      actedBy: String(admin.id),
      baseline,
      liveGeoTargets,
      added: [],
      removed: [],
      notes: "live already matched baseline — no API changes needed",
    });
    return NextResponse.json({
      success: true,
      noChanges: true,
      baseline,
      liveGeoTargets,
    });
  }

  try {
    await client.mutate("campaignCriteria", ops);
  } catch (mutateErr) {
    return NextResponse.json(
      {
        error: "campaignCriteria mutate failed",
        details: mutateErr instanceof Error ? mutateErr.message : String(mutateErr),
      },
      { status: 500 },
    );
  }

  await writeAuditEntry({
    draftId: draft.id,
    action: "reverted_to_baseline",
    detectedAt: new Date(),
    actedAt: new Date(),
    actedBy: String(admin.id),
    baseline,
    liveGeoTargets,
    added: toAddIds,
    removed: toRemove
      .map((r) => extractGeoIdFromConstant(r.campaignCriterion.location?.geoTargetConstant))
      .filter((id): id is string => !!id),
  });

  return NextResponse.json({
    success: true,
    revertedFrom: liveGeoTargets,
    revertedTo: baseline,
    removedIds: toRemove.length,
    addedIds: toAddIds.length,
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

async function writeAuditEntry(entry: {
  draftId: string;
  action: string;
  detectedAt: Date;
  actedAt: Date;
  actedBy: string;
  baseline: string[];
  liveGeoTargets: string[];
  added: string[];
  removed: string[];
  notes?: string;
}): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).googleAdsGeoAuditEntry.create({
      data: {
        draftId: entry.draftId,
        action: entry.action,
        detectedAt: entry.detectedAt,
        actedAt: entry.actedAt,
        actedBy: entry.actedBy,
        baselineSnapshot: entry.baseline,
        liveGeoTargets: entry.liveGeoTargets,
        geoTargetsAdded: entry.added,
        geoTargetsRemoved: entry.removed,
        notes: entry.notes ?? null,
      },
    });
  } catch (auditErr) {
    console.error("[geo-revert] audit write failed:", auditErr);
  }
}
