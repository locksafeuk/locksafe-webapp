import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";
import { serperPlaces, buildPlacesQuery, placeToLead } from "@/lib/serper-places";
import { toUkMobile } from "@/lib/web-email-scrape";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Default nationwide sweep — top UK cities by population/locksmith demand.
const DEFAULT_CITIES = [
  "London", "Birmingham", "Manchester", "Leeds", "Glasgow", "Liverpool",
  "Sheffield", "Bristol", "Edinburgh", "Cardiff", "Newcastle upon Tyne",
  "Nottingham", "Leicester", "Coventry", "Southampton", "Portsmouth",
  "Brighton", "Hull", "Plymouth", "Belfast",
];

/**
 * Server-side multi-city scrape campaign. Runs a slice of cities per call
 * (chunked to stay under the function limit) so the caller can drive a
 * nationwide sweep with repeated requests. Leads are tagged source="campaign".
 *
 *   GET ?keyword=auto+locksmith&max=40&start=0&count=4   → scrape cities [start, start+count)
 */
export async function GET(req: NextRequest) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const keyword = (sp.get("keyword") || "").trim();
  if (!keyword) return NextResponse.json({ error: "keyword required" }, { status: 400 });
  const max = Math.max(1, Math.min(120, Number(sp.get("max")) || 40));
  const start = Math.max(0, Number(sp.get("start")) || 0);
  const count = Math.max(1, Math.min(6, Number(sp.get("count")) || 4));
  const cities = (sp.get("cities") ? sp.get("cities")!.split(",").map((c) => c.trim()).filter(Boolean) : DEFAULT_CITIES);
  const slug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const slice = cities.slice(start, start + count);
  const processed: { city: string; discovered: number; created: number; skipped: number }[] = [];

  for (const city of slice) {
    let discovered = 0, created = 0, skipped = 0, page = 0;
    const query = buildPlacesQuery({ keyword, city });
    try {
      while (created < max && page < 4) {
        page++;
        const places = await serperPlaces(query, { gl: "uk", page });
        if (!places.length) break;
        for (const p of places) {
          if (created >= max) break;
          const lead = placeToLead(p);
          if (!lead) { skipped++; continue; }
          discovered++;
          const exists = await prisma.locksmithLead.findUnique({ where: { googlePlaceId: lead.placeId }, select: { id: true } });
          if (exists) { skipped++; continue; }
          try {
            await prisma.locksmithLead.create({
              data: {
                googlePlaceId: lead.placeId,
                name: lead.name,
                city,
                address: lead.address,
                phone: toUkMobile(lead.phone),
                website: lead.website || null,
                rating: lead.rating,
                reviewCount: lead.reviewCount,
                category: lead.category || null,
                googleMapsUrl: lead.googleMapsUrl,
                status: "new",
                source: "campaign",
                tags: [slug],
              },
              select: { id: true },
            });
            created++;
          } catch { skipped++; }
        }
      }
    } catch (e) {
      processed.push({ city, discovered, created, skipped: skipped });
      return NextResponse.json({ keyword, error: e instanceof Error ? e.message : String(e), processed, nextStart: start + processed.length, done: false });
    }
    processed.push({ city, discovered, created, skipped });
  }

  const nextStart = start + slice.length;
  return NextResponse.json({
    keyword, max,
    totalCities: cities.length,
    processed,
    createdThisCall: processed.reduce((s, p) => s + p.created, 0),
    nextStart,
    done: nextStart >= cities.length,
  });
}
