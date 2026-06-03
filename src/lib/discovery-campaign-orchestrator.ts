/**
 * Discovery Campaign Orchestrator
 *
 * The thin DB layer that turns the Phase 2 stack into actual campaign
 * drafts in the database. Pulls KeywordSeed rows, ranks them by phone-
 * lead intent, optionally demotes shark-saturated entries, applies
 * family quotas, builds drafts via the pure generator, and persists
 * them as GoogleAdsCampaignDraft rows.
 *
 * SEPARATION OF CONCERNS
 * ──────────────────────
 *   • discovery-campaign-generator.ts → PURE payload builder (no DB)
 *   • THIS FILE                       → DB pulls/writes + selection logic
 *
 * That split keeps the heavy generator code 100% unit-testable while
 * isolating the I/O surface to one place that ops can audit.
 *
 * IDEMPOTENCY
 * ───────────
 * Each generated draft gets a deterministic name like
 *   "LockSafe · Postcode · RG1"
 * If a draft with the same name already exists for the same accountId,
 * the orchestrator skips it. Re-running this orchestrator never
 * double-creates campaigns.
 *
 * FAMILY QUOTAS
 * ─────────────
 * Without quotas, the top-N would be dominated by whichever family has
 * the highest baseline weight (postcode_local). Opening launches want
 * a MIX: a few postcode_local, one or two trust_signal, maybe one
 * b2b_specialist. Default quotas express that.
 */

import { prisma as _prisma } from "@/lib/db";
import {
  scorePhoneLeadIntent,
  type PhoneLeadIntentScore,
  detectPostcodeDistrict,
} from "@/lib/phone-lead-intent-score";
import {
  partitionBySharkSaturation,
  type SharkFlagSource,
} from "@/lib/shark-saturation";
import {
  buildDiscoveryCampaignDraft,
  type CampaignDraftPayload,
} from "@/lib/discovery-campaign-generator";
import { isUkMobileNumber } from "@/lib/phone";
import { ensureOrSkip, districtSlug } from "@/lib/district-landing/ensure-landing";
import { SITE_URL } from "@/lib/config";
import type { SeedCategory } from "@/agents/core/seed-bank";
import type { IntelKeyword } from "@/lib/competitor-cross-validate";
import { enforceDraftGuardrails } from "@/lib/google-ads-draft-enforcement";

// Prisma schema includes new fields not always in the generated client
// during DB schema-drift windows — keep the prisma reference loose so
// missing-field errors surface as runtime, not type, problems.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Public types ────────────────────────────────────────────────────────────

export interface OrchestratorOptions {
  /** GoogleAdsAccount.id to attach drafts to. Required. */
  accountId:        string;
  /** Landing page URL. Default: https://locksafe.uk/request */
  finalUrl?:        string;
  /** Shared website phone in E.164. Defaults: LOCKSAFE_WEBSITE_PHONE -> RETELL_PHONE_NUMBER. */
  websitePhoneE164?: string;

  /**
   * Max total drafts to create in this run. Default 6 (the opening launch
   * batch). Per-family quota applies first, then this overall cap.
   */
  maxDrafts?: number;

  /**
   * Per-family quota — the maximum number of drafts to produce from each
   * family. Default mix: postcode_local=4, trust_signal=1, b2b=1; others 0
   * so we don't accidentally launch a research_intent campaign on day 1.
   */
  perFamilyQuota?: Partial<Record<SeedCategory, number>>;

  /**
   * Optional SERP context for shark-saturation filtering. When provided,
   * keywords whose serpDomains list is dominated by flagged sharks are
   * demoted. When omitted, NO demotion is applied (treat every keyword
   * as fair game). Pass when the most-recent SERP scan has populated
   * IntelKeyword rows for the candidate set.
   */
  intelKeywords?: IntelKeyword[];
  /**
   * Shark flag source matching the intelKeywords. Pass alongside it; if
   * intelKeywords is provided but this is missing, no demotion happens.
   */
  sharkFlagSource?: SharkFlagSource;

  /**
   * When true, skip the prisma writes and return what WOULD have been
   * created. Useful for ops review before the first real run.
   */
  dryRun?: boolean;

  /** Optional ID of the agent (or "manual:<adminId>") creating these. */
  agentId?: string;
}

export interface OrchestratorResult {
  consideredSeeds:   number;
  saturatedDropped:  number;
  quotaFiltered:     number;
  draftsCreated:     number;
  draftsSkipped:     number;     // existing name → idempotent skip
  errors:            string[];
  /** Per-draft audit info for the run log. */
  drafts: Array<{
    keyword:         string;
    family:          SeedCategory;
    district:        string | null;
    name:            string;
    dailyBudget:     number;
    phoneLeadIntent: number;
    skippedReason?:  string;
    error?:          string;
  }>;
}

// ── Defaults ────────────────────────────────────────────────────────────────

// /request is the actual booking-flow page (title "Book a Locksmith");
// /book does NOT exist in the codebase and would 404.
const DEFAULT_FINAL_URL = "https://locksafe.uk/request";
const DEFAULT_MAX_DRAFTS = 6;

/**
 * Opening-launch family mix. Tuned for the first ~6 campaigns: most spend
 * goes to postcode_local (the proven phone-call workhorse), with one
 * trust_signal and one b2b_specialist to start collecting data on those
 * adjacent surfaces. service_long_tail starts at 0 until we have a
 * web booking flow we trust — planned work converts better on web than
 * phone, and we don't want to flood the call line with quote requests.
 */
export const DEFAULT_FAMILY_QUOTA: Record<SeedCategory, number> = {
  postcode_local:    4,
  trust_signal:      1,
  b2b_specialist:    1,
  service_long_tail: 0,
  competitor:        0,
  baseline:          0,
  learned:           0,
  experimental:      0,
  research_intent:   0,
  negative:          0,
};

// ── Internal types ──────────────────────────────────────────────────────────

interface ScoredSeed {
  keyword:         string;
  family:          SeedCategory;
  winCount:        number;
  lossCount:       number;
  phoneLeadIntent: PhoneLeadIntentScore;
}

// ── Selection (pure) ────────────────────────────────────────────────────────

/**
 * Apply per-family quotas to a sorted candidate stream. Returns the
 * subset that fits inside both the per-family quota and the overall
 * maxDrafts cap. Pure — exported for tests.
 */
export function applyFamilyQuotas(
  scored:         ScoredSeed[],
  quota:          Record<SeedCategory, number>,
  maxDrafts:      number,
): ScoredSeed[] {
  const used: Partial<Record<SeedCategory, number>> = {};
  const out: ScoredSeed[] = [];

  for (const seed of scored) {
    if (out.length >= maxDrafts) break;
    const familyCap = quota[seed.family] ?? 0;
    const usedSoFar = used[seed.family] ?? 0;
    if (usedSoFar >= familyCap) continue;
    used[seed.family] = usedSoFar + 1;
    out.push(seed);
  }
  return out;
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * Generate up to N campaign drafts from the KeywordSeed bank.
 *
 * Pipeline:
 *   1. pull active KeywordSeed rows
 *   2. (optional) drop shark-saturated keywords
 *   3. score each remaining seed via phoneLeadIntentScore
 *   4. sort by score desc
 *   5. apply per-family quota + overall max
 *   6. build a draft payload per surviving seed
 *   7. write to prisma — skipping any name that already exists
 */
export async function generateDiscoveryDrafts(
  options: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = {
    consideredSeeds:  0,
    saturatedDropped: 0,
    quotaFiltered:    0,
    draftsCreated:    0,
    draftsSkipped:    0,
    errors:           [],
    drafts:           [],
  };

  // ── Resolve options ─────────────────────────────────────────────────
  if (!options.accountId) {
    result.errors.push("accountId is required");
    return result;
  }
  const finalUrl  = options.finalUrl  ?? DEFAULT_FINAL_URL;
  const phone     = options.websitePhoneE164
    ?? process.env["LOCKSAFE_WEBSITE_PHONE"]
    ?? process.env["RETELL_PHONE_NUMBER"]
    ?? "+441234567890";
  const maxDrafts = options.maxDrafts ?? DEFAULT_MAX_DRAFTS;
  const quota     = { ...DEFAULT_FAMILY_QUOTA, ...(options.perFamilyQuota ?? {}) };

  if (isUkMobileNumber(phone)) {
    result.errors.push(
      `Refusing to generate Google Ads drafts with a UK mobile phone (${phone}). ` +
      "Use your Zadarma/Retell landline via LOCKSAFE_WEBSITE_PHONE or RETELL_PHONE_NUMBER.",
    );
    return result;
  }

  // ── 1. Pull active KeywordSeeds ─────────────────────────────────────
  const seeds: Array<{
    keyword:   string;
    category:  string;
    winCount:  number;
    lossCount: number;
  }> = await prisma.keywordSeed.findMany({
    where: { isActive: true },
    select: {
      keyword:   true,
      category:  true,
      winCount:  true,
      lossCount: true,
    },
  });
  result.consideredSeeds = seeds.length;

  if (seeds.length === 0) {
    result.errors.push(
      "No active KeywordSeed rows — run the postcode keyword generator first " +
      "(src/lib/postcode-keyword-generator.ts)",
    );
    return result;
  }

  // ── 2. Optional shark-saturation filter ─────────────────────────────
  let allowedSeedKeywords = new Set(seeds.map((s) => s.keyword));
  if (options.intelKeywords && options.sharkFlagSource) {
    const { saturated } = partitionBySharkSaturation(
      options.intelKeywords,
      options.sharkFlagSource,
    );
    const saturatedSet = new Set(saturated.map((k) => k.keyword.toLowerCase()));
    const before = allowedSeedKeywords.size;
    allowedSeedKeywords = new Set(
      Array.from(allowedSeedKeywords).filter((k) => !saturatedSet.has(k.toLowerCase())),
    );
    result.saturatedDropped = before - allowedSeedKeywords.size;
  }

  // ── 3. Score every remaining seed ───────────────────────────────────
  const scored: ScoredSeed[] = seeds
    .filter((s) => allowedSeedKeywords.has(s.keyword))
    .map((s) => ({
      keyword:         s.keyword,
      family:          s.category as SeedCategory,
      winCount:        s.winCount,
      lossCount:       s.lossCount,
      phoneLeadIntent: scorePhoneLeadIntent({
        keyword:   s.keyword,
        category:  s.category as SeedCategory,
        winCount:  s.winCount,
        lossCount: s.lossCount,
      }),
    }));

  // ── 4. Sort by intent score descending; stable by keyword ───────────
  scored.sort((a, b) => {
    if (b.phoneLeadIntent.score !== a.phoneLeadIntent.score) {
      return b.phoneLeadIntent.score - a.phoneLeadIntent.score;
    }
    return a.keyword.localeCompare(b.keyword);
  });

  // ── 5. Apply per-family quota + overall cap ─────────────────────────
  const selected = applyFamilyQuotas(scored, quota, maxDrafts);
  result.quotaFiltered = scored.length - selected.length;

  // ── 6. Ensure district landing pages + build draft payloads ──────────
  // For every selected seed: if the keyword contains a UK outcode, ensure
  // there's a published /locksmith/{district} landing page first. If the
  // district has no LockSafe coverage, ensureOrSkip returns ok=false and
  // we drop the draft entirely (no campaign without a real local page).
  //
  // Seeds with NO district in the keyword (e.g. "fixed price locksmith")
  // fall back to the generic finalUrl — those are usually trust-cluster
  // queries we route to /request.
  const payloads: Array<{ seed: ScoredSeed; payload: CampaignDraftPayload }> = [];
  const districtErrors: string[] = [];

  for (const seed of selected) {
    const detectedDistrict = detectPostcodeDistrict(seed.keyword);
    let draftFinalUrl = finalUrl;

    if (!detectedDistrict) {
      districtErrors.push(
        `${seed.keyword}: no postcode district detected — draft skipped (district landing required)`,
      );
      result.quotaFiltered++;
      continue;
    }

    // In dry-run we don't actually call ensure() — it does LLM work +
    // DB writes which we want gated behind --live.
    if (options.dryRun) {
      draftFinalUrl = `${SITE_URL}/locksmith-in/${districtSlug(detectedDistrict)}`;
    } else {
      try {
        const ensured = await ensureOrSkip(detectedDistrict);
        if (!ensured.ok) {
          districtErrors.push(
            `${seed.keyword}: ${ensured.skipReason ?? "no coverage"} — draft skipped`,
          );
          result.quotaFiltered++;
          continue;
        }
        draftFinalUrl = `${SITE_URL}/locksmith-in/${ensured.result!.slug}`;
      } catch (err) {
        // LLM/network failure — block this draft and surface the
        // error rather than ship a campaign with a missing page.
        const message = err instanceof Error ? err.message : String(err);
        districtErrors.push(
          `${seed.keyword} (${detectedDistrict}): landing-page generation failed — ${message}`,
        );
        continue;
      }
    }

    payloads.push({
      seed,
      payload: buildDiscoveryCampaignDraft(
        {
          keyword:              seed.keyword,
          family:               seed.family,
          phoneLeadIntentScore: seed.phoneLeadIntent.score,
        },
        {
          accountId:        options.accountId,
          finalUrl:         draftFinalUrl,
          websitePhoneE164: phone,
          agentId:          options.agentId,
          aiPrompt:         "discovery-orchestrator:phase2c",
        },
      ),
    });
  }

  // Bubble district errors up to the result so callers can log them
  result.errors.push(...districtErrors);

  // ── 7. Write (or report) ─────────────────────────────────────────────
  for (const { seed, payload } of payloads) {
    const entry = {
      keyword:         seed.keyword,
      family:          seed.family,
      district:        payload.audit.district,
      name:            payload.data.name,
      dailyBudget:     payload.data.dailyBudget,
      phoneLeadIntent: seed.phoneLeadIntent.score,
    };

    if (options.dryRun) {
      result.drafts.push({ ...entry, skippedReason: "dryRun" });
      continue;
    }

    try {
      // Idempotency: skip if a draft with this name already exists for
      // the same account
      const existing = await prisma.googleAdsCampaignDraft.findFirst({
        where: {
          accountId: options.accountId,
          name:      payload.data.name,
        },
        select: { id: true },
      });
      if (existing) {
        result.draftsSkipped++;
        result.drafts.push({ ...entry, skippedReason: "name exists" });
        continue;
      }

      const enforced = enforceDraftGuardrails(payload.data);
      if (!enforced.ok) {
        const message = `guardrail_violation: ${enforced.violations
          .map((v) => `${v.field}=${v.actual} (expected ${v.expected})`)
          .join("; ")}`;
        result.errors.push(`${payload.data.name}: ${message}`);
        result.drafts.push({ ...entry, error: message });
        continue;
      }
      if (enforced.appliedFixes.length > 0) {
        console.warn(
          "[discovery-orchestrator] draft auto-corrected by playbook guardrails",
          { name: payload.data.name, appliedFixes: enforced.appliedFixes },
        );
      }
      await prisma.googleAdsCampaignDraft.create({ data: enforced.data });
      result.draftsCreated++;
      result.drafts.push(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${payload.data.name}: ${message}`);
      result.drafts.push({ ...entry, error: message });
    }
  }

  return result;
}
