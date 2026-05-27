/**
 * POST /api/admin/ads/[id]/run-window
 *
 * Sets a live Meta campaign run window directly from the dashboard:
 * - updates daily budget
 * - forces campaign + child ad sets/ads ACTIVE
 * - sets Meta campaign stop_time to now + N days
 * - mirrors dailyBudget/endDate/status in local DB
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { createMetaClient } from "@/lib/meta-marketing";

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
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const dailyBudget = Number(body?.dailyBudget ?? 10);
    const days = Number(body?.days ?? 5);

    if (!Number.isFinite(dailyBudget) || dailyBudget < 1) {
      return NextResponse.json({ error: "dailyBudget must be a number >= 1" }, { status: 400 });
    }
    if (!Number.isFinite(days) || days < 1 || days > 60) {
      return NextResponse.json({ error: "days must be between 1 and 60" }, { status: 400 });
    }

    const campaign = await prisma.adCampaign.findUnique({
      where: { id },
      include: { adSets: { include: { ads: true } } },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (!campaign.metaCampaignId) {
      return NextResponse.json({ error: "Campaign has not been published to Meta yet" }, { status: 400 });
    }

    const metaClient = createMetaClient();
    if (!metaClient) {
      return NextResponse.json({ error: "Meta client not configured" }, { status: 500 });
    }

    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // 1) Update daily budget + status using standard client helper.
    await metaClient.updateCampaign(campaign.metaCampaignId, {
      dailyBudget,
      status: "ACTIVE",
    });

    // 2) Set stop_time directly in Graph API.
    const token = process.env.META_ACCESS_TOKEN;
    const appSecret = process.env.META_APP_SECRET;
    if (!token) {
      return NextResponse.json({ error: "META_ACCESS_TOKEN is missing" }, { status: 500 });
    }

    const payload: Record<string, unknown> = {
      stop_time: endDate.toISOString(),
      access_token: token,
    };
    if (appSecret) {
      payload.appsecret_proof = createHmac("sha256", appSecret).update(token).digest("hex");
    }

    const metaResp = await fetch(`https://graph.facebook.com/v25.0/${campaign.metaCampaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const metaData = await metaResp.json();
    if (!metaResp.ok) {
      return NextResponse.json(
        {
          error: "Failed to update Meta stop_time",
          details: metaData,
        },
        { status: 502 },
      );
    }

    // 3) Activate child entities in Meta (best effort).
    for (const adSet of campaign.adSets) {
      if (adSet.metaAdSetId) {
        try {
          await metaClient.updateAdSet(adSet.metaAdSetId, { status: "ACTIVE" });
        } catch (err) {
          console.warn(`[RunWindow] Failed to activate ad set ${adSet.metaAdSetId}:`, err);
        }
      }
      for (const ad of adSet.ads) {
        if (ad.metaAdId) {
          try {
            await metaClient.updateAd(ad.metaAdId, { status: "ACTIVE" });
          } catch (err) {
            console.warn(`[RunWindow] Failed to activate ad ${ad.metaAdId}:`, err);
          }
        }
      }
    }

    // 4) Mirror local DB state.
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "ACTIVE",
        dailyBudget,
        endDate,
      },
    });
    await prisma.adSet.updateMany({
      where: { campaignId: campaign.id },
      data: { status: "ACTIVE" },
    });
    await prisma.ad.updateMany({
      where: { adSet: { campaignId: campaign.id } },
      data: { status: "ACTIVE" },
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      metaCampaignId: campaign.metaCampaignId,
      dailyBudget,
      endDate: endDate.toISOString(),
      metaResult: metaData,
    });
  } catch (error) {
    console.error("Error updating campaign run window:", error);
    return NextResponse.json(
      {
        error: "Failed to set campaign run window",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
