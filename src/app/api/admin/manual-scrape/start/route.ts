import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.keyword?.trim()) return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  const name = `${b.keyword} — ${[b.postcode, b.city, b.area].filter(Boolean).join(", ") || "all"}`;
  const batch = await prisma.scrapeBatch.create({
    data: {
      name,
      createdBy: admin.email || admin.id || "admin",
      keyword: String(b.keyword).trim(),
      city: b.city?.trim() || null,
      area: b.area?.trim() || null,
      postcode: b.postcode?.trim() || null,
      radiusMiles: b.radiusMiles ? Number(b.radiusMiles) : null,
      country: b.country || "uk",
      maxResults: Math.max(1, Math.min(500, Number(b.maxResults) || 100)),
      fields: Array.isArray(b.fields) ? b.fields : [],
      status: "running",
    },
  });
  return NextResponse.json({ batchId: batch.id, name: batch.name });
}
