/**
 * GET    /api/admin/meta-catalog/services
 *   Returns the canonical service catalog merged with admin overrides
 *   (image_link, title, description) and per-item Meta sync state.
 *
 * PATCH  /api/admin/meta-catalog/services
 *   Body: { slug, imageUrl?, customTitle?, customDescription? }
 *   Upserts the override row for that slug. Pass `null` to clear a field.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  SERVICE_CATALOG,
  isServiceSlug,
  toCatalogItem,
} from "@/lib/services-catalog";

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

  const overrides = await prisma.serviceCatalogItem.findMany();
  const overrideMap = new Map(overrides.map((o) => [o.slug, o]));

  const items = SERVICE_CATALOG.map((entry) => {
    const o = overrideMap.get(entry.id);
    const base = toCatalogItem(entry);
    return {
      slug: entry.id,
      defaults: {
        title: base.title,
        description: base.description,
        image_link: base.image_link,
        link: base.link,
        priceHint: entry.priceHint,
      },
      overrides: o
        ? {
            imageUrl: o.imageUrl,
            customTitle: o.customTitle,
            customDescription: o.customDescription,
          }
        : { imageUrl: null, customTitle: null, customDescription: null },
      effective: {
        title: o?.customTitle?.trim() || base.title,
        description: o?.customDescription?.trim() || base.description,
        image_link: o?.imageUrl?.trim() || base.image_link,
        link: base.link,
      },
      sync: o
        ? {
            metaProductId: o.metaProductId,
            lastSyncedAt: o.lastSyncedAt,
            lastSyncStatus: o.lastSyncStatus,
            lastSyncMessage: o.lastSyncMessage,
          }
        : null,
    };
  });

  return NextResponse.json({ success: true, items });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { slug, imageUrl, customTitle, customDescription } = body as {
    slug?: string;
    imageUrl?: string | null;
    customTitle?: string | null;
    customDescription?: string | null;
  };

  if (!slug || !isServiceSlug(slug)) {
    return NextResponse.json({ error: "Invalid or missing slug" }, { status: 400 });
  }

  // Build a partial update; `null` clears, `undefined` keeps existing.
  const data: Record<string, string | null> = {};
  if (imageUrl !== undefined) data.imageUrl = imageUrl;
  if (customTitle !== undefined) data.customTitle = customTitle;
  if (customDescription !== undefined) data.customDescription = customDescription;

  const row = await prisma.serviceCatalogItem.upsert({
    where: { slug },
    create: {
      slug,
      imageUrl: data.imageUrl ?? null,
      customTitle: data.customTitle ?? null,
      customDescription: data.customDescription ?? null,
    },
    update: data,
  });

  return NextResponse.json({ success: true, item: row });
}
