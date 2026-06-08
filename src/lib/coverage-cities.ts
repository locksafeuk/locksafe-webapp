/**
 * Locksmith coverage footprint — derived from the live locksmith base
 * locations + coverage radii (computed 2026-06-08 against city centroids in
 * uk-cities-data.ts). Used to gate location-based page generation so we only
 * build pages for areas we can actually serve (avoids thin/unservable pages).
 *
 * COVERED_CITY_SLUGS: a locksmith's coverage radius reaches the city centre.
 * Borderline cities within ~2 miles of range are included as effectively
 * covered. Re-run scripts/coverage check if the locksmith network changes
 * materially.
 */

/** Cities a locksmith network locksmith can reach (city centre within range). */
export const COVERED_CITY_SLUGS: readonly string[] = Object.freeze([
  "london",
  "manchester",
  "liverpool",
  "birmingham",
  "coventry",
  "wolverhampton",
  "leeds",
  "sheffield",
  "bradford",
  "york",
  "newcastle",
  "sunderland",
  "cambridge",
  "peterborough",
  "ipswich",
  "brighton",
  "oxford",
  "reading",
  "southampton",
  "portsmouth",
  "milton-keynes",
  "bristol",
  "exeter",
  "bath",
  "cardiff",
  "swansea",
  "newport",
  "belfast",
  "stoke-on-trent",
  "wakefield",
  "preston",
  "blackpool",
  "bolton",
  "stockport",
  "warrington",
  "chester",
  "huddersfield",
  "halifax",
  "lancaster",
  "worcester",
  "cheltenham",
  "northampton",
  "stevenage",
  "chelmsford",
  "colchester",
  "watford",
  "luton",
  "st-albans",
  "slough",
  "guildford",
  "crawley",
  "maidstone",
  "worthing",
  "carlisle",
  "wrexham",
  // Borderline (within ~2mi of range) — effectively covered:
  "middlesbrough",
  "salisbury",
  "gloucester",
  "poole",
  "derby",
  "leicester",
]);

export function isCoveredCity(slug: string): boolean {
  return COVERED_CITY_SLUGS.includes(slug);
}

/**
 * Curated set for LOCALIZED competitor-alternative pages
 * (/alternatives/{competitor}/in/{city}). Kept deliberately small — top
 * brand-searched competitors × the biggest covered cities — so each page is
 * a genuinely distinct, locally-relevant page rather than thin duplication.
 */
export const LOCALIZED_ALT_COMPETITORS: readonly string[] = Object.freeze([
  "keytek",
  "keys4u",
  "timpson",
  "checkatrade",
]);

export const LOCALIZED_ALT_CITIES: readonly string[] = Object.freeze([
  "london",
  "manchester",
  "birmingham",
  "leeds",
  "liverpool",
  "bristol",
  "sheffield",
  "cardiff",
  "newcastle",
  "southampton",
  "coventry",
  "bradford",
]);

/** Every (competitor, city) pair we statically build localized pages for. */
export function localizedAltPairs(): Array<{
  competitor: string;
  city: string;
}> {
  const pairs: Array<{ competitor: string; city: string }> = [];
  for (const competitor of LOCALIZED_ALT_COMPETITORS) {
    for (const city of LOCALIZED_ALT_CITIES) {
      pairs.push({ competitor, city });
    }
  }
  return pairs;
}
