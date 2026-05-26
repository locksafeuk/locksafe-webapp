/**
 * Discovery Campaign Generator (Phase 2c) — unit tests.
 *
 * Pins the integration contract that pulls together all of Phase 2a/2b:
 *   • family-specific ad copy substitution + length clipping
 *   • per-family budget cap + CPC ceiling enforcement
 *   • keyword variant generation
 *   • negative-keyword baseline + family extras
 *   • deterministic naming
 *   • audit fields surfaced cleanly
 *
 * All tests are pure — no DB, no clock.
 */

import {
  buildDiscoveryCampaignDraft,
  buildHeadlines,
  buildDescriptions,
  buildKeywordVariants,
  buildNegativeKeywords,
  buildCampaignName,
  BASELINE_NEGATIVES,
} from "@/lib/discovery-campaign-generator";
import { DEFAULT_FAMILY_CAPS } from "@/lib/family-budget-caps";

// ── Test fixtures ───────────────────────────────────────────────────────────

const DEFAULT_OPTS = {
  accountId:        "test-account-id",
  finalUrl:         "https://locksafe.uk/book",
  websitePhoneE164: "+441234567890",
};

// ── Headlines ───────────────────────────────────────────────────────────────

describe("buildHeadlines — substitution + length", () => {
  it("substitutes {district} when provided", () => {
    const headlines = buildHeadlines("postcode_local", "RG1");
    expect(headlines.some((h) => h.includes("RG1"))).toBe(true);
  });

  it("strips {district} cleanly when null", () => {
    const headlines = buildHeadlines("postcode_local", null);
    expect(headlines.every((h) => !h.includes("{district}"))).toBe(true);
    expect(headlines.every((h) => !h.includes("  "))).toBe(true);  // no double spaces
  });

  it("enforces the 30-char headline limit", () => {
    const headlines = buildHeadlines("postcode_local", "SW1A");
    for (const h of headlines) {
      expect(h.length).toBeLessThanOrEqual(30);
    }
  });

  it("uses the trust_signal copy bundle when family=trust_signal", () => {
    const headlines = buildHeadlines("trust_signal", "M1");
    expect(headlines.some((h) => /mla/i.test(h))).toBe(true);
  });

  it("uses the b2b_specialist copy bundle when family=b2b_specialist", () => {
    const headlines = buildHeadlines("b2b_specialist", null);
    expect(headlines.some((h) => /commercial|landlord/i.test(h))).toBe(true);
  });

  it("falls back to neutral copy for an unrecognised family", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headlines = buildHeadlines("alien-family" as any, null);
    expect(headlines.length).toBeGreaterThanOrEqual(3);
    // Fallback includes generic trust language
    expect(headlines.some((h) => /locksmith|engineer/i.test(h))).toBe(true);
  });
});

// ── Descriptions ────────────────────────────────────────────────────────────

describe("buildDescriptions — substitution + length", () => {
  it("enforces the 90-char description limit", () => {
    const descs = buildDescriptions("postcode_local", "EC1A");
    for (const d of descs) {
      expect(d.length).toBeLessThanOrEqual(90);
    }
  });

  it("differs by family", () => {
    const a = buildDescriptions("postcode_local",    "M1");
    const b = buildDescriptions("b2b_specialist",    "M1");
    expect(a).not.toEqual(b);
  });

  it("provides at least one description per family", () => {
    for (const fam of ["postcode_local", "trust_signal", "service_long_tail", "b2b_specialist"] as const) {
      expect(buildDescriptions(fam, "M1").length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Keyword variants ────────────────────────────────────────────────────────

describe("buildKeywordVariants", () => {
  it("always includes the candidate phrase as a PHRASE match", () => {
    const variants = buildKeywordVariants(
      { keyword: "emergency locksmith RG1", family: "postcode_local" },
      "RG1",
    );
    expect(variants[0]).toEqual({
      text: "emergency locksmith rg1",
      matchType: "PHRASE",
    });
  });

  it("produces a district-first EXACT variant when district is known", () => {
    const variants = buildKeywordVariants(
      { keyword: "emergency locksmith RG1", family: "postcode_local" },
      "RG1",
    );
    const exact = variants.find((v) => v.matchType === "EXACT");
    expect(exact).toBeDefined();
    expect(exact!.text.startsWith("rg1 ")).toBe(true);
  });

  it("returns just the candidate when district is null", () => {
    const variants = buildKeywordVariants(
      { keyword: "emergency locksmith", family: "postcode_local" },
      null,
    );
    expect(variants).toEqual([{ text: "emergency locksmith", matchType: "PHRASE" }]);
  });

  it("dedupes identical variants", () => {
    const variants = buildKeywordVariants(
      { keyword: "rg1 locksmith", family: "postcode_local" },
      "RG1",
    );
    const texts = variants.map((v) => v.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("normalises to lowercase", () => {
    const variants = buildKeywordVariants(
      { keyword: "Emergency Locksmith SW1A", family: "postcode_local" },
      "SW1A",
    );
    for (const v of variants) {
      expect(v.text).toBe(v.text.toLowerCase());
    }
  });
});

// ── Negative keywords ───────────────────────────────────────────────────────

describe("buildNegativeKeywords", () => {
  it("starts from the baseline negatives", () => {
    const negs = buildNegativeKeywords("postcode_local");
    expect(negs).toEqual(expect.arrayContaining(["diy", "youtube", "amazon"]));
  });

  it("adds family-specific extras for b2b_specialist", () => {
    const negs = buildNegativeKeywords("b2b_specialist");
    expect(negs).toEqual(expect.arrayContaining(["residential", "house", "domestic"]));
  });

  it("adds family-specific extras for service_long_tail", () => {
    const negs = buildNegativeKeywords("service_long_tail");
    expect(negs).toEqual(expect.arrayContaining(["second-hand", "used", "refurbished"]));
  });

  it("does NOT add b2b extras for postcode_local", () => {
    const negs = buildNegativeKeywords("postcode_local");
    expect(negs).not.toContain("residential");
  });

  it("is deduplicated + alphabetised", () => {
    const negs = buildNegativeKeywords("postcode_local");
    expect(new Set(negs).size).toBe(negs.length);
    const sorted = [...negs].sort();
    expect(negs).toEqual(sorted);
  });

  it("BASELINE_NEGATIVES exists and is non-trivial", () => {
    expect(BASELINE_NEGATIVES.length).toBeGreaterThan(15);
    expect(BASELINE_NEGATIVES).toEqual(expect.arrayContaining(["diy", "free", "youtube"]));
  });
});

// ── Campaign name ───────────────────────────────────────────────────────────

describe("buildCampaignName", () => {
  it("renders LockSafe · Postcode · RG1 for a postcode_local candidate", () => {
    const name = buildCampaignName(
      { keyword: "emergency locksmith RG1", family: "postcode_local" },
      "RG1",
    );
    expect(name).toBe("LockSafe · Postcode · RG1");
  });

  it("renders LockSafe · Trust · M1 for a trust_signal candidate", () => {
    const name = buildCampaignName(
      { keyword: "mla locksmith M1", family: "trust_signal" },
      "M1",
    );
    expect(name).toBe("LockSafe · Trust · M1");
  });

  it("falls back to UK suffix when no district is detected", () => {
    const name = buildCampaignName(
      { keyword: "emergency locksmith", family: "postcode_local" },
      null,
    );
    expect(name).toBe("LockSafe · Postcode · UK");
  });
});

// ── Full draft builder ──────────────────────────────────────────────────────

describe("buildDiscoveryCampaignDraft — integration", () => {
  it("produces a prisma-ready payload for a postcode_local candidate", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith RG1", family: "postcode_local", phoneLeadIntentScore: 88 },
      DEFAULT_OPTS,
    );

    expect(payload.data.accountId).toBe(DEFAULT_OPTS.accountId);
    expect(payload.data.status).toBe("PENDING_APPROVAL");
    expect(payload.data.channel).toBe("SEARCH");
    expect(payload.data.biddingStrategy).toBe("MAXIMIZE_CONVERSIONS");
    expect(payload.data.geoTargets).toEqual(["2826"]);
    expect(payload.data.languageTargets).toEqual(["1000"]);
    expect(payload.data.aiGenerated).toBe(true);
    expect(payload.data.createdBy).toBe("ai");
    expect(payload.data.headlines.length).toBeGreaterThan(3);
    expect(payload.data.descriptions.length).toBeGreaterThan(0);
    expect(payload.data.keywords.length).toBeGreaterThanOrEqual(1);
    expect(payload.data.negativeKeywords).toEqual(expect.arrayContaining(["diy", "youtube"]));
  });

  it("enforces the family budget cap", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "research locksmith reviews", family: "research_intent" },
      { ...DEFAULT_OPTS, requestedDailyBudgetGbp: 999 },
    );
    expect(payload.data.dailyBudget).toBe(DEFAULT_FAMILY_CAPS.research_intent.dailyBudgetGbp);
    expect(payload.audit.budgetCapped).toBe(true);
  });

  it("uses the family default budget when none is requested", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith M1", family: "postcode_local" },
      DEFAULT_OPTS,
    );
    expect(payload.data.dailyBudget).toBe(DEFAULT_FAMILY_CAPS.postcode_local.dailyBudgetGbp);
    expect(payload.audit.budgetCapped).toBe(false);
  });

  it("caps the requested max CPC at the family ceiling", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "best locksmith review", family: "research_intent" },
      { ...DEFAULT_OPTS, requestedMaxCpcGbp: 5 },
    );
    expect(payload.audit.effectiveMaxCpc).toBe(DEFAULT_FAMILY_CAPS.research_intent.maxCpcGbp);
    expect(payload.audit.cpcCapped).toBe(true);
  });

  it("surfaces detected district in audit", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith RG1", family: "postcode_local" },
      DEFAULT_OPTS,
    );
    expect(payload.audit.district).toBe("RG1");
  });

  it("audit.district is null when no district present in keyword", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith", family: "postcode_local" },
      DEFAULT_OPTS,
    );
    expect(payload.audit.district).toBeNull();
  });

  it("audit.family matches the candidate", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "commercial locksmith leeds", family: "b2b_specialist" },
      DEFAULT_OPTS,
    );
    expect(payload.audit.family).toBe("b2b_specialist");
  });

  it("writes the phoneLeadIntent score into aiReasoning for audit", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith RG1", family: "postcode_local", phoneLeadIntentScore: 92 },
      DEFAULT_OPTS,
    );
    expect(payload.data.aiReasoning).toMatch(/phoneLeadIntent=92/);
  });

  it("writes 'unscored' to aiReasoning when no score was passed", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith RG1", family: "postcode_local" },
      DEFAULT_OPTS,
    );
    expect(payload.data.aiReasoning).toMatch(/phoneLeadIntent=unscored/);
  });

  it("includes the shared website phone number in aiReasoning", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith M1", family: "postcode_local" },
      DEFAULT_OPTS,
    );
    expect(payload.data.aiReasoning).toContain(DEFAULT_OPTS.websitePhoneE164);
  });

  it("respects an override status (DRAFT)", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith RG1", family: "postcode_local" },
      { ...DEFAULT_OPTS, status: "DRAFT" },
    );
    expect(payload.data.status).toBe("DRAFT");
  });

  it("attaches optional agentId + aiPrompt", () => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: "emergency locksmith RG1", family: "postcode_local" },
      { ...DEFAULT_OPTS, agentId: "agent-007", aiPrompt: "phase2c-launch-batch-1" },
    );
    expect(payload.data.agentId).toBe("agent-007");
    expect(payload.data.aiPrompt).toBe("phase2c-launch-batch-1");
  });

  it("produces the same output for the same input (determinism)", () => {
    const candidate = {
      keyword: "emergency locksmith RG1",
      family:  "postcode_local" as const,
      phoneLeadIntentScore: 88,
    };
    const a = buildDiscoveryCampaignDraft(candidate, DEFAULT_OPTS);
    const b = buildDiscoveryCampaignDraft(candidate, DEFAULT_OPTS);
    expect(a).toEqual(b);
  });

  it("produces distinct, family-named campaigns for the same district", () => {
    const a = buildDiscoveryCampaignDraft(
      { keyword: "locksmith RG1",            family: "postcode_local" },
      DEFAULT_OPTS,
    );
    const b = buildDiscoveryCampaignDraft(
      { keyword: "fixed price locksmith RG1", family: "trust_signal" },
      DEFAULT_OPTS,
    );
    expect(a.data.name).not.toBe(b.data.name);
    expect(a.data.name).toContain("RG1");
    expect(b.data.name).toContain("RG1");
  });
});

// ── Family-mix smoke test ───────────────────────────────────────────────────

describe("Family-mix smoke test — every family produces a valid draft", () => {
  it.each([
    "postcode_local",
    "trust_signal",
    "service_long_tail",
    "b2b_specialist",
    "research_intent",
  ] as const)("family=%s yields a non-empty payload", (family) => {
    const payload = buildDiscoveryCampaignDraft(
      { keyword: `locksmith M1 ${family}`, family },
      DEFAULT_OPTS,
    );
    expect(payload.data.headlines.length).toBeGreaterThan(0);
    expect(payload.data.descriptions.length).toBeGreaterThan(0);
    expect(payload.data.keywords.length).toBeGreaterThan(0);
    expect(payload.data.negativeKeywords.length).toBeGreaterThan(0);
    expect(payload.data.dailyBudget).toBeGreaterThanOrEqual(0);
  });
});
