import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateOutreachStats, parseOutreachMeta } from "@/lib/lead-outreach";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cap sync to recently-contacted leads only (max 200) to avoid timeout on large DB.
  const leadsForSync = await prisma.locksmithLead.findMany({
    where: {
      status: { in: ["contacted", "replied"] },
      contactedAt: { not: null },
    },
    select: { id: true, email: true, status: true, notes: true },
    orderBy: { contactedAt: "desc" },
    take: 200,
  });

  const leadEmails = Array.from(
    new Set(
      leadsForSync
        .map((lead) => lead.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email))
    )
  );

  const locksmithsByEmail = new Set<string>();
  if (leadEmails.length > 0) {
    const onboardedLocksmiths = await prisma.locksmith.findMany({
      where: { email: { in: leadEmails } },
      select: { email: true },
    });
    for (const ls of onboardedLocksmiths) {
      locksmithsByEmail.add(ls.email.trim().toLowerCase());
    }
  }

  const syncUpdates: Promise<unknown>[] = [];
  for (const lead of leadsForSync) {
    const email = lead.email?.trim().toLowerCase();

    if (email && locksmithsByEmail.has(email) && lead.status !== "onboarded") {
      syncUpdates.push(
        prisma.locksmithLead.update({
          where: { id: lead.id },
          data: { status: "onboarded", contactedBy: "auto-onboard-sync" },
        })
      );
      continue;
    }

    if (lead.status === "new" || lead.status === "contacted") {
      const meta = parseOutreachMeta(lead.notes);
      const clickCount = Object.values(meta.clicks).reduce((sum, value) => sum + value, 0);
      if (clickCount > 0) {
        syncUpdates.push(
          prisma.locksmithLead.update({
            where: { id: lead.id },
            data: { status: "replied", contactedBy: "auto-click-sync" },
          })
        );
      }
    }
  }

  if (syncUpdates.length > 0) {
    await Promise.all(syncUpdates);
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const city = searchParams.get("city");
  const search = searchParams.get("search");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(200, Math.max(10, Number(searchParams.get("limit") || "100")));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (city && city !== "all") where.city = city;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [leads, filteredTotal] = await Promise.all([
    prisma.locksmithLead.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { reviewCount: "desc" }],
      take: limit,
      skip,
    }),
    prisma.locksmithLead.count({ where }),
  ]);

  const cities = await prisma.locksmithLead.findMany({
    distinct: ["city"],
    select: { city: true },
    orderBy: { city: "asc" },
  });

  const [totalCount, newCount, contactedCount, repliedCount, onboardedCount, notInterestedCount, newWithEmail, newWithMobile] =
    await Promise.all([
      prisma.locksmithLead.count(),
      prisma.locksmithLead.count({ where: { status: "new" } }),
      prisma.locksmithLead.count({ where: { status: "contacted" } }),
      prisma.locksmithLead.count({ where: { status: "replied" } }),
      prisma.locksmithLead.count({ where: { status: "onboarded" } }),
      prisma.locksmithLead.count({ where: { status: "not_interested" } }),
      prisma.locksmithLead.count({ where: { status: "new", email: { not: null } } }),
      prisma.locksmithLead.count({
        where: {
          status: "new",
          OR: [
            { phone: { startsWith: "07" } },
            { phone: { startsWith: "+447" } },
            { phone: { startsWith: "00447" } },
          ],
        },
      }),
    ]);

  const stats = {
    total: totalCount,
    new: newCount,
    contacted: contactedCount,
    replied: repliedCount,
    onboarded: onboardedCount,
    not_interested: notInterestedCount,
    newWithEmail,
    newWithMobile,
  };

  const outreachStats = aggregateOutreachStats(
    leads.map((lead) => ({ status: lead.status, notes: lead.notes }))
  );

  return NextResponse.json({
    leads,
    cities: cities.map(c => c.city),
    stats,
    outreachStats,
    pagination: { page, limit, total: filteredTotal, pages: Math.ceil(filteredTotal / limit) },
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, notes, email } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    if (status === "contacted") {
      data.contactedAt = new Date();
      data.contactedBy = (admin as { name?: string }).name || "admin";
    }
  }
  if (notes !== undefined) data.notes = notes;
  if (email !== undefined) data.email = email;

  const updated = await prisma.locksmithLead.update({ where: { id }, data });
  return NextResponse.json({ success: true, lead: updated });
}
