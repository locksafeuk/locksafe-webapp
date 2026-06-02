/**
 * POST /api/admin/google-ads/search-terms/add-negative
 *
 * Adds a search term as a BROAD negative keyword to one or more campaigns.
 * Also updates any matching draft in the DB (by googleCampaignId) so the
 * negativeKeywords array stays in sync.
 *
 * Body: { term: string, campaignIds: string[] }
 *   campaignIds: Google Ads numeric campaign IDs
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import prisma from "@/lib/db";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { term?: string; campaignIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const term = body.term?.trim().toLowerCase();
  const campaignIds = Array.isArray(body.campaignIds) ? body.campaignIds.map(String) : [];

  if (!term) return NextResponse.json({ error: "term is required" }, { status: 400 });
  if (campaignIds.length === 0) return NextResponse.json({ error: "campaignIds is required" }, { status: 400 });

  const clientData = await getDefaultGoogleAdsClient();
  if (!clientData) {
    return NextResponse.json({ error: "No active Google Ads account" }, { status: 409 });
  }

  const { client, customerId } = clientData;

  let addedTo = 0;
  const errors: string[] = [];

  for (const campaignId of campaignIds) {
    const campaignResourceName = `customers/${customerId}/campaigns/${campaignId}`;
    try {
      await client.mutate("campaignCriteria", [
        {
          create: {
            campaign: campaignResourceName,
            negative: true,
            keyword: { text: term, matchType: "BROAD" },
          },
        },
      ]);
      addedTo++;

      // Sync the draft in DB
      const drafts = await prisma.googleAdsCampaignDraft.findMany({
        where: { googleCampaignId: campaignId },
        select: { id: true, negativeKeywords: true },
      });
      for (const draft of drafts) {
        if (!draft.negativeKeywords.includes(term)) {
          await prisma.googleAdsCampaignDraft.update({
            where: { id: draft.id },
            data: { negativeKeywords: [...draft.negativeKeywords, term] },
          });
        }
      }
    } catch (err) {
      errors.push(`Campaign ${campaignId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (addedTo === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 502 });
  }

  return NextResponse.json({ success: true, addedTo, errors: errors.length ? errors : undefined });
}
