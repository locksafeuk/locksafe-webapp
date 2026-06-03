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
  /** The Liverpool Test loss — Manual CPC at £116.54 / 0 conv — is why this is fixed. */
  BIDDING_STRATEGY: "MAXIMIZE_CONVERSIONS" as const,

  /** Google RSA structural limits + playbook minimums. */
  MIN_HEADLINES: 14,
  MAX_HEADLINES: 15, // Google Ads RSA hard limit
  MIN_DESCRIPTIONS: 4,
  MAX_DESCRIPTIONS: 4, // Google Ads RSA hard limit

  /** Playbook target = 54 keywords. Allow some slack for the agent's natural
   * variance; reject only drafts that are dramatically thin. */
  MIN_KEYWORDS: 40,

  /** Playbook target = 128 negatives (the shared list verbatim). Same slack
   * rationale as above. */
  MIN_NEGATIVE_KEYWORDS: 100,

  /** Every draft must land on a city/district page that returned 200 before publish. */
  REQUIRE_FINAL_URL: true,
} as const;

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

/**
 * Validate and auto-correct draft create-data against the playbook guardrails.
 *
 * Caller pattern:
 *
 *   const enforced = enforceDraftGuardrails(data);
 *   if (!enforced.ok) {
 *     return NextResponse.json({ error: "guardrail_violation", violations: enforced.violations }, { status: 422 });
 *   }
 *   if (enforced.appliedFixes.length > 0) {
 *     console.warn("[ads] draft auto-corrected at persist", enforced.appliedFixes);
 *   }
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

  // 4. Keywords. ─────────────────────────────────────────────────────────
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

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, data: out, appliedFixes };
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
