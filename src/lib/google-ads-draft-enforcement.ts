/**
 * Google Ads draft guardrail enforcement — STRUCTURAL gate at draft-persist time.
 *
 * Why this exists
 * ───────────────
 * The self-learning playbook (`src/lib/google-ads-playbook.ts`) seeds the proven
 * launch template into AgentMemory and injects it into the agent's RSA copy
 * generation prompt. That works for COPY but it does NOT protect the structural
 * fields a draft is persisted with — most importantly `biddingStrategy`.
 *
 * On 2026-06-03 a queue of 12 PENDING_APPROVAL drafts was generated with
 * `biddingStrategy: "MANUAL_CPC"` — exactly the Liverpool Test failure pattern
 * (£116.54 / 20 clicks / 0 conversions). Investigation showed the wrong default
 * is hardcoded in four create-callsites:
 *   • src/app/api/admin/google-ads/drafts/from-locksmith/route.ts
 *   • src/app/api/admin/google-ads/opportunities/[id]/draft/route.ts
 *   • src/agents/cmo/subagents/opportunity-scout/agent.ts
 *   • src/lib/google-ads-auto-draft.ts
 *
 * Soft guidance to the agent is therefore insufficient. This module is the
 * hard gate: it MUST be called at every prisma.googleAdsCampaignDraft.create
 * boundary. It auto-corrects bidStrategy and validates the rest of the
 * Liverpool playbook guardrails (RSA copy counts, keywords, negatives,
 * landing page).
 *
 * Also exports `isAutoPerLocksmithGenerationEnabled()` — read once at handler
 * top to gate the auto-per-locksmith POST while we wait on the click-to-
 * locksmith attribution layer (per 2026-06-03 strategic decision).
 */

import type { Prisma } from "@prisma/client";

// ─── Playbook guardrails ──────────────────────────────────────────────────
// Sourced from google-ads-campaign-playbook.md §1 (the proven 2026-06-02
// launch template, 4/4 clean serving). Mutate ONLY with deliberate playbook
// revision + sign-off.
// ──────────────────────────────────────────────────────────────────────────
export const PLAYBOOK_GUARDRAILS = {
  /**
   * The Liverpool Test loss — Manual CPC at £116.54 / 0 conv — is why this is fixed.
   *
   * 2026-06-09 override: switched from MAXIMIZE_CONVERSIONS → MAXIMIZE_CLICKS.
   * Reason: 5 published campaigns spent £154.68 lifetime with 0 tracked
   * conversions because the gclid capture chain was broken (now fixed
   * yesterday, but unproven in production). MAXIMIZE_CONVERSIONS without
   * conversion signal becomes a black-box auction where Google decides
   * what to bid. MAXIMIZE_CLICKS + CPC_BID_CEILING_GBP keeps the cost-per-
   * click in OUR control until conversion uploads prove they work.
   *
   * Revert to MAXIMIZE_CONVERSIONS once we have ≥30 verified-uploaded
   * conversions across the account over 7+ consecutive days. Document
   * that decision in playbook §19 trust ledger.
   */
  BIDDING_STRATEGY: "MAXIMIZE_CLICKS" as const,

  /** Maximum CPC bid for MAXIMIZE_CLICKS strategy (£). Hard ceiling Google
   * cannot exceed in the auction. £6 picked because last 7-day actual CPCs
   * sat at £5.52-£5.89 on Bristol/Midlands — leaves headroom without
   * runaway. Increase only with deliberate playbook revision. */
  CPC_BID_CEILING_GBP: 6 as const,

  /** Google RSA structural limits + playbook minimums. */
  MIN_HEADLINES: 14,
  MAX_HEADLINES: 15, // Google Ads RSA hard limit
  MIN_DESCRIPTIONS: 4,
  MAX_DESCRIPTIONS: 4, // Google Ads RSA hard limit

  /** Playbook target = 54 keywords. Allow some slack for the agent's natural
   * variance; reject only drafts that are dramatically thin. */
  MIN_KEYWORDS: 40,

  /** PER-AD-GROUP minimum keywords. Catches the 2026-06-02 failure mode where
   * the generator shipped 3 of 5 themed ad groups EMPTY because their keyword
   * vocabulary (containing "locksmith") hit Local Services policy and dropped.
   * Empty ad groups serve zero impressions even when the campaign reports SERVING. */
  MIN_KEYWORDS_PER_AD_GROUP: 10,

  /** PER-AD-GROUP minimum ads. The Lock Change & Burglary ad group in
   * Yorkshire | Final shipped with zero ads — it appeared Eligible but
   * couldn't serve. Same root cause as MIN_KEYWORDS_PER_AD_GROUP. */
  MIN_ADS_PER_AD_GROUP: 1,

  /** Playbook target = 128 negatives (the shared list verbatim). Same slack
   * rationale as above. */
  MIN_NEGATIVE_KEYWORDS: 100,

  /** Every draft must land on a city/district page that returned 200 before publish. */
  REQUIRE_FINAL_URL: true,

  /** Local Services Ads policy: keywords containing these tokens get flagged
   * and dropped silently by Google. Until the account is enrolled in Local
   * Services Ads, the autonomous draft path must not include them. See
   * google-ads-campaign-playbook.md §10. */
  BANNED_KEYWORD_TOKENS: ["locksmith"] as const,

  /** Single-word keywords that Google's Local Services classifier still
   * flags even without "locksmith". Use qualified variants instead
   * (e.g. "door lock replacement" instead of "lock replacement"). */
  BANNED_KEYWORD_EXACT: ["lock replacement"] as const,

  /** Forensic-validation traffic controls (added 2026-06-04, see
   * playbook §15). Every campaign must be SEARCH only with PRESENCE-only
   * geo. The publish path (google-ads-publish.ts) also forces:
   *   - targetSearchNetwork: false  (no Search Partners)
   *   - targetContentNetwork: false (no Display network)
   *   - targetPartnerSearchNetwork: false (no YouTube-search partners)
   *   - optimizedTargetingEnabled: false (per ad group; no audience expansion)
   * URL expansion: NOT sent on create. The legacy field
   * Campaign.url_expansion_opt_out was PERFORMANCE_MAX only and has been
   * REMOVED from current API. For SEARCH campaigns with AI Max OFF (our
   * default — we never opt in), URL expansion does not happen.
   * These cannot be overridden per-draft. */
  ADVERTISING_CHANNEL_TYPE: "SEARCH" as const,
  LOCATION_MATCH_TYPE: "PRESENCE" as const,
} as const;

// ─── UK geo allowlist (safety net) ────────────────────────────────────────
// Hardcoded set of valid UK GeoTargetConstant IDs. Catches obvious mistakes
// like a non-UK ID slipping into geoTargets (an agent bug, a typo, a paste
// from the wrong country).
//
// This is the COARSE check. The PRECISE check is in the post-publish
// verifier, which compares live campaign criteria against the draft's
// geoTargets (the per-campaign source of truth). Together they catch:
//   - non-UK IDs (safety net here, at persist)
//   - per-campaign cross-region drift (post-publish, against draft.geoTargets)
//
// Derived from `src/lib/google-ads-locations.ts` UK_GEO_IDS. Kept inline
// rather than imported to keep this module light enough to call from any
// persist callsite without dragging Prisma & friends into hot paths.
//
// To add a new UK city: add the ID here AND to UK_GEO_IDS in
// google-ads-locations.ts. Both stay in sync.
const UK_GEO_TARGET_IDS: ReadonlySet<string> = new Set<string>([
  // Country fallback
  "2826", // United Kingdom
  // Regions (high level)
  "20338", // England
  "20339", // Wales
  "20340", // Scotland
  "20341", // Northern Ireland
  // London + Greater London
  "1006450", "9041107", "9041110",
  // London boroughs (Inner + Outer)
  "1006453", "1006459", "1006456", "9198373",
  "9198785", "9198858", "9198805", "9208638",
  "9046056", "9046054",
  "1006465", "1006466", "1006467", "1006470", "1006471",
  "1006468", "1006469",
  "9046053", "9046051", "9046052", "9198371", "9046055",
  "1006472", "9198370", "9198369", "1006473", "1006474",
  "9046050", "9198374", "9198372",
  // South East / South West / East
  "1006598", "1006615", "1006607", "1006597", "1006596",
  "1006608", "1006590", "1006589", "1006600", "1006601",
  "1006602", "1006605",
  "1006620", "1006628", "1006624", "1006621", "1006629",
  "1006630", "1006631", "1006637",
  "1006582", "1006576", "1006577", "1006578",
  // East Midlands / West Midlands / North West / North East / Yorkshire
  "1006552", "1006553", "1006554",
  "1006544", "1006545", "1006546", "1006547", "1006548", "1006549", "1006550", "1006551",
  "1006530", "1006531", "1006532", "1006533", "1006534", "1006535", "1006536",
  "1006520", "1006521", "1006522", "1006523",
  "1006510", "1006511", "1006512", "1006513", "1006514", "1006515", "1006516", "1006517",
]);

/**
 * Returns true if the given Google geo target ID is on the UK allowlist.
 * Conservative: unknown IDs are treated as non-UK to force a deliberate
 * review before they slip into a campaign.
 */
export function isUkGeoTargetId(id: string): boolean {
  return UK_GEO_TARGET_IDS.has(String(id).trim());
}

// ─── Per-ad-group input shape ──────────────────────────────────────────────
/**
 * Loose shape for the per-ad-group payload found in
 * `GoogleAdsCampaignDraft.adGroups` (Json). The webapp's draft generator
 * populates this when building multi-ad-group themed campaigns. The
 * canonical shape per the 2026-06-02 published drafts is:
 *
 *   adGroups: [
 *     { name: "Emergency & 24hr", keywords: [...], ads: [{ headlines, descriptions, finalUrl }] },
 *     { name: "Locked Out", keywords: [...], ads: [...] },
 *     ...
 *   ]
 *
 * Callers may pass partials; we treat missing fields as zero-length arrays.
 */
export interface AdGroupCheckShape {
  name?: string;
  keywords?: unknown;
  ads?: unknown;
  headlines?: unknown;
  descriptions?: unknown;
}

// ─── Shape we read from the create-data payload ───────────────────────────
// The Prisma model is GoogleAdsCampaignDraft with these relevant fields:
//   biddingStrategy: String   (default "MAXIMIZE_CONVERSIONS")
//   headlines:       String[]
//   descriptions:    String[]
//   keywords:        Json     (the shape used at all callsites is
//                              [{ text: string; matchType: "EXACT"|"PHRASE"|"BROAD" }])
//   negativeKeywords: String[]
//   finalUrl:        String
// We accept a loose Prisma create input here because callers may pass partials
// before defaults are applied.
// ──────────────────────────────────────────────────────────────────────────

/** Conservative input shape — any extra fields pass through untouched. */
export type EnforceableDraftData =
  Partial<Prisma.GoogleAdsCampaignDraftUncheckedCreateInput> & {
    keywords?: unknown;
  };

export interface GuardrailViolation {
  field: string;
  expected: string;
  actual: string;
  severity: "error" | "warning";
}

export type EnforcementResult =
  | {
      ok: true;
      /** Data ready to pass to prisma.googleAdsCampaignDraft.create({ data }). */
      data: EnforceableDraftData;
      /** Auto-corrections applied (e.g. MANUAL_CPC → MAXIMIZE_CONVERSIONS).
       *  Caller SHOULD log these so the team sees the agent's drift. */
      appliedFixes: GuardrailViolation[];
    }
  | { ok: false; violations: GuardrailViolation[] };

export interface EnforcementOptions {
  /**
   * Bypass HARD overrides (currently: biddingStrategy). DO NOT default true.
   * Reserve for explicit admin-flagged experiments with a second approver.
   */
  allowOverride?: boolean;
}

// ─── RULE #14 — per-account daily spend cap (2026-06-06) ─────────────────

/**
 * Hard cap on the sum of `dailyBudget` across every PUBLISHED+ENABLED
 * draft for a given GoogleAdsAccount. Default £100/day. Overridable via
 * env var `MAX_DAILY_ACCOUNT_SPEND_GBP`.
 *
 * Why this exists (2026-06-06): you can theoretically create 30 drafts
 * at £20 each = £600/day with no rule stopping it. Today we caught the
 * coverage gap (£165.85 over 7d with 0 attribution), but a SCALED
 * version of the same mistake would burn five figures per week.
 *
 * The cap is checked BEFORE persist — a draft that would push the
 * account-wide live budget over the cap is rejected with a clear
 * error. The fix: pause an existing campaign OR ship at a lower
 * dailyBudget.
 */
function getAccountDailyBudgetCap(): number {
  const raw = process.env["MAX_DAILY_ACCOUNT_SPEND_GBP"];
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  // £300 = up to 3-5 campaigns at £60-100 each.
  //
  // Why not lower: at our £5-8 CPC, £20/day = ~3 clicks/day = noise. Google's
  // MAXIMIZE_CONVERSIONS needs ~30 conv/week to exit learning period. At a
  // realistic 5-10% conversion rate that's 300-600 clicks/week = £60-120/day
  // per campaign. £100 account-wide ÷ 3 campaigns = £33 each = too thin to
  // ever teach the algorithm.
  //
  // Why not higher: this is a HARD cap, not a target. Headroom is good but
  // the runaway scenario we're guarding against (someone unpauses all 30
  // historical drafts at default budgets) gets caught at £300 just as well
  // as £100, while still allowing serious operation.
  //
  // To raise further per-environment: set env MAX_DAILY_ACCOUNT_SPEND_GBP=X
  // in Vercel. Lower values let you smoke-test the pipeline at no risk.
  return 300;
}

export async function enforceAccountSpendCap(
  accountId: string,
  requestedDailyBudget: number,
  opts: {
    /** Override the live-budget lookup (tests). */
    currentLiveBudget?: number;
    /** Override the cap (tests / what-if). */
    capOverride?: number;
    /** Override accountId resolver (tests). */
    excludeDraftId?: string;
  } = {},
): Promise<
  | { ok: true; currentSpend: number; cap: number; headroom: number }
  | { ok: false; violations: GuardrailViolation[] }
> {
  const cap = opts.capOverride ?? getAccountDailyBudgetCap();
  if (!Number.isFinite(requestedDailyBudget) || requestedDailyBudget <= 0) {
    return {
      ok: false,
      violations: [
        {
          field: "dailyBudget",
          expected: "positive number",
          actual: String(requestedDailyBudget),
          severity: "error",
        },
      ],
    };
  }

  let currentLiveBudget: number;
  if (opts.currentLiveBudget !== undefined) {
    currentLiveBudget = opts.currentLiveBudget;
  } else {
    // Lazy import — keep this module callable from edge contexts.
    const { prisma: _prisma } = await import("@/lib/db");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = _prisma as any;
    const rows = await prisma.googleAdsCampaignDraft.findMany({
      where: {
        accountId,
        status: "PUBLISHED",
        pausedAt: null,
        ...(opts.excludeDraftId ? { id: { not: opts.excludeDraftId } } : {}),
      },
      select: { dailyBudget: true },
    });
    currentLiveBudget = rows.reduce(
      (acc: number, r: { dailyBudget: number | null }) =>
        acc + (r.dailyBudget ?? 0),
      0,
    );
  }

  const wouldBe = currentLiveBudget + requestedDailyBudget;
  if (wouldBe > cap) {
    return {
      ok: false,
      violations: [
        {
          field: "dailyBudget",
          expected: `account-wide live budget ≤ £${cap} (current £${currentLiveBudget.toFixed(2)}, +£${requestedDailyBudget.toFixed(2)} would total £${wouldBe.toFixed(2)})`,
          actual: `would exceed cap by £${(wouldBe - cap).toFixed(2)}`,
          severity: "error",
        },
      ],
    };
  }

  return {
    ok: true,
    currentSpend: currentLiveBudget,
    cap,
    headroom: cap - wouldBe,
  };
}

/**
 * Async coverage gate — RULE #13 (the "stop going bankrupt" rule, 2026-06-06).
 *
 * Every geo target on the draft must be in the LIVE coverage map. That is,
 * at least MIN_LOCKSMITHS_PER_GEO (default 2) ACTIVE locksmiths must have
 * their base location within RADIUS_MILES (default 10) of the city centroid.
 *
 * Why this is separate from enforceDraftGuardrails():
 *   1. Coverage is computed from the DB (async), the rest are pure checks.
 *   2. Coverage changes hourly (locksmiths join/leave/suspend) — re-runs
 *      against fresh data are cheap, no need to cache via the sync path.
 *   3. Surface a distinct error so admins see "geo-not-covered" as its own
 *      class of violation, not buried in 12 other reasons.
 *
 * Caller pattern at every draft-persist site:
 *
 *   const coverageGate = await enforceCoverageGate(body.geoTargets);
 *   if (!coverageGate.ok) {
 *     return NextResponse.json({ error: "coverage_violation", violations: coverageGate.violations }, { status: 422 });
 *   }
 *   const enforced = enforceDraftGuardrails(data);
 *   if (!enforced.ok) { ... }
 *
 * Returns the SAME violation shape as enforceDraftGuardrails for uniform
 * admin-UI handling. `unknownGeoIds` are surfaced separately because they
 * indicate an out-of-allowlist input (caller may want to fall back to a
 * different check rather than reject — for now we reject defensively).
 */
export async function enforceCoverageGate(
  geoTargets: readonly string[] | undefined | null,
): Promise<
  | { ok: true; eligibleGeoIds: string[] }
  | { ok: false; violations: GuardrailViolation[] }
> {
  const targets = (geoTargets ?? []).map(String).filter((s) => s.trim() !== "");
  if (targets.length === 0) {
    return {
      ok: false,
      violations: [
        {
          field: "geoTargets",
          expected: "at least one UK geo target ID with ≥2 locksmiths within 10 miles",
          actual: "empty",
          severity: "error",
        },
      ],
    };
  }

  // Lazy import to keep the enforcement module callable from edge contexts
  // that don't drag the coverage builder + Prisma in unless needed.
  const { computeCoverageMap } = await import("@/lib/campaign-coverage-builder");
  const map = await computeCoverageMap();

  const eligibleSet = new Set(map.eligibleGeoIds);
  const allKnown = new Set(map.entries.map((e) => e.geoId));

  const violations: GuardrailViolation[] = [];
  const eligible: string[] = [];

  for (const geoId of targets) {
    if (eligibleSet.has(geoId)) {
      eligible.push(geoId);
      continue;
    }
    if (!allKnown.has(geoId)) {
      // Geo is in UK allowlist (caller has presumably checked) but NOT in
      // our city-centroid coverage model. Reject — better to surface the
      // gap than silently allow uncovered borough/postcode IDs through.
      violations.push({
        field: "geoTargets",
        expected:
          "city geo ID with coverage data (see /api/admin/google-ads/coverage)",
        actual: `${geoId} — no coverage map entry; add to UK_CITY_CENTROIDS to opt in`,
        severity: "error",
      });
      continue;
    }
    const entry = map.entries.find((e) => e.geoId === geoId)!;
    violations.push({
      field: "geoTargets",
      expected: `≥${
        // hardcoded label for now — value lives in coverage builder.
        2
      } locksmiths within 10mi of ${entry.cityName}`,
      actual: `${entry.locksmithCount} (${
        entry.excludedReason === "no_locksmiths"
          ? "zero coverage — Liverpool Test pattern"
          : "below floor — single point of failure"
      })`,
      severity: "error",
    });
  }

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, eligibleGeoIds: eligible };
}

/**
 * Validate and auto-correct draft create-data against the playbook guardrails.
 *
 * Caller pattern:
 *
 *   // 1. Coverage gate (DB-dependent, the "stop going bankrupt" rule).
 *   const coverage = await enforceCoverageGate(data.geoTargets);
 *   if (!coverage.ok) {
 *     return NextResponse.json({ error: "coverage_violation", violations: coverage.violations }, { status: 422 });
 *   }
 *
 *   // 2. Structural guardrails (sync, all the other rules).
 *   const enforced = enforceDraftGuardrails(data);
 *   if (!enforced.ok) {
 *     return NextResponse.json({ error: "guardrail_violation", violations: enforced.violations }, { status: 422 });
 *   }
 *   if (enforced.appliedFixes.length > 0) {
 *     console.warn("[ads] draft auto-corrected at persist", enforced.appliedFixes);
 *   }
 *
 *   const draft = await prisma.googleAdsCampaignDraft.create({ data: enforced.data });
 */
export function enforceDraftGuardrails(
  input: EnforceableDraftData,
  opts: EnforcementOptions = {},
): EnforcementResult {
  const appliedFixes: GuardrailViolation[] = [];
  const violations: GuardrailViolation[] = [];

  // Defensive shallow copy — never mutate caller's object.
  const out: EnforceableDraftData = { ...input };

  // 1. Bidding strategy — HARD OVERRIDE (the Liverpool fix). ──────────────
  if (out.biddingStrategy !== PLAYBOOK_GUARDRAILS.BIDDING_STRATEGY) {
    if (opts.allowOverride) {
      // explicit admin override — caller is responsible for prominent logging.
    } else {
      appliedFixes.push({
        field: "biddingStrategy",
        expected: PLAYBOOK_GUARDRAILS.BIDDING_STRATEGY,
        actual: String(out.biddingStrategy ?? "undefined"),
        severity: "error",
      });
      out.biddingStrategy = PLAYBOOK_GUARDRAILS.BIDDING_STRATEGY;
      // tCPA must be null when the strategy is the seeded one; see playbook §1.
      // (TARGET_CPA gets added only after real conversion volume.)
      out.targetCpa = null;
    }
  }

  // 2. Headlines (RSA). ──────────────────────────────────────────────────
  const headlines = Array.isArray(out.headlines) ? (out.headlines as string[]) : [];
  if (headlines.length < PLAYBOOK_GUARDRAILS.MIN_HEADLINES) {
    violations.push({
      field: "headlines",
      expected: `at least ${PLAYBOOK_GUARDRAILS.MIN_HEADLINES} (playbook template)`,
      actual: String(headlines.length),
      severity: "error",
    });
  }
  if (headlines.length > PLAYBOOK_GUARDRAILS.MAX_HEADLINES) {
    // Truncate — Google would reject anyway.
    out.headlines = headlines.slice(0, PLAYBOOK_GUARDRAILS.MAX_HEADLINES);
    appliedFixes.push({
      field: "headlines",
      expected: `<= ${PLAYBOOK_GUARDRAILS.MAX_HEADLINES} (Google RSA limit)`,
      actual: String(headlines.length),
      severity: "warning",
    });
  }

  // 3. Descriptions (RSA). ───────────────────────────────────────────────
  const descriptions = Array.isArray(out.descriptions) ? (out.descriptions as string[]) : [];
  if (descriptions.length < PLAYBOOK_GUARDRAILS.MIN_DESCRIPTIONS) {
    violations.push({
      field: "descriptions",
      expected: `at least ${PLAYBOOK_GUARDRAILS.MIN_DESCRIPTIONS} (playbook template)`,
      actual: String(descriptions.length),
      severity: "error",
    });
  }
  if (descriptions.length > PLAYBOOK_GUARDRAILS.MAX_DESCRIPTIONS) {
    out.descriptions = descriptions.slice(0, PLAYBOOK_GUARDRAILS.MAX_DESCRIPTIONS);
    appliedFixes.push({
      field: "descriptions",
      expected: `<= ${PLAYBOOK_GUARDRAILS.MAX_DESCRIPTIONS} (Google RSA limit)`,
      actual: String(descriptions.length),
      severity: "warning",
    });
  }

  // 4. Keywords (campaign-level, flat single-ad-group case). ────────────
  // keywords is Json on the model: [{ text, matchType }]. Count entries.
  const keywordsLen = Array.isArray(out.keywords) ? (out.keywords as unknown[]).length : 0;
  if (keywordsLen < PLAYBOOK_GUARDRAILS.MIN_KEYWORDS) {
    violations.push({
      field: "keywords",
      expected: `at least ${PLAYBOOK_GUARDRAILS.MIN_KEYWORDS} (playbook target ~54)`,
      actual: String(keywordsLen),
      severity: "error",
    });
  }

  // 4a. Banned keyword tokens (Local Services Ads policy). ──────────────
  // Catches the 2026-06-02 failure mode: drafts shipped with "locksmith"
  // keywords that Google's Local Services classifier silently dropped.
  // See playbook §10.
  if (Array.isArray(out.keywords)) {
    const flatKeywordViolations = collectBannedKeywords(out.keywords);
    for (const banned of flatKeywordViolations) {
      violations.push({
        field: "keywords",
        expected: `no Local Services-restricted tokens (${PLAYBOOK_GUARDRAILS.BANNED_KEYWORD_TOKENS.join(", ")})`,
        actual: banned,
        severity: "error",
      });
    }
  }

  // 5. Negative keywords. ────────────────────────────────────────────────
  const negatives = Array.isArray(out.negativeKeywords)
    ? (out.negativeKeywords as string[])
    : [];
  if (negatives.length < PLAYBOOK_GUARDRAILS.MIN_NEGATIVE_KEYWORDS) {
    violations.push({
      field: "negativeKeywords",
      expected: `at least ${PLAYBOOK_GUARDRAILS.MIN_NEGATIVE_KEYWORDS} (playbook target ~128)`,
      actual: String(negatives.length),
      severity: "error",
    });
  }

  // 6. Final URL (city/district landing page). ──────────────────────────
  if (PLAYBOOK_GUARDRAILS.REQUIRE_FINAL_URL) {
    const url = typeof out.finalUrl === "string" ? out.finalUrl.trim() : "";
    if (!url || !/^https?:\/\//i.test(url)) {
      violations.push({
        field: "finalUrl",
        expected: "non-empty http(s) URL (city/district landing page)",
        actual: url || "missing",
        severity: "error",
      });
    }
  }

  // 7. Per-ad-group enforcement (multi-ad-group themed campaigns). ──────
  // If the draft uses the adGroups Json field (the 5-themed pattern from
  // playbook §1), every ad group must independently satisfy the per-ad-group
  // floors. This blocks the 2026-06-02 failure where 3 of 5 ad groups in
  // each campaign shipped empty.
  if (Array.isArray(out.adGroups) && out.adGroups.length > 0) {
    const adGroupViolations = validateAdGroups(out.adGroups as AdGroupCheckShape[]);
    for (const v of adGroupViolations) {
      violations.push(v);
    }
  }

  // 8. Channel — HARD OVERRIDE to SEARCH (forensic-validation rule). ────
  // No Display, no PMax, no Demand Gen, no Discovery, no Video.
  // See playbook §15.
  if (out.channel !== PLAYBOOK_GUARDRAILS.ADVERTISING_CHANNEL_TYPE) {
    if (opts.allowOverride) {
      // explicit admin override — caller logs.
    } else {
      appliedFixes.push({
        field: "channel",
        expected: PLAYBOOK_GUARDRAILS.ADVERTISING_CHANNEL_TYPE,
        actual: String(out.channel ?? "undefined"),
        severity: "error",
      });
      out.channel = PLAYBOOK_GUARDRAILS.ADVERTISING_CHANNEL_TYPE;
    }
  }

  // 9. Location match type — HARD OVERRIDE to PRESENCE. ─────────────────
  // PRESENCE = only people physically in the target area.
  // PRESENCE_OR_INTEREST = also people searching about the area from
  // anywhere — dilutes attribution, banned per playbook §15.
  if (out.locationMatchType !== PLAYBOOK_GUARDRAILS.LOCATION_MATCH_TYPE) {
    if (opts.allowOverride) {
      // explicit admin override
    } else {
      appliedFixes.push({
        field: "locationMatchType",
        expected: PLAYBOOK_GUARDRAILS.LOCATION_MATCH_TYPE,
        actual: String(out.locationMatchType ?? "undefined"),
        severity: "error",
      });
      out.locationMatchType = PLAYBOOK_GUARDRAILS.LOCATION_MATCH_TYPE;
    }
  }

  // 10. UK-only geo targets (safety net). ───────────────────────────────
  // Catches non-UK IDs slipping in (agent bug, typo, paste from wrong
  // country). The PRECISE per-campaign drift check is post-publish — see
  // google-ads-publish-verifier.ts and playbook §15.
  const geoTargets = Array.isArray(out.geoTargets)
    ? (out.geoTargets as string[])
    : [];
  if (geoTargets.length === 0) {
    violations.push({
      field: "geoTargets",
      expected: "at least one UK geo target ID",
      actual: "empty",
      severity: "error",
    });
  }
  for (const geo of geoTargets) {
    if (!isUkGeoTargetId(geo)) {
      violations.push({
        field: "geoTargets",
        expected: "UK GeoTargetConstant ID (see UK_GEO_TARGET_IDS in google-ads-draft-enforcement.ts)",
        actual: String(geo),
        severity: "error",
      });
    }
  }

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, data: out, appliedFixes };
}

// ─── Helpers — banned-keyword detection + per-ad-group validation ─────

/**
 * Returns a list of keyword strings from the input that violate the Local
 * Services Ads policy (contain a banned token or match a banned exact phrase).
 * Used to populate violation entries. The input is the raw `keywords` Json —
 * each entry expected to be `{ text, matchType }` but defensive against any
 * shape (just looks for a `text` field).
 */
function collectBannedKeywords(rawKeywords: unknown): string[] {
  if (!Array.isArray(rawKeywords)) return [];
  const out: string[] = [];
  for (const kw of rawKeywords) {
    const text =
      typeof kw === "string"
        ? kw
        : kw && typeof kw === "object" && "text" in (kw as Record<string, unknown>)
          ? String((kw as Record<string, unknown>).text)
          : "";
    if (!text) continue;
    const lower = text.toLowerCase().trim();
    for (const exact of PLAYBOOK_GUARDRAILS.BANNED_KEYWORD_EXACT) {
      if (lower === exact) out.push(text);
    }
    for (const token of PLAYBOOK_GUARDRAILS.BANNED_KEYWORD_TOKENS) {
      if (lower.includes(token)) {
        out.push(text);
        break;
      }
    }
  }
  return out;
}

/**
 * Per-ad-group structural checks. Returns one violation per failing ad group
 * (qualified with the ad group name in `field` so the caller can identify
 * which themed ad group is broken).
 *
 * Catches the 2026-06-02 failure pattern: 3 of 5 themed ad groups shipped
 * empty (no keywords, no ads) and the campaign reported SERVING anyway.
 */
function validateAdGroups(adGroups: AdGroupCheckShape[]): GuardrailViolation[] {
  const out: GuardrailViolation[] = [];
  for (let i = 0; i < adGroups.length; i++) {
    const ag = adGroups[i];
    const label = ag?.name?.trim() || `ad group ${i + 1}`;

    // Keywords per ad group
    const kwCount = Array.isArray(ag?.keywords) ? (ag.keywords as unknown[]).length : 0;
    if (kwCount < PLAYBOOK_GUARDRAILS.MIN_KEYWORDS_PER_AD_GROUP) {
      out.push({
        field: `adGroups[${label}].keywords`,
        expected: `at least ${PLAYBOOK_GUARDRAILS.MIN_KEYWORDS_PER_AD_GROUP} per ad group`,
        actual: String(kwCount),
        severity: "error",
      });
    }

    // Banned keywords per ad group
    if (Array.isArray(ag?.keywords)) {
      const banned = collectBannedKeywords(ag.keywords);
      for (const b of banned) {
        out.push({
          field: `adGroups[${label}].keywords`,
          expected: `no Local Services-restricted tokens (${PLAYBOOK_GUARDRAILS.BANNED_KEYWORD_TOKENS.join(", ")})`,
          actual: b,
          severity: "error",
        });
      }
    }

    // Ads per ad group
    const adsCount = Array.isArray(ag?.ads) ? (ag.ads as unknown[]).length : 0;
    if (adsCount < PLAYBOOK_GUARDRAILS.MIN_ADS_PER_AD_GROUP) {
      out.push({
        field: `adGroups[${label}].ads`,
        expected: `at least ${PLAYBOOK_GUARDRAILS.MIN_ADS_PER_AD_GROUP} RSA per ad group`,
        actual: String(adsCount),
        severity: "error",
      });
    }

    // Headlines per ad group (if specified at this level)
    if (Array.isArray(ag?.headlines)) {
      const hCount = (ag.headlines as unknown[]).length;
      if (hCount < PLAYBOOK_GUARDRAILS.MIN_HEADLINES) {
        out.push({
          field: `adGroups[${label}].headlines`,
          expected: `at least ${PLAYBOOK_GUARDRAILS.MIN_HEADLINES} per ad group`,
          actual: String(hCount),
          severity: "error",
        });
      }
    }

    // Descriptions per ad group (if specified at this level)
    if (Array.isArray(ag?.descriptions)) {
      const dCount = (ag.descriptions as unknown[]).length;
      if (dCount < PLAYBOOK_GUARDRAILS.MIN_DESCRIPTIONS) {
        out.push({
          field: `adGroups[${label}].descriptions`,
          expected: `at least ${PLAYBOOK_GUARDRAILS.MIN_DESCRIPTIONS} per ad group`,
          actual: String(dCount),
          severity: "error",
        });
      }
    }
  }
  return out;
}

// ─── Strict variant — throws on violation ──────────────────────────────
export class DraftGuardrailError extends Error {
  public violations: GuardrailViolation[];
  constructor(violations: GuardrailViolation[]) {
    super(
      `Draft violates playbook guardrails: ${violations
        .map((v) => `${v.field} expected ${v.expected}, got ${v.actual}`)
        .join("; ")}`,
    );
    this.name = "DraftGuardrailError";
    this.violations = violations;
  }
}

/**
 * Strict variant — throws DraftGuardrailError if any violation cannot be auto-fixed.
 * Use in code paths (crons, agents) where a failed draft should surface as an
 * exception. Use `enforceDraftGuardrails` directly in HTTP handlers where you
 * want to return structured 422s.
 */
export function assertDraftGuardrails(
  input: EnforceableDraftData,
  opts: EnforcementOptions = {},
): { data: EnforceableDraftData; appliedFixes: GuardrailViolation[] } {
  const r = enforceDraftGuardrails(input, opts);
  if (!r.ok) throw new DraftGuardrailError(r.violations);
  return { data: r.data, appliedFixes: r.appliedFixes };
}

// ─── Feature flag: auto-per-locksmith generation ──────────────────────
/**
 * Returns true only when ENABLE_AUTO_PER_LOCKSMITH_DRAFTS === "true" exactly.
 * Default is false — per 2026-06-03 decision to disable auto-per-locksmith
 * draft generation until the click-to-locksmith attribution layer exists.
 * Manual dashboard creation remains the only path while this flag is off.
 *
 * Re-enable later by setting the env var to exactly the string "true".
 */
export function isAutoPerLocksmithGenerationEnabled(): boolean {
  return process.env.ENABLE_AUTO_PER_LOCKSMITH_DRAFTS === "true";
}
