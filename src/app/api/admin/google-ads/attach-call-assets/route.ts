/**
 * POST /api/admin/google-ads/attach-call-assets
 *
 * Attach the LockSafe SUPPORT_PHONE as a CALL asset to every ENABLED
 * campaign that doesn't already have one. Two-step Google Ads workflow:
 *   1. Create a Call Asset (assets:mutate, type=CALL).
 *   2. Link it to each campaign via campaignAssets:mutate (fieldType=CALL).
 *
 * Idempotent: re-running on a campaign that already has a call asset
 * with the same phone number is a no-op (skipped). Re-using the same
 * Asset across all campaigns means a single shared asset rather than 5
 * duplicate assets — matches Google's "shared library" model.
 *
 * Auth: admin JWT cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";
import { SUPPORT_PHONE } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

// Normalise SUPPORT_PHONE to E.164. Display format is "+44 20 4577 1989"
// but the Asset API requires E.164 with no spaces.
function toE164(displayPhone: string): string {
  return displayPhone.replace(/\s+/g, "");
}

interface CampaignRow {
  campaign?: { id?: string; name?: string };
}
interface CampaignAssetRow {
  campaign?: { id?: string };
  asset?: { type?: string; callAsset?: { phoneNumber?: string } };
}

export async function POST() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getDefaultGoogleAdsClient().catch((err) => ({ error: err instanceof Error ? err.message : String(err) }));
  if (!ctx || "error" in (ctx as object)) {
    return NextResponse.json(
      { error: "Google Ads client unavailable", details: "error" in (ctx as object) ? (ctx as { error: string }).error : "no ctx" },
      { status: 500 },
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerId: string = (ctx as any).customerId ?? client.customerIdPlain;

  const phoneE164 = toE164(SUPPORT_PHONE);
  const log: string[] = [];

  // Step 1: get all ENABLED campaigns.
  let campaigns: CampaignRow[];
  try {
    campaigns = (await client.query(`
      SELECT campaign.id, campaign.name
      FROM campaign
      WHERE campaign.status = 'ENABLED'
    `)) as CampaignRow[];
  } catch (err) {
    return NextResponse.json(
      { step: "list_campaigns", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
  log.push(`Found ${campaigns.length} ENABLED campaigns`);

  // Step 2: find which already have a CALL asset with our phone.
  let existingCallAssets: CampaignAssetRow[];
  try {
    existingCallAssets = (await client.query(`
      SELECT campaign.id, asset.type, asset.call_asset.phone_number
      FROM campaign_asset
      WHERE asset.type = 'CALL'
    `)) as CampaignAssetRow[];
  } catch (err) {
    return NextResponse.json(
      { step: "list_call_assets", error: err instanceof Error ? err.message : String(err), log },
      { status: 500 },
    );
  }
  const campaignsWithCallAsset = new Set<string>();
  for (const r of existingCallAssets) {
    const cid = r.campaign?.id;
    const phone = r.asset?.callAsset?.phoneNumber;
    if (cid && phone) {
      const norm = phone.replace(/\s+/g, "");
      if (norm === phoneE164) campaignsWithCallAsset.add(cid);
    }
  }
  log.push(`${campaignsWithCallAsset.size} of ${campaigns.length} already have a matching CALL asset`);

  // Step 3: create one Call Asset (shared across all campaigns).
  // We only create if there's at least one campaign needing attachment.
  const needAttachment = campaigns.filter((c) => c.campaign?.id && !campaignsWithCallAsset.has(c.campaign.id));
  if (needAttachment.length === 0) {
    return NextResponse.json({
      success: true,
      summary: { total: campaigns.length, alreadyHad: campaignsWithCallAsset.size, attached: 0 },
      log,
    });
  }

  // Check if our shared LockSafe call asset already exists.
  let assetResourceName: string | null = null;
  try {
    const existing = (await client.query(`
      SELECT asset.resource_name, asset.type, asset.call_asset.phone_number
      FROM asset
      WHERE asset.type = 'CALL'
    `)) as Array<{ asset?: { resourceName?: string; callAsset?: { phoneNumber?: string } } }>;
    for (const r of existing) {
      const norm = r.asset?.callAsset?.phoneNumber?.replace(/\s+/g, "");
      if (norm === phoneE164 && r.asset?.resourceName) {
        assetResourceName = r.asset.resourceName;
        log.push(`Reusing existing call asset: ${assetResourceName}`);
        break;
      }
    }
  } catch (err) {
    log.push(`Could not list existing assets (will try create anyway): ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!assetResourceName) {
    try {
      const createResp = await client.mutate(
        "assets",
        [
          {
            create: {
              callAsset: {
                phoneNumber: phoneE164,
                countryCode: "GB",
              },
            },
          },
        ],
        { partialFailure: false, validateOnly: false },
      );
      assetResourceName =
        createResp?.results?.[0]?.resourceName ??
        createResp?.mutateOperationResponses?.[0]?.assetResult?.resourceName ??
        null;
      log.push(`Created call asset: ${assetResourceName}`);
    } catch (err) {
      return NextResponse.json(
        { step: "create_call_asset", error: err instanceof Error ? err.message : String(err), log },
        { status: 500 },
      );
    }
  }

  if (!assetResourceName) {
    return NextResponse.json(
      { step: "create_call_asset", error: "Asset created but resource name unresolved", log },
      { status: 500 },
    );
  }

  // Step 4: attach to each campaign needing it.
  const attached: string[] = [];
  const failures: Array<{ campaignId: string; name?: string; error: string }> = [];
  for (const c of needAttachment) {
    const cid = c.campaign?.id;
    if (!cid) continue;
    const campaignResourceName = buildResourceName(customerId, "campaigns", cid);
    try {
      await client.mutate(
        "campaignAssets",
        [
          {
            create: {
              campaign: campaignResourceName,
              asset: assetResourceName,
              fieldType: "CALL",
            },
          },
        ],
        { partialFailure: false, validateOnly: false },
      );
      attached.push(c.campaign?.name ?? cid);
    } catch (err) {
      failures.push({ campaignId: cid, name: c.campaign?.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    success: failures.length === 0,
    assetResourceName,
    summary: {
      total: campaigns.length,
      alreadyHad: campaignsWithCallAsset.size,
      attached: attached.length,
      failed: failures.length,
    },
    attached,
    failures,
    log,
  });
}
