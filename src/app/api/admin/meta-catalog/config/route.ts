/**
 * GET    /api/admin/meta-catalog/config
 *   Returns the active MetaCatalogConfig (catalog id, last sync, etc.).
 *
 * PUT    /api/admin/meta-catalog/config
 *   Body: { catalogId, catalogName? }
 *   Upserts the active catalog config.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

async function getActive() {
  return prisma.metaCatalogConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await getActive();
  return NextResponse.json({ success: true, config });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const catalogId = body?.catalogId;
  const catalogName = body?.catalogName;

  if (typeof catalogId !== "string" || !/^\d+$/.test(catalogId)) {
    return NextResponse.json(
      { error: "catalogId must be a numeric string (Meta Catalog ID)" },
      { status: 400 },
    );
  }

  // Deactivate all existing rows, then upsert the active one.
  await prisma.metaCatalogConfig.updateMany({
    where: { isActive: true, NOT: { catalogId } },
    data: { isActive: false },
  });

  const existing = await prisma.metaCatalogConfig.findFirst({ where: { catalogId } });

  const config = existing
    ? await prisma.metaCatalogConfig.update({
        where: { id: existing.id },
        data: { isActive: true, catalogName: catalogName ?? existing.catalogName },
      })
    : await prisma.metaCatalogConfig.create({
        data: { catalogId, catalogName: catalogName ?? null, isActive: true },
      });

  return NextResponse.json({ success: true, config });
}
