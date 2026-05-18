import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateOutreachStats } from "@/lib/lead-outreach";

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

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const city = searchParams.get("city");
  const search = searchParams.get("search");

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

  const leads = await prisma.locksmithLead.findMany({
    where,
    orderBy: [{ status: "asc" }, { reviewCount: "desc" }],
  });

  const cities = await prisma.locksmithLead.findMany({
    distinct: ["city"],
    select: { city: true },
    orderBy: { city: "asc" },
  });

  const stats = {
    total: await prisma.locksmithLead.count(),
    new: await prisma.locksmithLead.count({ where: { status: "new" } }),
    contacted: await prisma.locksmithLead.count({ where: { status: "contacted" } }),
    replied: await prisma.locksmithLead.count({ where: { status: "replied" } }),
    onboarded: await prisma.locksmithLead.count({ where: { status: "onboarded" } }),
    not_interested: await prisma.locksmithLead.count({ where: { status: "not_interested" } }),
  };

  const outreachStats = aggregateOutreachStats(
    leads.map((lead) => ({ status: lead.status, notes: lead.notes }))
  );

  return NextResponse.json({ leads, cities: cities.map(c => c.city), stats, outreachStats });
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
