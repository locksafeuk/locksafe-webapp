/**
 * Meta Commerce Catalog feed (service-intent).
 *
 * Public, unauthenticated CSV feed consumed by Meta Commerce Manager.
 * Schedule the feed in Commerce Manager to fetch this URL daily.
 *
 *   GET https://locksafe.uk/api/meta/catalog-feed
 *
 * Source of truth: `src/lib/services-catalog.ts`. Catalog item ids MUST
 * stay in sync with Pixel `content_ids` for dynamic ads to work.
 */

import { SERVICE_CATALOG, toCatalogItem, type CatalogItem } from "@/lib/services-catalog";
import { prisma } from "@/lib/db";

// Re-rendered at most every 5 minutes so admin overrides (custom images,
// titles, descriptions) propagate quickly without hammering Mongo on every
// Meta crawler hit.
export const revalidate = 300;

const CSV_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
] as const satisfies ReadonlyArray<keyof CatalogItem>;

/** RFC 4180-ish CSV escaping: wrap in quotes, double internal quotes,
 *  collapse newlines so a row stays on one line. */
function csvEscape(value: string): string {
  const collapsed = value.replace(/[\r\n]+/g, " ").trim();
  return `"${collapsed.replace(/"/g, '""')}"`;
}

function rowFor(item: CatalogItem): string {
  return CSV_HEADERS.map((key) => csvEscape(String(item[key]))).join(",");
}

async function loadOverrides(): Promise<
  Map<string, { imageUrl?: string | null; customTitle?: string | null; customDescription?: string | null }>
> {
  try {
    const rows = await prisma.serviceCatalogItem.findMany({
      select: { slug: true, imageUrl: true, customTitle: true, customDescription: true },
    });
    return new Map(rows.map((r) => [r.slug, r]));
  } catch (err) {
    console.error("[catalog-feed] failed to load overrides:", err);
    return new Map();
  }
}

export async function GET(): Promise<Response> {
  const overrides = await loadOverrides();

  const items: CatalogItem[] = SERVICE_CATALOG.map((entry) => {
    const base = toCatalogItem(entry);
    const o = overrides.get(entry.id);
    if (!o) return base;
    return {
      ...base,
      title: o.customTitle?.trim() || base.title,
      description: o.customDescription?.trim() || base.description,
      image_link: o.imageUrl?.trim() || base.image_link,
    };
  });

  const csv = [CSV_HEADERS.join(","), ...items.map(rowFor), ""].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": 'inline; filename="locksafe-catalog-feed.csv"',
      "X-Catalog-Item-Count": String(items.length),
    },
  });
}
