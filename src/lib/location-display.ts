const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;

export function normalizeUkPostcode(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.toUpperCase().replace(/\s+/g, "").trim();
  if (compact.length < 5) return null;
  return compact.replace(/^(.+)(\d[A-Z]{2})$/, "$1 $2");
}

export function extractUkPostcode(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(UK_POSTCODE_REGEX);
  return match ? normalizeUkPostcode(match[1]) : null;
}

export function isCoordinatePair(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(value);
}

export function formatBaseLocationLabel(
  baseAddress: string | null | undefined,
  fallbackPostcode?: string | null,
): string {
  const postcode = normalizeUkPostcode(fallbackPostcode) ?? extractUkPostcode(baseAddress);
  if (postcode) return postcode;

  if (baseAddress && !isCoordinatePair(baseAddress)) {
    return baseAddress;
  }

  return "Postcode unavailable";
}

export async function reverseGeocodePostcodeFromCoords(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          "User-Agent": "LockSafeUK/1.0 (operations@locksafe.uk)",
        },
      },
    );

    if (!response.ok) return null;
    const data = await response.json();

    const postcodeFromAddress = normalizeUkPostcode(data?.address?.postcode);
    if (postcodeFromAddress) return postcodeFromAddress;

    return extractUkPostcode(data?.display_name ?? "");
  } catch {
    return null;
  }
}
