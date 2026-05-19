/**
 * Geo guard: ensure locksmith base locations are within the UK or Ireland
 * (incl. Crown Dependencies). Used by signup / profile-update flows.
 */

// Rough bounding box covering Great Britain, Northern Ireland, Republic of
// Ireland, Isle of Man, and the Channel Islands. Anything outside is rejected
// fast without an external API call.
const UK_IE_BBOX = {
  minLat: 49.0,   // Channel Islands / Scilly south
  maxLat: 61.0,   // Shetland north
  minLng: -10.8,  // Western Ireland
  maxLng: 2.1,    // Norfolk east
};

const ALLOWED_COUNTRY_CODES = new Set([
  "gb", // United Kingdom (England, Scotland, Wales, Northern Ireland)
  "ie", // Republic of Ireland
  "im", // Isle of Man
  "je", // Jersey
  "gg", // Guernsey
]);

export interface GeoCheckResult {
  ok: boolean;
  countryCode?: string;
  reason?: string;
}

function inBoundingBox(lat: number, lng: number): boolean {
  return (
    lat >= UK_IE_BBOX.minLat &&
    lat <= UK_IE_BBOX.maxLat &&
    lng >= UK_IE_BBOX.minLng &&
    lng <= UK_IE_BBOX.maxLng
  );
}

/**
 * Reverse-geocodes via Nominatim and returns the ISO 3166-1 alpha-2 country
 * code. Returns null on any failure (caller should decide how to treat that).
 */
async function reverseGeocodeCountry(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "LockSafeUK/1.0 (admin@locksafe.uk)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: { country_code?: string } };
    return data.address?.country_code?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/**
 * Validates that the given coordinates fall within UK or Ireland.
 * Strategy: cheap bounding-box reject, then reverse-geocode for accuracy.
 * If reverse geocoding fails (network/timeout), we still accept points that
 * passed the bounding box — better than silently rejecting genuine users
 * when an external service is down.
 */
export async function isInUkOrIreland(lat: number, lng: number): Promise<GeoCheckResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "Invalid coordinates" };
  }
  if (!inBoundingBox(lat, lng)) {
    return {
      ok: false,
      reason: "LockSafe partners are currently only accepted in the United Kingdom and Ireland.",
    };
  }
  const countryCode = await reverseGeocodeCountry(lat, lng);
  if (countryCode && !ALLOWED_COUNTRY_CODES.has(countryCode)) {
    return {
      ok: false,
      countryCode,
      reason: "LockSafe partners are currently only accepted in the United Kingdom and Ireland.",
    };
  }
  return { ok: true, countryCode: countryCode ?? undefined };
}
