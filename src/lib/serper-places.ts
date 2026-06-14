/**
 * Shared Serper.dev Google-Maps (places) client — used by the cron scraper and
 * the Manual Lead Scraper Wizard. Returns Google Maps business listings
 * (name, address, phone, website, rating, reviews, category) for a query.
 * Auth: SERPER_API_KEY (X-API-KEY header).
 */

export interface SerperPlace {
  title?: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  category?: string;
  type?: string;
  types?: string[];
  placeId?: string;
  cid?: string;
  latitude?: number;
  longitude?: number;
}

export interface PlaceLead {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  category: string;
  googleMapsUrl: string;
}

export function hasSerper(): boolean {
  return Boolean(process.env.SERPER_API_KEY);
}

export function buildPlacesQuery(input: {
  keyword: string;
  city?: string;
  area?: string;
  postcode?: string;
}): string {
  const loc = [input.postcode, input.city, input.area].filter(Boolean).join(", ");
  return loc ? `${input.keyword} in ${loc}` : input.keyword;
}

export async function serperPlaces(
  query: string,
  opts?: { gl?: string; hl?: string; page?: number; timeoutMs?: number },
): Promise<SerperPlace[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 15000);
  try {
    const res = await fetch("https://google.serper.dev/places", {
      method: "POST",
      signal: controller.signal,
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        q: query,
        gl: opts?.gl ?? "uk",
        hl: opts?.hl ?? "en",
        ...(opts?.page ? { page: opts.page } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[serper] error ${res.status} for "${query}": ${body.slice(0, 200)}`);
      return [];
    }
    const data = (await res.json()) as { places?: SerperPlace[] };
    return data?.places ?? [];
  } catch (err) {
    console.error(`[serper] request failed for "${query}":`, err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function placeToLead(p: SerperPlace): PlaceLead | null {
  if (!p.title) return null;
  const placeId =
    p.placeId ||
    (p.cid
      ? `cid-${p.cid}`
      : `serper-${Buffer.from(`${p.title}|${p.address ?? ""}`).toString("base64").slice(0, 24)}`);
  const googleMapsUrl = p.cid
    ? `https://www.google.com/maps?cid=${p.cid}`
    : p.placeId
      ? `https://www.google.com/maps/place/?q=place_id:${p.placeId}`
      : `https://www.google.com/maps/search/${encodeURIComponent(`${p.title} ${p.address ?? ""}`)}`;
  return {
    placeId,
    name: p.title,
    address: p.address ?? "",
    phone: p.phoneNumber ?? "",
    website: p.website ?? "",
    rating: p.rating ?? 0,
    reviewCount: p.ratingCount ?? 0,
    category: p.category || p.type || (p.types && p.types[0]) || "",
    googleMapsUrl,
  };
}
