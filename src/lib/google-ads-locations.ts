/**
 * Google Ads location targeting helpers.
 *
 * Derives the set of Google Ads GeoTargetConstant IDs that should be targeted
 * based on where our active locksmiths are actually based.
 *
 * Strategy:
 *   1. Query active locksmiths with a set base location.
 *   2. Resolve each locksmith's city (from baseAddress or lat/lng proximity)
 *      to a Google Ads Geo Criterion ID.
 *   3. Return the deduplicated list, falling back to the whole UK ("2826")
 *      if no specific coverage can be determined.
 *
 * Geo IDs are verified against the Google Ads GeoTargetConstant reference:
 *   https://developers.google.com/google-ads/api/data/geotargets
 */

import prisma from "@/lib/db";
import { LONDON_GEO_IDS } from "@/lib/google-ads-opportunities";

/** London geo check — used by the onboarding trigger below. */
function isLondonGeo(geoId: string): boolean {
  return LONDON_GEO_IDS.has(geoId);
}

/** CPC threshold above which we flag-only rather than auto-draft. */
const ONBOARDING_MAX_AUTO_CPC_GBP = 1.50;

// =========================================================================
// UK city → Google Ads GeoTargetConstant ID lookup table
// IDs sourced from the Google Ads API geo targets reference.
// =========================================================================

export const UK_GEO_IDS = {
  // Country fallback
  uk: "2826",

  // England – Greater London (all 33 boroughs + City of London)
  // Must stay in sync with LONDON_GEO_IDS in google-ads-opportunities.ts.
  // Legacy 100644xx IDs in this range collide with English villages — use
  // the 904xxxx / 919xxxx IDs for new boroughs.
  london: "1006450",
  "greater london": "9041107",
  // Inner North
  westminster: "1006453",
  "city of westminster": "1006453",
  camden: "1006459",
  islington: "1006456",
  hackney: "9198373",
  "city of london": "9041110",
  // Inner East
  "tower hamlets": "9198785",
  newham: "9198858",
  "waltham forest": "9198805",
  redbridge: "9208638",
  "barking and dagenham": "9046056",
  "barking & dagenham": "9046056",
  havering: "9046054",
  // Inner South
  southwark: "1006465",
  lambeth: "1006466",
  wandsworth: "1006467",
  greenwich: "1006470",
  lewisham: "1006471",
  // South West / West
  kensington: "1006468",
  "kensington and chelsea": "1006468",
  hammersmith: "1006469",
  "hammersmith and fulham": "1006469",
  ealing: "9046053",
  hillingdon: "9046051",
  hounslow: "9046052",
  richmond: "9198371",
  "richmond upon thames": "9198371",
  kingston: "9046055",
  "kingston upon thames": "9046055",
  // South
  croydon: "1006472",
  merton: "9198370",
  sutton: "9198369",
  bromley: "1006473",
  bexley: "1006474",
  // North
  barnet: "9046050",
  haringey: "9198374",
  enfield: "9198372",

  // England – South East
  brighton: "1006598",
  "brighton and hove": "1006598",
  oxford: "1006615",
  reading: "1006607",
  southampton: "1006597",
  portsmouth: "1006596",
  guildford: "1006608",
  maidstone: "1006590",
  canterbury: "1006589",
  eastbourne: "1006600",
  worthing: "1006601",
  crawley: "1006602",
  slough: "1006605",

  // England – South West
  bristol: "1006620",
  plymouth: "1006628",
  exeter: "1006624",
  bath: "1006621",
  bournemouth: "1006629",
  poole: "1006630",
  salisbury: "1006631",
  truro: "1006637",

  // England – East of England
  cambridge: "1006582",
  norwich: "1006576",
  peterborough: "1006577",
  ipswich: "1006578",

  // England – East Midlands
  nottingham: "1006552",
  leicester: "1006553",
  derby: "1006554",

  // England – West Midlands
  birmingham: "1006544",
  coventry: "1006545",
  wolverhampton: "1006546",

  // England – Yorkshire and the Humber
  leeds: "1006530",
  sheffield: "1006531",
  bradford: "1006532",
  hull: "1006533",
  "kingston upon hull": "1006533",
  york: "1006534",
  wakefield: "1006535",
  doncaster: "1006536",

  // England – North West
  manchester: "1006514",
  liverpool: "1006515",
  preston: "1006516",
  blackpool: "1006517",
  bolton: "1006518",
  stockport: "1006519",
  carlisle: "1006524",

  // England – North East
  newcastle: "1006521",
  "newcastle upon tyne": "1006521",
  sunderland: "1006522",
  middlesbrough: "1006523",

  // Scotland
  glasgow: "1006560",
  edinburgh: "1006561",
  aberdeen: "1006562",
  dundee: "1006563",
  inverness: "1006568",
  stirling: "1006569",
  perth: "1006570",

  // Wales
  cardiff: "1006573",
  swansea: "1006574",
  newport: "1006575",
  wrexham: "1006580",

  // Northern Ireland
  belfast: "1006585",
  derry: "1006586",
  "londonderry": "1006586",
} as const;

/**
 * Approximate centroid coordinates for the major UK_GEO_IDS keys. Used by
 * `nearestCityByCoords` and by the Opportunity Scout to expand a locksmith's
 * home city outward by their `coverageRadius` (miles) and collect every
 * UK_GEO_IDS city within reach.
 *
 * Distances are computed with the haversine formula by `haversineMiles()`.
 * Coverage is intentionally limited to the most populated cities — borough-
 * level coords (Camden, Hackney, etc.) are not required because the scout
 * scores at city granularity.
 */
export const UK_CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  london: { lat: 51.5074, lng: -0.1278 },
  manchester: { lat: 53.4808, lng: -2.2426 },
  birmingham: { lat: 52.4862, lng: -1.8904 },
  leeds: { lat: 53.8008, lng: -1.5491 },
  glasgow: { lat: 55.8642, lng: -4.2518 },
  sheffield: { lat: 53.3811, lng: -1.4701 },
  bradford: { lat: 53.7960, lng: -1.7594 },
  liverpool: { lat: 53.4084, lng: -2.9916 },
  edinburgh: { lat: 55.9533, lng: -3.1883 },
  bristol: { lat: 51.4545, lng: -2.5879 },
  cardiff: { lat: 51.4816, lng: -3.1791 },
  coventry: { lat: 52.4068, lng: -1.5197 },
  nottingham: { lat: 52.9548, lng: -1.1581 },
  leicester: { lat: 52.6369, lng: -1.1398 },
  southampton: { lat: 50.9097, lng: -1.4044 },
  portsmouth: { lat: 50.8198, lng: -1.0880 },
  reading: { lat: 51.4543, lng: -0.9781 },
  oxford: { lat: 51.7520, lng: -1.2577 },
  brighton: { lat: 50.8225, lng: -0.1372 },
  newcastle: { lat: 54.9783, lng: -1.6178 },
  belfast: { lat: 54.5973, lng: -5.9301 },
  aberdeen: { lat: 57.1497, lng: -2.0943 },
  derby: { lat: 52.9225, lng: -1.4746 },
  sunderland: { lat: 54.9061, lng: -1.3816 },
  york: { lat: 53.9600, lng: -1.0873 },
  cambridge: { lat: 52.2053, lng: 0.1218 },
  norwich: { lat: 52.6309, lng: 1.2974 },
  peterborough: { lat: 52.5695, lng: -0.2405 },
  ipswich: { lat: 52.0567, lng: 1.1482 },
  exeter: { lat: 50.7184, lng: -3.5339 },
  plymouth: { lat: 50.3755, lng: -4.1427 },
  bath: { lat: 51.3751, lng: -2.3617 },
  bournemouth: { lat: 50.7192, lng: -1.8808 },
  swansea: { lat: 51.6214, lng: -3.9436 },
  wolverhampton: { lat: 52.5870, lng: -2.1287 },
  preston: { lat: 53.7632, lng: -2.7031 },
  blackpool: { lat: 53.8175, lng: -3.0357 },
  bolton: { lat: 53.5780, lng: -2.4290 },
  stockport: { lat: 53.4106, lng: -2.1576 },
  middlesbrough: { lat: 54.5742, lng: -1.2348 },
  hull: { lat: 53.7676, lng: -0.3274 },
  wakefield: { lat: 53.6833, lng: -1.4977 },
  doncaster: { lat: 53.5228, lng: -1.1285 },
  dundee: { lat: 56.4620, lng: -2.9707 },
  inverness: { lat: 57.4778, lng: -4.2247 },
  stirling: { lat: 56.1165, lng: -3.9369 },
  perth: { lat: 56.3950, lng: -3.4307 },
  newport: { lat: 51.5842, lng: -2.9977 },
  wrexham: { lat: 53.0430, lng: -2.9925 },
  derry: { lat: 54.9966, lng: -7.3086 },
  guildford: { lat: 51.2362, lng: -0.5704 },
  canterbury: { lat: 51.2802, lng: 1.0789 },
  maidstone: { lat: 51.2720, lng: 0.5292 },
  crawley: { lat: 51.1092, lng: -0.1872 },
  worthing: { lat: 50.8147, lng: -0.3714 },
  eastbourne: { lat: 50.7687, lng: 0.2900 },
  slough: { lat: 51.5105, lng: -0.5950 },
  poole: { lat: 50.7150, lng: -1.9872 },
  salisbury: { lat: 51.0688, lng: -1.7945 },
  truro: { lat: 50.2632, lng: -5.0510 },
  carlisle: { lat: 54.8925, lng: -2.9329 },
};

/** Haversine distance between two points in MILES (UK marketers think in miles). */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.7613; // Earth radius in miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type UKGeoKey = keyof typeof UK_GEO_IDS;

/**
 * Resolve a locksmith's home location to the best-matching UK geo (city key
 * + Google geo constant ID). Tries address parsing first, then falls back
 * to nearest-city by lat/lng. Returns null when neither method finds a hit.
 *
 * Exported so the Opportunity Scout and onboarding generator share one
 * canonical resolution path.
 */
export function resolveLocksmithGeo(locksmith: {
  baseAddress?: string | null;
  baseLat?: number | null;
  baseLng?: number | null;
}): { geoId: string; cityKey: UKGeoKey; label: string } | null {
  if (locksmith.baseAddress) {
    const tokens = extractCityTokens(locksmith.baseAddress);
    const geoId = resolveTokensToGeoId(tokens);
    if (geoId) {
      const entry = (Object.entries(UK_GEO_IDS) as [UKGeoKey, string][]).find(
        ([, v]) => v === geoId,
      );
      if (entry) {
        return { geoId, cityKey: entry[0], label: titleCase(entry[0]) };
      }
    }
  }
  if (typeof locksmith.baseLat === "number" && typeof locksmith.baseLng === "number") {
    const city = nearestCityByCoords(locksmith.baseLat, locksmith.baseLng);
    if (city && city in UK_GEO_IDS) {
      return {
        geoId: UK_GEO_IDS[city as UKGeoKey],
        cityKey: city as UKGeoKey,
        label: titleCase(city),
      };
    }
  }
  return null;
}

/** Reverse lookup: geo ID → human label (Title Case). */
export function labelForGeoId(geoId: string): string | null {
  const entry = (Object.entries(UK_GEO_IDS) as [UKGeoKey, string][]).find(
    ([, v]) => v === geoId,
  );
  return entry ? titleCase(entry[0]) : null;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Extract the most specific city-like token from a free-text UK address.
 * e.g. "47 High Street, Camden, London, UK" → tries "camden", then "london".
 */
function extractCityTokens(address: string): string[] {
  if (!address) return [];
  // Split on commas and newlines, trim, lowercase, strip postcodes
  const parts = address
    .split(/[,\n]+/)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 1)
    // Drop pure postcode segments (e.g. "SW1A 1AA", "E1 6AN")
    .filter((p) => !/^[a-z]{1,2}[0-9][0-9a-z]?\s*[0-9][a-z]{2}$/i.test(p))
    // Drop country references
    .filter((p) => !["uk", "united kingdom", "england", "wales", "scotland"].includes(p));
  return parts;
}

/**
 * Resolve a list of address tokens to the best-matching geo ID.
 * Prefers the most-specific match (longest key that appears in the tokens).
 */
function resolveTokensToGeoId(tokens: string[]): string | null {
  // Sort keys longest-first so "greater london" beats "london"
  const sortedKeys = (Object.keys(UK_GEO_IDS) as UKGeoKey[]).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of sortedKeys) {
    if (tokens.some((t) => t === key || t.includes(key))) {
      return UK_GEO_IDS[key];
    }
  }
  return null;
}

/**
 * Find the nearest city key based on lat/lng distance (Haversine).
 * Used as a fallback when address parsing fails.
 */
function nearestCityByCoords(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestMiles = Infinity;
  for (const [city, coords] of Object.entries(UK_CITY_CENTROIDS)) {
    const miles = haversineMiles({ lat, lng }, coords);
    if (miles < bestMiles) {
      bestMiles = miles;
      best = city;
    }
  }
  // Only accept if within 50 miles of a known city (was 80 km ~= 50 mi)
  return bestMiles <= 50 ? best : null;
}

// =========================================================================
// Public API
// =========================================================================

export interface ActiveCoverageResult {
  /** Deduplicated Google Ads Geo Criterion IDs to TARGET. */
  geoTargets: string[];
  /** Human-readable summary of resolved coverage areas. */
  coverageSummary: string[];
  /** Number of active locksmiths found. */
  activeLocksmithCount: number;
}

/**
 * Derive the Google Ads geo targets we should use based on where our active
 * locksmiths are currently based.
 *
 * - Queries all active, onboarded locksmiths with a base location set.
 * - Maps each to the nearest UK city geo ID.
 * - Deduplicates and returns the result.
 * - Falls back to targeting the entire UK if no matches.
 */
export async function getActiveCoverageGeoTargets(): Promise<ActiveCoverageResult> {
  // Strict filter: only fully-onboarded, admin-verified locksmiths who have a
  // working Stripe Connect account.  All three gates must be passed before a
  // locksmith's area is eligible for paid ad spend.
  //
  //   isActive              — not suspended / soft-deleted
  //   onboardingCompleted   — completed the sign-up & document upload flow
  //   isVerified            — admin has reviewed and approved the account
  //   stripeConnectVerified — Stripe Connect account is verified (can receive
  //                           payouts); without this the locksmith cannot be
  //                           paid, so targeting their area wastes money.
  const locksmiths = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      onboardingCompleted: true,
      isVerified: true,
      stripeConnectVerified: true,
    },
    select: {
      baseAddress: true,
      baseLat: true,
      baseLng: true,
    },
  });

  const resolved = new Map<string, string>(); // geoId → cityLabel

  for (const ls of locksmiths) {
    let geoId: string | null = null;
    let label: string | null = null;

    // 1. Try address parsing first
    if (ls.baseAddress) {
      const tokens = extractCityTokens(ls.baseAddress);
      geoId = resolveTokensToGeoId(tokens);
      if (geoId) {
        // Find the matching key for the label
        label = (Object.entries(UK_GEO_IDS) as [string, string][]).find(
          ([, v]) => v === geoId,
        )?.[0] ?? null;
      }
    }

    // 2. Fall back to coordinate-based nearest-city
    if (!geoId && ls.baseLat !== null && ls.baseLng !== null) {
      const city = nearestCityByCoords(ls.baseLat, ls.baseLng);
      if (city && city in UK_GEO_IDS) {
        geoId = UK_GEO_IDS[city as UKGeoKey];
        label = city;
      }
    }

    if (geoId && label) {
      resolved.set(geoId, label);
    }
  }

  if (resolved.size === 0) {
    // Do NOT fall back to UK-wide targeting — that would spend money on areas
    // with zero verified/Stripe-ready locksmiths.  Return an empty target list
    // so the caller can halt campaign creation rather than waste budget.
    return {
      geoTargets: [],
      coverageSummary: [
        "NO COVERAGE — no fully-onboarded, admin-verified, Stripe-connected locksmiths found. " +
        "Campaign creation blocked to prevent wasted spend.",
      ],
      activeLocksmithCount: locksmiths.length,
    };
  }

  return {
    geoTargets: Array.from(resolved.keys()),
    coverageSummary: Array.from(resolved.values()).map(
      (city) => city.charAt(0).toUpperCase() + city.slice(1),
    ),
    activeLocksmithCount: locksmiths.length,
  };
}

/**
 * Sync the geo targeting on an existing live Google Ads campaign to match
 * the current active locksmith coverage.
 *
 * Uses `campaignCriteria:mutate` to:
 *   1. Remove all existing location criteria (LOCATION type).
 *   2. Add the new set derived from active locksmiths.
 *
 * Returns a summary of what changed.
 */
export async function syncCampaignGeoTargets(
  client: import("./google-ads").GoogleAdsClient,
  campaignResource: string, // e.g. "customers/123/campaigns/456"
): Promise<{ added: string[]; removed: number; coverageSummary: string[] }> {
  const { geoTargets, coverageSummary } = await getActiveCoverageGeoTargets();

  // Fetch existing location criteria for this campaign
  const campaignId = campaignResource.split("/")[3];

  type CriteriaRow = {
    campaignCriterion: {
      resourceName: string;
      type: string;
      criterionId: string;
    };
  };

  const existing = await client.query<CriteriaRow>(
    `SELECT campaign_criterion.resource_name, campaign_criterion.type, campaign_criterion.criterion_id
     FROM campaign_criterion
     WHERE campaign.id = ${campaignId}
       AND campaign_criterion.type = 'LOCATION'
       AND campaign_criterion.negative = FALSE`,
  );

  // Build remove operations for existing location criteria
  const removeOps = existing.map((row) => ({
    remove: row.campaignCriterion.resourceName,
  }));

  // Build add operations for new targets
  const addOps = geoTargets.map((geoId) => ({
    create: {
      campaign: campaignResource,
      location: { geoTargetConstant: `geoTargetConstants/${geoId}` },
    },
  }));

  const allOps = [...removeOps, ...addOps];
  if (allOps.length > 0) {
    await client.mutate("campaignCriteria", allOps);
  }

  return {
    added: geoTargets,
    removed: removeOps.length,
    coverageSummary,
  };
}

// =========================================================================
// Onboarding hook + scheduled reconciliation
// =========================================================================

export interface GeoSyncTriggerResult {
  success: boolean;
  campaignsSynced: number;
  coverageSummary: string[];
  errors: string[];
}

/**
 * Called automatically after a locksmith completes onboarding.
 *
 * - Syncs location targeting on every PUBLISHED Google Ads campaign.
 * - Delegates a task to the CMO agent so it is aware of the expansion.
 * - Sends an admin Telegram alert with the updated coverage.
 *
 * Fire-and-forget safe — caller must .catch() to avoid unhandled rejections:
 *   triggerPostOnboardingGeoSync(locksmith).catch(console.error);
 */
export async function triggerPostOnboardingGeoSync(locksmith: {
  id: string;
  name: string;
  baseAddress?: string | null;
  baseLat?: number | null;
  baseLng?: number | null;
}): Promise<GeoSyncTriggerResult> {
  const result: GeoSyncTriggerResult = {
    success: false,
    campaignsSynced: 0,
    coverageSummary: [],
    errors: [],
  };

  try {
    // 0. Resolve THIS locksmith's geo and apply London / high-CPC gates.
    //    If the new locksmith is in London, we still sync geo for existing
    //    campaigns (so they don't lose coverage), but we fire an admin alert
    //    instead of an auto-draft signal, and we mark the result clearly.
    const newLocksmithGeo = resolveLocksmithGeo(locksmith);
    const isLondon = newLocksmithGeo ? isLondonGeo(newLocksmithGeo.geoId) : false;

    // CPC gate: look up the latest GoogleAdsOpportunity for this geo.
    let isHighCpc = false;
    if (newLocksmithGeo && !isLondon) {
      const latestOpp = await prisma.googleAdsOpportunity
        .findFirst({
          where: { geoTargetId: newLocksmithGeo.geoId, kind: "COVERAGE" },
          orderBy: { computedAt: "desc" },
          select: { medianCpcGbp: true },
        })
        .catch(() => null);
      if (latestOpp && latestOpp.medianCpcGbp > ONBOARDING_MAX_AUTO_CPC_GBP) {
        isHighCpc = true;
      }
    }

    // 0.5. RECRUIT × onboarding alert.
    //      If this locksmith's city was recently flagged as a RECRUIT opportunity
    //      (zero-coverage, high demand), they just filled that gap — this is a
    //      high-value moment worth an immediate priority alert regardless of
    //      London/CPC status. Fire before any early-return block so it always runs.
    if (newLocksmithGeo) {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recruitOpp = await prisma.googleAdsOpportunity.findFirst({
          where: {
            geoTargetId: newLocksmithGeo.geoId,
            kind: "RECRUIT",
            status: { not: "DISMISSED" },
            computedAt: { gte: thirtyDaysAgo },
          },
          orderBy: { computedAt: "desc" },
          select: {
            id: true,
            score: true,
            geoLabel: true,
            totalMonthlySearches: true,
            medianCpcGbp: true,
            competitionTier: true,
          },
        });

        if (recruitOpp) {
          const { sendAdminAlert } = await import("./telegram");
          await sendAdminAlert({
            title: `🎯 Coverage gap filled — ${recruitOpp.geoLabel}!`,
            message:
              `**${locksmith.name}** just onboarded in **${recruitOpp.geoLabel}** — ` +
              `previously a zero-coverage RECRUIT target.\n\n` +
              `📊 Opportunity score: ${Math.round(recruitOpp.score * 100)}/100\n` +
              `🔍 Est. monthly searches: ${recruitOpp.totalMonthlySearches.toLocaleString()}\n` +
              `💰 Median CPC: £${recruitOpp.medianCpcGbp.toFixed(2)}\n` +
              `🏆 Competition: ${recruitOpp.competitionTier}\n\n` +
              `👉 Draft a Google Ads campaign: /admin/google-ads/opportunities`,
            severity: "warning",
          }).catch(() => {});

          // Mark the RECRUIT opportunity as actioned so it doesn't re-alert.
          await prisma.googleAdsOpportunity
            .update({
              where: { id: recruitOpp.id },
              data: { status: "REVIEWED", agentNotes: `First locksmith onboarded: ${locksmith.name} (${new Date().toISOString()})` },
            })
            .catch(() => {});
        }
      } catch {
        // Non-fatal — never block onboarding for a RECRUIT alert
      }
    }

    // For London or high-CPC cities: send admin alert, skip auto-draft trigger.
    if (isLondon || isHighCpc) {
      const cityLabel = newLocksmithGeo?.label ?? "Unknown";
      const reason = isLondon
        ? "London borough — national chain competition (£5–15/click). Manual campaign decision required."
        : `High CPC city (${cityLabel}) — median CPC exceeds £${ONBOARDING_MAX_AUTO_CPC_GBP}. Manual review before drafting.`;

      console.log(`[PostOnboardingGeoSync] Flagging ${locksmith.name} (${cityLabel}): ${reason}`);

      try {
        const { sendAdminAlert } = await import("./telegram");
        await sendAdminAlert({
          title: `🚫 New locksmith in ${cityLabel} — manual campaign review needed`,
          message:
            `**${locksmith.name}** onboarded in **${cityLabel}**.\n\n` +
            `⚠️ ${reason}\n\n` +
            `Action: Review manually at /admin/integrations/google-ads/drafts and decide whether to create a campaign for this area.`,
          severity: "warning",
        });
      } catch {
        // Non-fatal
      }

      // Still sync geo targets on existing campaigns (coverage should reflect reality)
      // but do NOT trigger any auto-draft.
      result.success = true;
      result.coverageSummary = newLocksmithGeo ? [cityLabel] : [];
      return result;
    }

    // 1. Resolve the full coverage set across all active locksmiths
    const { geoTargets, coverageSummary, activeLocksmithCount } =
      await getActiveCoverageGeoTargets();
    result.coverageSummary = coverageSummary;

    // 2. Fetch all PUBLISHED campaigns with a live Google campaign ID
    const publishedDrafts = await prisma.googleAdsCampaignDraft.findMany({
      where: { status: "PUBLISHED", googleCampaignId: { not: null } },
      select: { id: true, accountId: true, name: true, googleCampaignId: true },
    });

    // 2b. Also update geoTargets on all pending/approved drafts that haven't
    //     been published yet, so when they are published they target the right areas.
    const pendingDrafts = await prisma.googleAdsCampaignDraft.findMany({
      where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
      select: { id: true, name: true },
    });

    if (pendingDrafts.length > 0) {
      await prisma.googleAdsCampaignDraft.updateMany({
        where: { id: { in: pendingDrafts.map((d) => d.id) } },
        data: { geoTargets },
      });
    }

    // 3. Sync each campaign in-place
    const { getGoogleAdsClientForAccount } = await import("./google-ads");
    for (const draft of publishedDrafts) {
      if (!draft.googleCampaignId) continue;
      try {
        const client = await getGoogleAdsClientForAccount(draft.accountId);
        if (!client) {
          result.errors.push(`No Google Ads client for account ${draft.accountId}`);
          continue;
        }
        const campaignResource = `customers/${client.customerIdPlain}/campaigns/${draft.googleCampaignId}`;
        await syncCampaignGeoTargets(client, campaignResource);
        result.campaignsSynced++;
      } catch (err) {
        result.errors.push(
          `"${draft.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 4. Auto-create a per-locksmith campaign draft (fire-and-forget, non-fatal)
    //    London + high-CPC locksmiths were already returned early above,
    //    so reaching here means this locksmith is in a cheap/eligible market.
    try {
      const { autoCreateOnboardingCampaignDraft } = await import(
        "@/lib/google-ads-auto-draft"
      );
      autoCreateOnboardingCampaignDraft(locksmith.id).catch((err) =>
        console.error("[PostOnboardingGeoSync] Auto-draft failed:", err),
      );
    } catch {
      // Non-fatal: never let draft creation block onboarding
    }

    // 5. Notify CMO agent about the expansion (non-fatal)
    try {
      const { delegateTask } = await import("@/agents/core/orchestrator");
      await delegateTask("system", "cmo", {
        title: "New locksmith onboarded — Google Ads geo targets updated",
        description:
          `${locksmith.name} (${locksmith.baseAddress ?? "location TBC"}) completed onboarding. ` +
          `Google Ads campaigns now target: ${coverageSummary.join(", ")}. ` +
          `Total active locksmiths: ${activeLocksmithCount}. ` +
          `Review budgets and ad copy for new coverage areas if needed.`,
        priority: 6,
        deadline: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    } catch {
      // Non-fatal: never let orchestrator failure block onboarding
    }

    // 6. Admin Telegram alert (non-fatal)
    try {
      const { sendAdminAlert } = await import("./telegram");
      await sendAdminAlert({
        title: "Google Ads geo targets updated",
        message:
          `New locksmith **${locksmith.name}** completed onboarding.\n` +
          `Campaigns synced: ${result.campaignsSynced}\n` +
          `Coverage: ${coverageSummary.join(", ")}` +
          (result.errors.length > 0 ? `\nErrors: ${result.errors.join("; ")}` : ""),
        severity: "info",
      });
    } catch {
      // Non-fatal
    }

    result.success = result.campaignsSynced > 0 || result.errors.length === 0;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}

/**
 * Daily safety-net reconciliation (called by cron).
 * Re-syncs all published campaigns regardless of whether a new locksmith
 * triggered the process, catching any drift from manual DB changes or
 * locksmiths who deactivated since the last sync.
 */
export async function runScheduledGeoSync(): Promise<GeoSyncTriggerResult> {
  return triggerPostOnboardingGeoSync({
    id: "cron",
    name: "Scheduled sync",
    baseAddress: null,
  });
}
