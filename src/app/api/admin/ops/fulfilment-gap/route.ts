/**
 * GET /api/admin/ops/fulfilment-gap[?city=Norwich]
 *
 * Diagnoses WHY an area has no locksmiths by showing the recruitment funnel:
 *   scraped lead → contacted → replied → onboarded → active locksmith.
 *
 * Tells you at a glance whether a gap is a SOURCING problem (no leads found) or
 * a CONVERSION problem (leads found but never contacted/onboarded) — and whether
 * the outreach engines that do the converting are even switched on.
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

const STATUSES = ["new", "contacted", "replied", "onboarded", "not_interested"] as const;

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const city = request.nextUrl.searchParams.get("city")?.trim() || null;

  // Outreach engines — the things that actually convert leads into locksmiths.
  const outreach = {
    sms_outreach: process.env.SMS_OUTREACH_ENABLED === "true",
    whatsapp_outreach: process.env.WHATSAPP_OUTREACH_ENABLED === "true",
    activation: process.env.LOCKSMITH_ACTIVATION_ENABLED === "true",
  };

  // Global funnel.
  const [activeLocksmiths, totalLeads, ...statusCounts] = await Promise.all([
    prisma.locksmith.count({ where: { isActive: true, baseLat: { not: null } } }),
    prisma.locksmithLead.count(),
    ...STATUSES.map((s) => prisma.locksmithLead.count({ where: { status: s } })),
  ]);
  const leadsByStatus = Object.fromEntries(STATUSES.map((s, i) => [s, statusCounts[i]]));

  // Where are leads sitting UNCONTACTED (status "new")? That's the recruitment
  // backlog — areas we found people but never reached out.
  const newLeads = await prisma.locksmithLead.findMany({
    where: { status: "new" },
    select: { city: true, phone: true },
    take: 5000,
  });
  const byCity = new Map<string, { total: number; withPhone: number }>();
  for (const l of newLeads) {
    const key = (l.city || "Unknown").trim();
    const cur = byCity.get(key) ?? { total: 0, withPhone: 0 };
    cur.total += 1;
    if (l.phone) cur.withPhone += 1;
    byCity.set(key, cur);
  }
  const topUncontactedCities = [...byCity.entries()]
    .map(([c, v]) => ({ city: c, newLeads: v.total, withPhone: v.withPhone }))
    .sort((a, b) => b.newLeads - a.newLeads)
    .slice(0, 20);

  // Optional city deep-dive.
  let cityDetail: unknown = null;
  if (city) {
    const leads = await prisma.locksmithLead.findMany({
      where: { city: { contains: city, mode: "insensitive" } },
      select: { name: true, phone: true, status: true, contactedAt: true, city: true },
      take: 200,
    });
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]));
    cityDetail = {
      city,
      leadsFound: leads.length,
      byStatus,
      sample: leads.slice(0, 10).map((l) => ({ name: l.name, hasPhone: !!l.phone, status: l.status })),
    };
  }

  return NextResponse.json({
    outreach,
    totals: { activeLocksmiths, totalLeads, leadsByStatus },
    recruitmentBacklog: { uncontactedLeads: leadsByStatus.new, topUncontactedCities },
    cityDetail,
  });
}
