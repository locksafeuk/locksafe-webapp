/**
 * GET /api/admin/google-ads/search-terms
 *
 * Returns search terms from the last 30 days with spend/conversion data.
 * Used by the Search Terms admin page to identify wasted spend and new
 * negative keyword opportunities.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientData = await getDefaultGoogleAdsClient();
  if (!clientData) {
    return NextResponse.json(
      { terms: [], asOf: new Date().toISOString(), noAccount: true },
      { status: 200 },
    );
  }

  const { client } = clientData;

  const gaql = `
    SELECT
      search_term_view.search_term,
      search_term_view.status,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.cost_micros,
      metrics.conversions,
      campaign.id,
      campaign.name,
      campaign.resource_name
    FROM search_term_view
    WHERE segments.date DURING LAST_30_DAYS
      AND metrics.impressions > 5
    ORDER BY metrics.cost_micros DESC
    LIMIT 500
  `;

  try {
    const rows = await client.query<{
      searchTermView: { searchTerm: string; status: string };
      metrics: {
        impressions?: string;
        clicks?: string;
        ctr?: number;
        costMicros?: string;
        conversions?: number;
      };
      campaign: { id: string; name: string; resourceName: string };
    }>(gaql);

    const terms = rows.map((r) => ({
      term: r.searchTermView.searchTerm,
      status: r.searchTermView.status,
      impressions: Number(r.metrics.impressions ?? 0),
      clicks: Number(r.metrics.clicks ?? 0),
      ctr: Number(r.metrics.ctr ?? 0),
      costMicros: Number(r.metrics.costMicros ?? 0),
      conversions: Number(r.metrics.conversions ?? 0),
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      campaignResourceName: r.campaign.resourceName,
    }));

    return NextResponse.json({ terms, asOf: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Return empty gracefully when API is not yet approved
    if (msg.includes("NOT_AUTHENTICATED") || msg.includes("PERMISSION_DENIED")) {
      return NextResponse.json({ terms: [], asOf: new Date().toISOString(), apiError: msg });
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
