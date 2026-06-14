import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";
import { serperPlaces, buildPlacesQuery, placeToLead } from "@/lib/serper-places";
import { toUkMobile, extractEmailFromWebsite } from "@/lib/web-email-scrape";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { batchId } = await req.json().catch(() => ({}));
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const batch = await prisma.scrapeBatch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: "batch not found" }, { status: 404 });
  if (batch.status === "paused" || batch.status === "completed") {
    return NextResponse.json({ status: batch.status, done: batch.status === "completed", discovered: batch.discovered, extracted: batch.extracted, skipped: batch.skipped });
  }

  const query = buildPlacesQuery({ keyword: batch.keyword, city: batch.city || undefined, area: batch.area || undefined, postcode: batch.postcode || undefined });
  const nextPage = (batch.page || 0) + 1;

  let discovered = batch.discovered;
  let extracted = batch.extracted;
  let skipped = batch.skipped;
  let done = false;
  let lastError: string | null = null;

  // Leads created this chunk that have a website — we harvest their email after.
  const emailTargets: { id: string; website: string }[] = [];

  try {
    const places = await serperPlaces(query, { gl: batch.country, page: nextPage });
    if (places.length === 0) {
      done = true; // no more results
    } else {
      for (const p of places) {
        if (extracted >= batch.maxResults) { done = true; break; }
        const lead = placeToLead(p);
        if (!lead) { skipped++; continue; }
        discovered++;
        const existing = await prisma.locksmithLead.findUnique({ where: { googlePlaceId: lead.placeId }, select: { id: true } });
        if (existing) { skipped++; continue; }
        try {
          const created = await prisma.locksmithLead.create({
            data: {
              googlePlaceId: lead.placeId,
              name: lead.name,
              city: batch.city || batch.area || "",
              address: lead.address,
              phone: toUkMobile(lead.phone), // UK mobiles ONLY (landlines → null)
              website: lead.website || null,
              rating: lead.rating,
              reviewCount: lead.reviewCount,
              category: lead.category || null,
              googleMapsUrl: lead.googleMapsUrl,
              status: "new",
              source: "manual",
              scrapeBatchId: batch.id,
            },
            select: { id: true, website: true },
          });
          extracted++;
          if (created.website && emailTargets.length < 25) emailTargets.push({ id: created.id, website: created.website });
        } catch { skipped++; }
      }
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  }

  // Harvest emails from the new leads' websites (parallel, bounded).
  if (emailTargets.length) {
    await Promise.all(emailTargets.map(async (t) => {
      const email = await extractEmailFromWebsite(t.website).catch(() => "");
      if (email) await prisma.locksmithLead.update({ where: { id: t.id }, data: { email } }).catch(() => {});
    }));
  }

  if (extracted >= batch.maxResults) done = true;

  const updated = await prisma.scrapeBatch.update({
    where: { id: batch.id },
    data: { page: nextPage, discovered, extracted, skipped, lastError, status: done ? "completed" : "running" },
  });

  return NextResponse.json({ status: updated.status, done, discovered, extracted, skipped, page: nextPage, lastError });
}
