/**
 * GET /api/admin/google-ads/audit-call-assets
 *
 * For every ENABLED campaign, return its CALL assets (phone numbers).
 * If a campaign has no CALL asset, the AD_CALL conversion (30s+) can
 * never fire — which is the whole point of Rule §20.
 *
 * Auth: admin JWT cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

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

interface CampaignRow {
  campaign?: { id?: string; name?: string; status?: string };
}
interface CampaignAssetRow {
  campaign?: { id?: string; name?: string };
  campaignAsset?: { asset?: string; status?: string };
  asset?: {
    resourceName?: string;
    type?: string;
    callAsset?: {
      phoneNumber?: string;
      countryCode?: string;
    };
  };
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) return NextResponse.json({ error: "No active GoogleAdsAccount" }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;

  // All ENABLED campaigns.
  const campaigns = (await client.query(`
    SELECT campaign.id, campaign.name, campaign.status
    FROM campaign
    WHERE campaign.status = 'ENABLED'
  `)) as CampaignRow[];

  // CALL assets attached at campaign level.
  const callAssetRows = (await client.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign_asset.asset,
      campaign_asset.status,
      asset.resource_name,
      asset.type,
      asset.call_asset.phone_number,
      asset.call_asset.country_code
    FROM campaign_asset
    WHERE asset.type = 'CALL'
      AND campaign.status = 'ENABLED'
  `)) as CampaignAssetRow[];

  const callAssetsByCampaign = new Map<string, Array<{ phone: string; country?: string; status?: string }>>();
  for (const r of callAssetRows) {
    const cid = r.campaign?.id;
    if (!cid) continue;
    const phone = r.asset?.callAsset?.phoneNumber;
    if (!phone) continue;
    if (!callAssetsByCampaign.has(cid)) callAssetsByCampaign.set(cid, []);
    callAssetsByCampaign.get(cid)!.push({
      phone,
      country: r.asset?.callAsset?.countryCode,
      status: r.campaignAsset?.status,
    });
  }

  const report = campaigns.map((c) => {
    const cid = c.campaign?.id ?? "";
    const assets = callAssetsByCampaign.get(cid) ?? [];
    return {
      googleCampaignId: cid,
      name: c.campaign?.name,
      callAssets: assets,
      hasCallAsset: assets.length > 0,
    };
  });

  const missing = report.filter((r) => !r.hasCallAsset);

  return NextResponse.json({
    summary: {
      enabled_campaigns: campaigns.length,
      with_call_asset: report.filter((r) => r.hasCallAsset).length,
      missing_call_asset: missing.length,
    },
    campaigns: report,
    missing,
  });
}
