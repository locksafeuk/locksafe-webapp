import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SORTABLE = new Set(["name", "rating", "reviewCount", "createdAt", "status"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { batchId } = await params;
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status")?.trim();
  const sort = SORTABLE.has(sp.get("sort") || "") ? (sp.get("sort") as string) : "createdAt";
  const order = sp.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") || 50)));

  const where: Record<string, unknown> = { scrapeBatchId: batchId };
  if (status && status !== "all") where.status = status;
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" } },
    { phone: { contains: q } },
    { website: { contains: q, mode: "insensitive" } },
    { address: { contains: q, mode: "insensitive" } },
  ];

  const [total, leads] = await Promise.all([
    prisma.locksmithLead.count({ where }),
    prisma.locksmithLead.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, contactPerson: true, email: true, phone: true, website: true,
        city: true, address: true, rating: true, reviewCount: true, category: true,
        googleMapsUrl: true, status: true, tags: true, assignedTo: true,
      },
    }),
  ]);
  return NextResponse.json({ total, page, pageSize, leads });
}
