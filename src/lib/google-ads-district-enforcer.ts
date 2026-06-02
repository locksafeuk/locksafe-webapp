import { ensureOrSkip } from "@/lib/district-landing/ensure-landing";

function getSiteUrl(): string {
  const raw =
    process.env["NEXT_PUBLIC_APP_URL"] ??
    process.env["SITE_URL"] ??
    "https://www.locksafe.uk";
  return raw.replace(/\/$/, "");
}

export function extractOutwardDistrictFromAddress(
  address: string | null | undefined,
): string | null {
  if (!address) return null;
  const fullMatch = address.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s+\d[A-Z]{2}\b/i);
  if (fullMatch?.[1]) return fullMatch[1].toUpperCase();

  const outwardMatch = address.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/i);
  if (outwardMatch?.[1]) return outwardMatch[1].toUpperCase();

  return null;
}

export function extractDistrictFromLocksmithInUrl(
  finalUrl: string | null | undefined,
): string | null {
  if (!finalUrl) return null;
  const match = finalUrl.match(/\/locksmith-in\/([a-z0-9-]+)/i);
  return match?.[1] ? match[1].toUpperCase() : null;
}

export interface EnforcedDistrictLanding {
  district: string;
  slug: string;
  finalUrl: string;
  source: "explicit_final_url" | "locksmith_address";
}

export async function enforceDistrictLandingForDraft(options: {
  explicitFinalUrl?: string | null;
  locksmithBaseAddress?: string | null;
  contextLabel: string;
}): Promise<EnforcedDistrictLanding> {
  const explicitDistrict = extractDistrictFromLocksmithInUrl(options.explicitFinalUrl);

  if (options.explicitFinalUrl && !explicitDistrict) {
    throw new Error(
      `${options.contextLabel}: finalUrl must be a district landing URL like https://www.locksafe.uk/locksmith-in/WA1`,
    );
  }

  const district = explicitDistrict ?? extractOutwardDistrictFromAddress(options.locksmithBaseAddress);
  if (!district) {
    throw new Error(
      `${options.contextLabel}: could not resolve a UK district from locksmith base address`,
    );
  }

  const ensured = await ensureOrSkip(district);
  if (!ensured.ok) {
    throw new Error(
      `${options.contextLabel}: district landing not available for ${district} (${ensured.skipReason ?? "no coverage"})`,
    );
  }

  const slug = ensured.result?.slug ?? district.toLowerCase();
  return {
    district,
    slug,
    finalUrl: `${getSiteUrl()}/locksmith-in/${slug}`,
    source: explicitDistrict ? "explicit_final_url" : "locksmith_address",
  };
}
