import { NextRequest, NextResponse } from "next/server";

/**
 * Postcode → real UK address lookup proxy.
 *
 * Provider order (server-side only — keys never reach the browser):
 *   1. Google Places API (New) — Autocomplete restricted to GB.
 *      We use the suggestion text directly (no Place Details call) so each
 *      request costs one Autocomplete unit, well inside the $200/mo free credit.
 *   2. getAddress.io /find then /autocomplete (kept as a fallback if the
 *      account/plan supports it).
 *   3. postcodes.io for lat/lng only when no provider returned addresses.
 *
 * If everything fails, we return an empty `addresses` array — the UI then
 * prompts the user to type the address manually. We never fabricate addresses.
 */

export const runtime = "nodejs";

const POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

interface AddressDTO {
  line1: string;
  line2?: string;
  line3?: string;
  town: string;
  county?: string;
  formatted: string;
}

interface UpstreamInfo {
  status: number;
  endpoint: string;
  message?: string;
}

interface LookupResponse {
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  addresses: AddressDTO[];
  source:
    | "google-places"
    | "getaddress-find"
    | "getaddress-autocomplete"
    | "postcodesio"
    | "none";
  upstream?: UpstreamInfo;
}

interface PostcodesIoResponse {
  status?: number;
  result?: {
    postcode?: string;
    latitude?: number;
    longitude?: number;
  };
}

function normalisePostcode(raw: string): string {
  const cleaned = raw.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 5) return cleaned;
  return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
}

// ---------------------------------------------------------------------------
// Google Places (New) — Autocomplete
// ---------------------------------------------------------------------------

interface GooglePlaceSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

interface GoogleAutocompleteResponse {
  suggestions?: GooglePlaceSuggestion[];
  error?: { message?: string; status?: string };
}

function parseFormattedAddress(formatted: string, postcode: string): AddressDTO {
  // Google returns e.g. "10 Watkin Terrace, Northampton NN1 3ER, UK"
  const trimmed = formatted
    .replace(/,\s*(UK|United Kingdom|England|Scotland|Wales|Northern Ireland)\s*$/i, "")
    .trim();
  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && p.toUpperCase() !== postcode.toUpperCase());

  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    const withoutPc = last
      .replace(new RegExp(postcode.replace(/\s+/g, "\\s*"), "i"), "")
      .trim();
    if (withoutPc) parts[parts.length - 1] = withoutPc;
    else parts.pop();
  }

  const line1 = parts[0] || trimmed;
  const town = parts[parts.length - 1] || "";
  const county = parts.length > 2 ? parts[parts.length - 1] : undefined;

  return {
    line1,
    line2: parts.length > 2 ? parts[1] : undefined,
    line3: parts.length > 3 ? parts[2] : undefined,
    town,
    county,
    formatted: trimmed.toUpperCase().includes(postcode.toUpperCase())
      ? trimmed
      : `${trimmed}, ${postcode}`,
  };
}

async function tryGooglePlaces(
  postcode: string,
  apiKey: string
): Promise<{ result: LookupResponse | null; upstream: UpstreamInfo }> {
  const endpoint = "google:places:autocomplete";
  const url = "https://places.googleapis.com/v1/places:autocomplete";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: postcode,
        includedRegionCodes: ["GB"],
        languageCode: "en-GB",
        includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      }),
    });

    const status = res.status;
    if (!res.ok) {
      const body = await res.text().catch(() => undefined);
      return {
        result: null,
        upstream: { status, endpoint, message: body?.slice(0, 300) },
      };
    }

    const data = (await res.json()) as GoogleAutocompleteResponse;
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

    const addresses: AddressDTO[] = [];
    const seen = new Set<string>();
    const pcUpper = postcode.toUpperCase();
    const pcCompact = postcode.replace(/\s/g, "").toUpperCase();
    for (const s of suggestions) {
      const text = s.placePrediction?.text?.text?.trim();
      if (!text) continue;
      const upper = text.toUpperCase();
      if (!upper.includes(pcUpper) && !upper.includes(pcCompact)) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      addresses.push(parseFormattedAddress(text, postcode));
    }

    return {
      result: {
        postcode,
        latitude: null,
        longitude: null,
        addresses,
        source: "google-places",
      },
      upstream: { status, endpoint },
    };
  } catch (err) {
    return {
      result: null,
      upstream: {
        status: 0,
        endpoint,
        message: err instanceof Error ? err.message : "fetch failed",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// getAddress.io — kept as a fallback
// ---------------------------------------------------------------------------

interface GetAddressExpandedItem {
  formatted_address?: string[];
  line_1?: string;
  line_2?: string;
  line_3?: string;
  line_4?: string;
  locality?: string;
  town_or_city?: string;
  county?: string;
}

interface GetAddressFindResponse {
  postcode?: string;
  latitude?: number;
  longitude?: number;
  addresses?: GetAddressExpandedItem[];
}

interface GetAddressAutocompleteResponse {
  suggestions?: Array<{ address?: string; id?: string }>;
}

function mapFindItem(item: GetAddressExpandedItem, postcode: string): AddressDTO | null {
  const formattedParts = (item.formatted_address ?? []).map((p) => p.trim()).filter(Boolean);
  const town =
    item.town_or_city?.trim() ||
    item.locality?.trim() ||
    formattedParts[formattedParts.length - 2] ||
    "";
  const line1 = item.line_1?.trim() || formattedParts[0] || "";
  if (!line1 && formattedParts.length === 0) return null;
  const formatted = [...formattedParts, postcode].filter(Boolean).join(", ");
  return {
    line1,
    line2: item.line_2?.trim() || undefined,
    line3: item.line_3?.trim() || undefined,
    town,
    county: item.county?.trim() || undefined,
    formatted,
  };
}

async function tryGetAddressFind(
  postcode: string,
  apiKey: string
): Promise<{ result: LookupResponse | null; upstream: UpstreamInfo }> {
  const endpoint = `getaddress:find/${encodeURIComponent(postcode)}`;
  const url = `https://api.getAddress.io/find/${encodeURIComponent(postcode)}?api-key=${encodeURIComponent(apiKey)}&expand=true`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const status = res.status;
    if (status === 404) {
      const text = await res.text();
      if (!text) return { result: null, upstream: { status, endpoint, message: "empty body" } };
      return {
        result: { postcode, latitude: null, longitude: null, addresses: [], source: "getaddress-find" },
        upstream: { status, endpoint },
      };
    }
    if (!res.ok) {
      const message = await res.text().catch(() => undefined);
      return { result: null, upstream: { status, endpoint, message: message?.slice(0, 200) } };
    }
    const data = (await res.json()) as GetAddressFindResponse;
    const items = Array.isArray(data.addresses) ? data.addresses : [];
    const mapped = items
      .map((item) => mapFindItem(item, data.postcode ?? postcode))
      .filter((a): a is AddressDTO => a !== null);
    return {
      result: {
        postcode: data.postcode ?? postcode,
        latitude: typeof data.latitude === "number" ? data.latitude : null,
        longitude: typeof data.longitude === "number" ? data.longitude : null,
        addresses: mapped,
        source: "getaddress-find",
      },
      upstream: { status, endpoint },
    };
  } catch (err) {
    return {
      result: null,
      upstream: {
        status: 0,
        endpoint,
        message: err instanceof Error ? err.message : "fetch failed",
      },
    };
  }
}

async function tryGetAddressAutocomplete(
  postcode: string,
  apiKey: string
): Promise<{ result: LookupResponse | null; upstream: UpstreamInfo }> {
  const endpoint = `getaddress:autocomplete/${encodeURIComponent(postcode)}`;
  const url = `https://api.getAddress.io/autocomplete/${encodeURIComponent(postcode)}?api-key=${encodeURIComponent(apiKey)}&all=true&top=40&template={formatted_address}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const status = res.status;
    if (!res.ok) {
      const message = await res.text().catch(() => undefined);
      return { result: null, upstream: { status, endpoint, message: message?.slice(0, 200) } };
    }
    const data = (await res.json()) as GetAddressAutocompleteResponse;
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    const addresses: AddressDTO[] = suggestions
      .map((s) => (s.address ?? "").trim())
      .filter((addr) => addr.length > 0)
      .map((addr) => parseFormattedAddress(addr, postcode));
    return {
      result: {
        postcode,
        latitude: null,
        longitude: null,
        addresses,
        source: "getaddress-autocomplete",
      },
      upstream: { status, endpoint },
    };
  } catch (err) {
    return {
      result: null,
      upstream: {
        status: 0,
        endpoint,
        message: err instanceof Error ? err.message : "fetch failed",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// postcodes.io — lat/lng fallback
// ---------------------------------------------------------------------------

async function fetchFromPostcodesIo(postcode: string): Promise<LookupResponse | null> {
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s/g, ""))}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as PostcodesIoResponse;
  if (data.status !== 200 || !data.result) return null;
  return {
    postcode: data.result.postcode ?? postcode,
    latitude: typeof data.result.latitude === "number" ? data.result.latitude : null,
    longitude: typeof data.result.longitude === "number" ? data.result.longitude : null,
    addresses: [],
    source: "postcodesio",
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("postcode") ?? "";
  if (!POSTCODE_REGEX.test(raw.trim())) {
    return NextResponse.json({ error: "Invalid UK postcode" }, { status: 400 });
  }

  const postcode = normalisePostcode(raw);
  const googleKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const getAddressKey = process.env.GETADDRESS_API_KEY;
  const isDev = process.env.NODE_ENV !== "production";

  let result: LookupResponse | null = null;
  let lastUpstream: UpstreamInfo | undefined;

  // 1. Google Places (preferred)
  if (googleKey) {
    const attempt = await tryGooglePlaces(postcode, googleKey);
    lastUpstream = attempt.upstream;
    if (attempt.result) {
      result = attempt.result;
    }
  }

  // 2. getAddress.io fallback (if Google returned nothing useful)
  if ((!result || result.addresses.length === 0) && getAddressKey) {
    const findAttempt = await tryGetAddressFind(postcode, getAddressKey);
    if (findAttempt.result && findAttempt.result.addresses.length > 0) {
      result = findAttempt.result;
      lastUpstream = findAttempt.upstream;
    } else {
      const acAttempt = await tryGetAddressAutocomplete(postcode, getAddressKey);
      if (acAttempt.result && acAttempt.result.addresses.length > 0) {
        result = acAttempt.result;
        lastUpstream = acAttempt.upstream;
      } else if (!result && findAttempt.result) {
        result = findAttempt.result;
        lastUpstream = findAttempt.upstream;
      }
    }
  }

  if (!result || result.addresses.length === 0) {
    console.error("[postcode/lookup] no addresses from any provider", lastUpstream);
  }

  // 3. lat/lng fallback via postcodes.io if not provided yet
  if (!result || result.latitude === null) {
    try {
      const fallback = await fetchFromPostcodesIo(postcode);
      if (fallback) {
        result = {
          postcode: result?.postcode ?? fallback.postcode,
          latitude: fallback.latitude,
          longitude: fallback.longitude,
          addresses: result?.addresses ?? [],
          source: result?.source ?? "postcodesio",
        };
      }
    } catch (err) {
      console.error("[postcode/lookup] postcodes.io error:", err);
    }
  }

  if (!result) {
    return NextResponse.json({ error: "Postcode not found" }, { status: 404 });
  }

  if (isDev && lastUpstream) {
    result.upstream = lastUpstream;
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
