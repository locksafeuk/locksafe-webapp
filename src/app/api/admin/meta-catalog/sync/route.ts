/**
 * POST /api/admin/meta-catalog/sync
 *   Pushes all 10 service-intent items into the active Meta Catalog using
 *   `items_batch` (UPDATE = upsert). Records per-item + global sync state.
 *
 * GET  /api/admin/meta-catalog/sync
 *   Returns the last full-sync state plus per-item sync state.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SERVICE_CATALOG, toCatalogItem } from "@/lib/services-catalog";
import { upsertCatalogItems, type CatalogBatchItem } from "@/lib/meta-catalog-api";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await prisma.metaCatalogConfig.findFirst({ where: { isActive: true } });
  const items = await prisma.serviceCatalogItem.findMany();
  return NextResponse.json({ success: true, config, items });
}

export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.metaCatalogConfig.findFirst({ where: { isActive: true } });
  if (!config) {
    return NextResponse.json(
      { success: false, error: "No active catalog configured. Save a catalog id first." },
      { status: 400 },
    );
  }
  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json(
      { success: false, error: "META_ACCESS_TOKEN is not configured" },
      { status: 500 },
    );
  }

  // Build the batch from canonical catalog + DB overrides.
  const overrides = await prisma.serviceCatalogItem.findMany();
  const overrideMap = new Map(overrides.map((o) => [o.slug, o]));

  const batch: CatalogBatchItem[] = SERVICE_CATALOG.map((entry) => {
    const base = toCatalogItem(entry);
    const o = overrideMap.get(entry.id);
    return {
      id: base.id, // retailer_id == slug == pixel content_id
      title: o?.customTitle?.trim() || base.title,
      description: o?.customDescription?.trim() || base.description,
      availability: base.availability,
      condition: base.condition,
      price: base.price,
      link: base.link,
      image_link: o?.imageUrl?.trim() || base.image_link,
      brand: base.brand,
    };
  });

  const startedAt = new Date();
  try {
    const result = await upsertCatalogItems(config.catalogId, batch);

    // Mark every item as synced.
    await Promise.all(
      batch.map((item) =>
        prisma.serviceCatalogItem.upsert({
          where: { slug: item.id },
          create: {
            slug: item.id,
            metaRetailerId: item.id,
            lastSyncedAt: startedAt,
            lastSyncStatus: "success",
            lastSyncMessage: null,
          },
          update: {
            metaRetailerId: item.id,
            lastSyncedAt: startedAt,
            lastSyncStatus: "success",
            lastSyncMessage: null,
          },
        }),
      ),
    );

    await prisma.metaCatalogConfig.update({
      where: { id: config.id },
      data: {
        lastFullSyncAt: startedAt,
        lastFullSyncStatus: "success",
        lastFullSyncMessage: `Upserted ${batch.length} items. handles=${result.handles.length}`,
      },
    });

    return NextResponse.json({
      success: true,
      synced: batch.length,
      handles: result.handles,
      syncedAt: startedAt.toISOString(),
    });
  } catch (err) {
    const message = (err as Error).message;
    await prisma.metaCatalogConfig.update({
      where: { id: config.id },
      data: {
        lastFullSyncAt: startedAt,
        lastFullSyncStatus: "error",
        lastFullSyncMessage: message,
      },
    });
    // Best-effort per-item error mark.
    await Promise.all(
      batch.map((item) =>
        prisma.serviceCatalogItem.upsert({
          where: { slug: item.id },
          create: {
            slug: item.id,
            metaRetailerId: item.id,
            lastSyncedAt: startedAt,
            lastSyncStatus: "error",
            lastSyncMessage: message,
          },
          update: {
            lastSyncedAt: startedAt,
            lastSyncStatus: "error",
            lastSyncMessage: message,
          },
        }),
      ),
    );
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
