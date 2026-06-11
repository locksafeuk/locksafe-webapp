/**
 * Lead export for a MANUAL outreach send (e.g. Zadarma bulk SMS in the browser).
 *
 *   GET  /api/admin/ops/lead-export?status=new&limit=300[&city=Norwich]
 *        → uncontacted lead phone numbers (de-duped, +44 normalised), plus
 *          ready-to-paste blocks (one per line / comma separated).
 *
 *   POST /api/admin/ops/lead-export  { ids: string[], contactedBy?: string }
 *        → marks those leads "contacted" so the automated cron won't re-message
 *          them. Call this AFTER you've actually sent them via Zadarma.
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

/** Normalise to a UK MOBILE in +44 E.164 (+447XXXXXXXXX). Returns null for
 *  anything that isn't a UK mobile (landlines/geographic numbers can't get SMS). */
function normUk(raw: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+44")) d = d.slice(1);
  else if (d.startsWith("44")) {/* ok */}
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  else if (d.startsWith("7") && d.length === 10) d = "44" + d;
  else return null;
  // UK mobiles only: 44 + 7 + 9 digits.
  if (!/^447\d{9}$/.test(d)) return null;
  return "+" + d;
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") || "new";
  const city = sp.get("city")?.trim();
  const limit = Math.min(Number(sp.get("limit") ?? 300) || 300, 1000);

  const leads = await prisma.locksmithLead.findMany({
    where: {
      status,
      phone: { not: null },
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, phone: true, city: true },
    orderBy: { createdAt: "asc" },
    take: limit * 2, // over-fetch; we filter to valid UK numbers + dedupe below
  });

  const seen = new Set<string>();
  const rows: { id: string; name: string; phone: string; city: string }[] = [];
  for (const l of leads) {
    const phone = normUk(l.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    rows.push({ id: l.id, name: l.name, phone, city: l.city });
    if (rows.length >= limit) break;
  }

  return NextResponse.json({
    status,
    city: city ?? null,
    count: rows.length,
    ids: rows.map((r) => r.id),
    phonesNewline: rows.map((r) => r.phone).join("\n"),
    phonesComma: rows.map((r) => r.phone).join(","),
    leads: rows,
  });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { ids?: string[]; contactedBy?: string };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids[] required" }, { status: 400 });
  }
  const result = await prisma.locksmithLead.updateMany({
    where: { id: { in: ids } },
    data: { status: "contacted", contactedAt: new Date(), contactedBy: body.contactedBy || "zadarma-manual" },
  });
  return NextResponse.json({ marked: result.count });
}
