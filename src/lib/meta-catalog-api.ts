/**
 * Meta (Facebook) Commerce Catalog API helpers.
 *
 * Uses Graph API v21.0 with `META_ACCESS_TOKEN` (system user token, must
 * have `catalog_management` permission). Catalog id is read from the
 * `MetaCatalogConfig` record (set via the admin UI).
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/catalog
 *       https://developers.facebook.com/docs/marketing-api/catalog/reference/items_batch
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function token(): string {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN is not configured");
  return t;
}

function businessId(): string | undefined {
  return process.env.META_BUSINESS_ID;
}

interface MetaError {
  error?: { message?: string; type?: string; code?: number };
}

async function graphFetch<T>(
  path: string,
  init: RequestInit & { searchParams?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", token());
  if (init.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) url.searchParams.set(k, v);
  }
  const { searchParams, ...rest } = init;
  void searchParams;
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(rest.headers || {}),
    },
  });
  const json = (await res.json()) as T & MetaError;
  if (!res.ok || json.error) {
    const msg = json.error?.message || `Graph API ${res.status}`;
    throw new Error(`Meta Graph: ${msg}`);
  }
  return json;
}

// --------------------------------------------------------------------------
// Catalogs
// --------------------------------------------------------------------------

export interface MetaCatalog {
  id: string;
  name: string;
  product_count?: number;
  vertical?: string;
}

/** List all catalogs owned by the configured business. */
export async function listCatalogs(): Promise<MetaCatalog[]> {
  const bizId = businessId();
  if (!bizId) throw new Error("META_BUSINESS_ID is not configured");
  const data = await graphFetch<{ data: MetaCatalog[] }>(
    `/${bizId}/owned_product_catalogs`,
    { searchParams: { fields: "id,name,product_count,vertical", limit: "100" } },
  );
  return data.data ?? [];
}

/** Create a new catalog under the configured business. */
export async function createCatalog(name: string): Promise<MetaCatalog> {
  const bizId = businessId();
  if (!bizId) throw new Error("META_BUSINESS_ID is not configured");
  const body = new URLSearchParams({ name, vertical: "commerce" });
  return graphFetch<MetaCatalog>(`/${bizId}/owned_product_catalogs`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

// --------------------------------------------------------------------------
// Items batch upsert (the main sync path)
// --------------------------------------------------------------------------

export interface CatalogBatchItem {
  /** retailer_id MUST equal the Pixel content_id (== service slug). */
  id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new" | "refurbished" | "used";
  price: string; // "0.00 GBP"
  link: string;
  image_link: string;
  brand: string;
}

interface BatchRequest {
  method: "CREATE" | "UPDATE" | "DELETE";
  retailer_id: string;
  data?: Omit<CatalogBatchItem, "id">;
}

export interface BatchSyncResult {
  handles: string[];
  errors: Array<{ retailerId: string; message: string }>;
}

/**
 * Upsert (create-or-update) a batch of items into the given catalog.
 * Uses the `items_batch` endpoint with `UPDATE` (which acts as upsert).
 */
export async function upsertCatalogItems(
  catalogId: string,
  items: CatalogBatchItem[],
): Promise<BatchSyncResult> {
  if (items.length === 0) return { handles: [], errors: [] };

  const requests: BatchRequest[] = items.map((item) => {
    const { id, ...data } = item;
    return { method: "UPDATE", retailer_id: id, data };
  });

  const body = new URLSearchParams({
    item_type: "PRODUCT_ITEM",
    requests: JSON.stringify(requests),
    // Use "merge" so we don't blow away fields we haven't sent.
    allow_upsert: "true",
  });

  const res = await graphFetch<{ handles?: string[]; validation_status?: unknown }>(
    `/${catalogId}/items_batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
  );

  return { handles: res.handles ?? [], errors: [] };
}

// --------------------------------------------------------------------------
// Items list (read back what's in the catalog)
// --------------------------------------------------------------------------

export interface MetaProductItem {
  id: string;
  retailer_id: string;
  name?: string;
  availability?: string;
  price?: string;
  url?: string;
  image_url?: string;
}

/** List products in a catalog, with optional retailer_id filter. */
export async function listCatalogProducts(
  catalogId: string,
  opts: { limit?: number } = {},
): Promise<MetaProductItem[]> {
  const data = await graphFetch<{ data: MetaProductItem[] }>(`/${catalogId}/products`, {
    searchParams: {
      fields: "id,retailer_id,name,availability,price,url,image_url",
      limit: String(opts.limit ?? 200),
    },
  });
  return data.data ?? [];
}

// --------------------------------------------------------------------------
// Pixel <-> Catalog connection
// --------------------------------------------------------------------------

/**
 * Ensure the configured Pixel is connected to the catalog's external_event_sources.
 * Required for Dynamic Ads to attribute Pixel events to catalog items.
 */
export async function connectPixelToCatalog(catalogId: string, pixelId: string): Promise<void> {
  const body = new URLSearchParams({ external_event_sources: JSON.stringify([pixelId]) });
  await graphFetch(`/${catalogId}/external_event_sources`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}
