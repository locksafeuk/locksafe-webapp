/**
 * postcodes.io — thin client for UK outcode enrichment.
 *
 * Used to ground district landing pages in REAL local data:
 *   • anchor town (the settlement most associated with the outcode)
 *   • county / region
 *   • outcode centroid lat/lng
 *   • nearby outcodes (for cross-linking + LLM grounding)
 *
 * Postcodes.io is free, no API key, generous rate limits. We cache
 * results in the DistrictLandingPage row so we only hit it once per
 * district on initial generation.
 */

const BASE = "https://api.postcodes.io";

export interface OutcodeInfo {
  outcode:        string;
  longitude:      number | null;
  latitude:       number | null;
  northings:      number | null;
  eastings:       number | null;
  /** Admin district at outcode level (e.g. "Reading", "Manchester"). */
  adminDistrict:  string[];
  /** Postcode area parent town (anchor). Heuristic: first admin_district. */
  anchorTown:     string | null;
  /** Counties / regions covered by the outcode. */
  county:         string[];
  /** Country: "England" | "Scotland" | "Wales" | "Northern Ireland" */
  country:        string[];
  /** Parishes or wards. */
  parish:         string[];
  /** Parliamentary constituencies. */
  parliamentaryConstituency: string[];
}

/** Fetch metadata for one outcode. Returns null when the API has no record. */
export async function fetchOutcode(outcode: string): Promise<OutcodeInfo | null> {
  const url = `${BASE}/outcodes/${encodeURIComponent(outcode.toUpperCase())}`;
  const res = await fetch(url, { headers: { "user-agent": "LockSafe-UK/1.0" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`postcodes.io ${res.status} for ${outcode}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  if (!json?.result) return null;
  const r = json.result;
  const adminDistrict = Array.isArray(r.admin_district) ? r.admin_district : [];
  return {
    outcode:       r.outcode,
    longitude:     typeof r.longitude === "number" ? r.longitude : null,
    latitude:      typeof r.latitude  === "number" ? r.latitude  : null,
    northings:     typeof r.northings === "number" ? r.northings : null,
    eastings:      typeof r.eastings  === "number" ? r.eastings  : null,
    adminDistrict,
    anchorTown:    adminDistrict[0] ?? null,
    county:        Array.isArray(r.admin_county) ? r.admin_county : [],
    country:       Array.isArray(r.country) ? r.country : [],
    parish:        Array.isArray(r.parish) ? r.parish : [],
    parliamentaryConstituency: Array.isArray(r.parliamentary_constituency)
      ? r.parliamentary_constituency : [],
  };
}

/**
 * Find outcodes near a given centroid via postcodes.io's /outcodes endpoint
 * with lat/lon + radius. Returns up to 10 nearest by default. Excludes the
 * source outcode from the result.
 *
 * Radius is in METRES (postcodes.io's parameter unit). Default ~10mi.
 */
export async function fetchNearbyOutcodes(
  lat:          number,
  lng:          number,
  excludeOutcode: string,
  opts: { radiusMeters?: number; limit?: number } = {},
): Promise<string[]> {
  const radius = opts.radiusMeters ?? 16_000; // ~10 miles
  const limit  = opts.limit        ?? 10;
  const url    =
    `${BASE}/outcodes?lon=${lng}&lat=${lat}&radius=${radius}&limit=${limit + 1}`;

  const res = await fetch(url, { headers: { "user-agent": "LockSafe-UK/1.0" } });
  if (!res.ok) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  if (!Array.isArray(json?.result)) return [];
  const upperExclude = excludeOutcode.toUpperCase();
  return (json.result as Array<{ outcode?: string }>)
    .map((r) => r.outcode?.toUpperCase())
    .filter((o): o is string => Boolean(o) && o !== upperExclude)
    .slice(0, limit);
}

/**
 * One-shot helper used by the district landing page generator:
 * pulls both the outcode info AND its neighbours in one go.
 */
export async function enrichOutcode(outcode: string): Promise<{
  info:    OutcodeInfo;
  nearby:  string[];
} | null> {
  const info = await fetchOutcode(outcode);
  if (!info) return null;
  if (info.latitude === null || info.longitude === null) {
    return { info, nearby: [] };
  }
  const nearby = await fetchNearbyOutcodes(info.latitude, info.longitude, outcode);
  return { info, nearby };
}
