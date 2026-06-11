/**
 * POST /api/admin/google-ads/sync-master-negatives
 *
 * Sync the LockSafe master negative-keyword vocabulary
 * (LOCKSMITH_NEGATIVE_KEYWORDS_MASTER) into Google Ads as a single
 * shared SharedSet of type NEGATIVE_KEYWORDS, then attach that shared
 * set to every ENABLED campaign that does not already reference it.
 *
 * Why a SharedSet and not per-campaign negatives:
 *   - One source of truth — update in one place, every campaign inherits
 *   - Lower API ops cost on subsequent syncs (we only add the delta)
 *   - Mirrors Google's own "shared library" recommendation
 *
 * Idempotency:
 *   - If a SharedSet with our name already exists, reuse it
 *   - Compute the delta between Google's current criteria and our
 *     master list — add the missing, skip the existing
 *   - Attach to each campaign only when not already attached
 *
 * Auth: admin JWT cookie.
 *
 * Response:
 *   {
 *     sharedSetResourceName,
 *     summary: {
 *       master_count, existing_in_set, added, skipped_duplicate,
 *       campaigns_total, attached, already_attached, failed
 *     },
 *     attachedTo: string[],
 *     log: string[],
 *     errors: Array<{ step, message }>
 *   }
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";
import { LOCKSMITH_NEGATIVE_KEYWORDS_MASTER } from "@/lib/google-ads-negative-keywords-master";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHARED_SET_NAME = "LockSafe Master Negatives" as const;
const SHARED_SET_TYPE = "NEGATIVE_KEYWORDS" as const;

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

/** API enum mapping for match type. */
function toApiMatchType(mt: "PHRASE" | "BROAD" | "EXACT"): string {
  return mt; // Google's KeywordMatchType enum matches our names verbatim.
}

interface SharedSetRow {
  sharedSet?: {
    resourceName?: string;
    id?: string;
    name?: string;
    type?: string;
    status?: string;
  };
}

interface SharedCriterionRow {
  sharedSet?: { resourceName?: string };
  sharedCriterion?: { resourceName?: string; type?: string };
  keyword?: { text?: string; matchType?: string };
}

interface CampaignRow {
  campaign?: { id?: string; name?: string; resourceName?: string };
}

interface CampaignSharedSetRow {
  campaign?: { id?: string };
  sharedSet?: { resourceName?: string };
  campaignSharedSet?: { resourceName?: string; status?: string };
}

export async function POST() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) return NextResponse.json({ error: "No active GoogleAdsAccount" }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerId: string = (ctx as any).customerId ?? client.customerIdPlain;

  const log: string[] = [];
  const errors: Array<{ step: string; message: string }> = [];

  // ── Step 1: find or create the SharedSet ──────────────────────────
  let sharedSetResourceName: string | null = null;
  try {
    const rows = (await client.query(`
      SELECT shared_set.resource_name, shared_set.id, shared_set.name,
             shared_set.type, shared_set.status
      FROM shared_set
      WHERE shared_set.type = 'NEGATIVE_KEYWORDS'
    `)) as SharedSetRow[];
    for (const r of rows) {
      if (r.sharedSet?.name === SHARED_SET_NAME && r.sharedSet?.status === "ENABLED") {
        sharedSetResourceName = r.sharedSet.resourceName ?? null;
        break;
      }
    }
  } catch (err) {
    errors.push({ step: "list_shared_sets", message: err instanceof Error ? err.message : String(err) });
  }

  if (!sharedSetResourceName) {
    try {
      const resp = await client.mutate(
        "sharedSets",
        [
          {
            create: {
              name: SHARED_SET_NAME,
              type: SHARED_SET_TYPE,
              status: "ENABLED",
            },
          },
        ],
        { partialFailure: false, validateOnly: false },
      );
      sharedSetResourceName =
        resp?.results?.[0]?.resourceName ??
        resp?.mutateOperationResponses?.[0]?.sharedSetResult?.resourceName ??
        null;
      log.push(`Created shared set "${SHARED_SET_NAME}": ${sharedSetResourceName}`);
    } catch (err) {
      return NextResponse.json(
        { step: "create_shared_set", error: err instanceof Error ? err.message : String(err), log },
        { status: 500 },
      );
    }
  } else {
    log.push(`Reusing existing shared set: ${sharedSetResourceName}`);
  }

  if (!sharedSetResourceName) {
    return NextResponse.json(
      { error: "Shared set could not be resolved", log, errors },
      { status: 500 },
    );
  }

  // ── Step 2: list existing shared criteria on that set ────────────
  let existingCriteria: SharedCriterionRow[] = [];
  try {
    existingCriteria = (await client.query(`
      SELECT
        shared_set.resource_name,
        shared_criterion.resource_name,
        shared_criterion.type,
        shared_criterion.keyword.text,
        shared_criterion.keyword.match_type
      FROM shared_criterion
      WHERE shared_set.resource_name = '${sharedSetResourceName}'
    `)) as SharedCriterionRow[];
  } catch (err) {
    errors.push({ step: "list_shared_criteria", message: err instanceof Error ? err.message : String(err) });
  }

  const existingKey = new Set<string>();
  for (const r of existingCriteria) {
    const t = (r.keyword?.text ?? "").toLowerCase();
    const m = (r.keyword?.matchType ?? "").toUpperCase();
    if (t && m) existingKey.add(`${t}::${m}`);
  }
  log.push(`${existingKey.size} existing negative keywords on the shared set`);

  // ── Step 3: compute the delta and add missing in chunks ──────────
  const toAdd = LOCKSMITH_NEGATIVE_KEYWORDS_MASTER.filter((k) => {
    return !existingKey.has(`${k.text.toLowerCase()}::${k.matchType}`);
  });
  log.push(`${toAdd.length} new negatives to add (master = ${LOCKSMITH_NEGATIVE_KEYWORDS_MASTER.length})`);

  let added = 0;
  let failedAdds = 0;
  if (toAdd.length > 0) {
    // Google rejects > 5000 ops/request and is slow on very large batches.
    // Chunk to 200 per mutate call — well within limits and still cheap.
    const CHUNK = 200;
    for (let i = 0; i < toAdd.length; i += CHUNK) {
      const chunk = toAdd.slice(i, i + CHUNK);
      const ops = chunk.map((kw) => ({
        create: {
          sharedSet: sharedSetResourceName,
          keyword: {
            text: kw.text,
            matchType: toApiMatchType(kw.matchType),
          },
        },
      }));
      try {
        await client.mutate("sharedCriteria", ops, {
          partialFailure: true,
          validateOnly: false,
        });
        added += chunk.length;
      } catch (err) {
        failedAdds += chunk.length;
        errors.push({
          step: `add_shared_criteria_chunk_${i / CHUNK}`,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    log.push(`Added ${added} keywords to shared set (${failedAdds} chunk-failed)`);
  }

  // ── Step 4: attach the shared set to every ENABLED campaign ──────
  let campaigns: CampaignRow[] = [];
  try {
    campaigns = (await client.query(`
      SELECT campaign.id, campaign.name, campaign.resource_name
      FROM campaign
      WHERE campaign.status = 'ENABLED'
    `)) as CampaignRow[];
  } catch (err) {
    errors.push({ step: "list_campaigns", message: err instanceof Error ? err.message : String(err) });
  }

  let existingAttachments: CampaignSharedSetRow[] = [];
  try {
    existingAttachments = (await client.query(`
      SELECT
        campaign.id,
        shared_set.resource_name,
        campaign_shared_set.resource_name,
        campaign_shared_set.status
      FROM campaign_shared_set
      WHERE shared_set.resource_name = '${sharedSetResourceName}'
    `)) as CampaignSharedSetRow[];
  } catch (err) {
    errors.push({ step: "list_existing_attachments", message: err instanceof Error ? err.message : String(err) });
  }
  const alreadyAttachedCids = new Set<string>();
  for (const a of existingAttachments) {
    if (a.campaign?.id) alreadyAttachedCids.add(a.campaign.id);
  }

  const attachOps: Array<{ create: { campaign: string; sharedSet: string } }> = [];
  const attachTargets: Array<{ cid: string; name: string }> = [];
  for (const c of campaigns) {
    const cid = c.campaign?.id;
    if (!cid) continue;
    if (alreadyAttachedCids.has(cid)) continue;
    const campaignResourceName =
      c.campaign?.resourceName ?? buildResourceName(customerId, "campaigns", cid);
    attachOps.push({
      create: {
        campaign: campaignResourceName,
        sharedSet: sharedSetResourceName,
      },
    });
    attachTargets.push({ cid, name: c.campaign?.name ?? cid });
  }

  let attached = 0;
  if (attachOps.length > 0) {
    try {
      await client.mutate("campaignSharedSets", attachOps, {
        partialFailure: true,
        validateOnly: false,
      });
      attached = attachOps.length;
    } catch (err) {
      errors.push({
        step: "attach_campaigns",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.push(
    `${campaigns.length} ENABLED campaigns, ${alreadyAttachedCids.size} already attached, ${attached} newly attached`,
  );

  return NextResponse.json({
    success: errors.length === 0,
    sharedSetResourceName,
    summary: {
      master_count: LOCKSMITH_NEGATIVE_KEYWORDS_MASTER.length,
      existing_in_set: existingKey.size,
      added,
      skipped_duplicate: LOCKSMITH_NEGATIVE_KEYWORDS_MASTER.length - toAdd.length,
      failed_add_chunks: failedAdds,
      campaigns_total: campaigns.length,
      attached,
      already_attached: alreadyAttachedCids.size,
    },
    attachedTo: attachTargets.map((t) => t.name),
    log,
    errors,
  });
}
