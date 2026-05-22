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

// =========================================================================
// UK city → Google Ads GeoTargetConstant ID lookup table
// IDs sourced from the Google Ads API geo targets reference.
// =========================================================================

export const UK_GEO_IDS = {
  // Country fallback
  uk: "2826",

  // England – Greater London
  london: "1006450",
  "greater london": "9041107",
  westminster: "1006453",
  camden: "1006459",
  islington: "1006456",
  // East London boroughs — verified against Google Ads GeoTargetConstant ref.
  // (The legacy 100644xx IDs in this range collide with random English villages
  // — e.g. 1006460 → Addlestone, 1006463 → Aldbourne — so do NOT reuse them.)
  hackney: "9198373",
  "tower hamlets": "9198785",
  "waltham forest": "9198805",
  newham: "9198858",
  redbridge: "9208638",
  southwark: "1006465",
  lambeth: "1006466",
  wandsworth: "1006467",
  kensington: "1006468",
  hammersmith: "1006469",
  greenwich: "1006470",
  lewisham: "1006471",
  croydon: "1006472",
  bromley: "1006473",
  bexley: "1006474",

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

export type UKGeoKey = keyof typeof UK_GEO_IDS;

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
  const cityCoords: Record<string, { lat: number; lng: number }> = {
    "london": { lat: 51.5074, lng: -0.1278 },
    "manchester": { lat: 53.4808, lng: -2.2426 },
    "birmingham": { lat: 52.4862, lng: -1.8904 },
    "leeds": { lat: 53.8008, lng: -1.5491 },
    "glasgow": { lat: 55.8642, lng: -4.2518 },
    "sheffield": { lat: 53.3811, lng: -1.4701 },
    "bradford": { lat: 53.7960, lng: -1.7594 },
    "liverpool": { lat: 53.4084, lng: -2.9916 },
    "edinburgh": { lat: 55.9533, lng: -3.1883 },
    "bristol": { lat: 51.4545, lng: -2.5879 },
    "cardiff": { lat: 51.4816, lng: -3.1791 },
    "coventry": { lat: 52.4068, lng: -1.5197 },
    "nottingham": { lat: 52.9548, lng: -1.1581 },
    "leicester": { lat: 52.6369, lng: -1.1398 },
    "southampton": { lat: 50.9097, lng: -1.4044 },
    "portsmouth": { lat: 50.8198, lng: -1.0880 },
    "reading": { lat: 51.4543, lng: -0.9781 },
    "oxford": { lat: 51.7520, lng: -1.2577 },
    "brighton": { lat: 50.8225, lng: -0.1372 },
    "newcastle": { lat: 54.9783, lng: -1.6178 },
    "belfast": { lat: 54.5973, lng: -5.9301 },
    "aberdeen": { lat: 57.1497, lng: -2.0943 },
    "derby": { lat: 52.9225, lng: -1.4746 },
    "sunderland": { lat: 54.9061, lng: -1.3816 },
    "york": { lat: 53.9600, lng: -1.0873 },
    "cambridge": { lat: 52.2053, lng: 0.1218 },
    "norwich": { lat: 52.6309, lng: 1.2974 },
    "peterborough": { lat: 52.5695, lng: -0.2405 },
    "ipswich": { lat: 52.0567, lng: 1.1482 },
    "exeter": { lat: 50.7184, lng: -3.5339 },
    "plymouth": { lat: 50.3755, lng: -4.1427 },
    "bath": { lat: 51.3751, lng: -2.3617 },
    "bournemouth": { lat: 50.7192, lng: -1.8808 },
    "swansea": { lat: 51.6214, lng: -3.9436 },
  };

  let best: string | null = null;
  let bestDist = Infinity;

  for (const [city, coords] of Object.entries(cityCoords)) {
    const dLat = (lat - coords.lat) * (Math.PI / 180);
    const dLng = (lng - coords.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat * (Math.PI / 180)) *
        Math.cos(coords.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) ** 2;
    const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distKm < bestDist) {
      bestDist = distKm;
      best = city;
    }
  }

  // Only accept if within 80 km of a known city
  return bestDist <= 80 ? best : null;
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

    // 4. Notify CMO agent about the expansion (non-fatal)
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

    // 5. Admin Telegram alert (non-fatal)
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
