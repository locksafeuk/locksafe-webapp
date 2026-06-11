/**
 * GET /api/admin/google-ads/diag-search-terms
 *
 * Diagnostic: pull the search-terms report for the last 7 days across
 * every ENABLED campaign. Each row = a real user query that triggered
 * one of our ads. Used to spot:
 *   - Irrelevant intent (queries unrelated to locksmith service)
 *   - Bot patterns (repeated weird tokens)
 *   - High-cost low-conversion queries that should become negatives
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
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

interface STRow {
  campaign?: { name?: string };
  searchTermView?: { searchTerm?: string; status?: string };
  metrics?: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number; allConversions?: number };
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) return NextResponse.json({ error: "no client" }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (ctx as any).client;

  try {
    const rows = (await client.query(`
      SELECT
        campaign.name,
        search_term_view.search_term,
        search_term_view.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.all_conversions
      FROM search_term_view
      WHERE segments.date DURING LAST_7_DAYS
        AND campaign.status = 'ENABLED'
        AND metrics.clicks > 0
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
    `)) as STRow[];

    return NextResponse.json({
      total: rows.length,
      rows: rows.map((r) => ({
        campaign: r.campaign?.name,
        query: r.searchTermView?.searchTerm,
        status: r.searchTermView?.status,
        impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0),
        costGbp: Number((Number(r.metrics?.costMicros ?? 0) / 1_000_000).toFixed(2)),
        conv: Number(r.metrics?.conversions ?? 0),
        allConv: Number(r.metrics?.allConversions ?? 0),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
