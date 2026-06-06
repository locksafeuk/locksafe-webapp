/**
 * @jest-environment node
 *
 * Tests for the structural guardrail enforcement at draft-persist time.
 *
 * Includes a regression test that replays the 2026-06-03 scenario where 12
 * drafts shipped as MANUAL_CPC. With this module wired into every persist
 * callsite, all 12 would have been auto-corrected to MAXIMIZE_CONVERSIONS
 * before reaching the DB.
 */

import {
  assertDraftGuardrails,
  DraftGuardrailError,
  enforceDraftGuardrails,
  isAutoPerLocksmithGenerationEnabled,
  PLAYBOOK_GUARDRAILS,
} from "../google-ads-draft-enforcement";

// A fully-conforming draft. Each test starts from a fresh copy and mutates
// one field to verify isolation.
const conforming = () => ({
  accountId: "acct1",
  status: "PENDING_APPROVAL",
  name: "Locksmith — Test (TST1)",
  dailyBudget: 25,
  biddingStrategy: "MAXIMIZE_CONVERSIONS",
  targetCpa: null,
  channel: "SEARCH",
  locationMatchType: "PRESENCE",
  geoTargets: ["2826"],
  languageTargets: ["1000"],
  headlines: Array.from({ length: 14 }, (_, i) => `H${i + 1}`),
  descriptions: Array.from({ length: 4 }, (_, i) => `D${i + 1}`),
  finalUrl: "https://www.locksafe.uk/locksmith-city/liverpool",
  keywords: Array.from({ length: 54 }, (_, i) => ({
    text: `kw${i}`,
    matchType: "PHRASE" as const,
  })),
  negativeKeywords: Array.from({ length: 128 }, (_, i) => `neg${i}`),
});

describe("google-ads-draft-enforcement", () => {
  describe("conforming case", () => {
    it("passes a conforming draft unchanged with no fixes", () => {
      const r = enforceDraftGuardrails(conforming());
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.appliedFixes).toHaveLength(0);
        expect(r.data.biddingStrategy).toBe("MAXIMIZE_CONVERSIONS");
      }
    });
  });

  describe("THE LIVERPOOL FIX — biddingStrategy override", () => {
    it("auto-overrides MANUAL_CPC to MAXIMIZE_CONVERSIONS", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        biddingStrategy: "MANUAL_CPC",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.biddingStrategy).toBe("MAXIMIZE_CONVERSIONS");
        expect(r.data.targetCpa).toBeNull();
        const fix = r.appliedFixes.find((f) => f.field === "biddingStrategy");
        expect(fix).toBeDefined();
        expect(fix?.actual).toBe("MANUAL_CPC");
        expect(fix?.severity).toBe("error");
      }
    });

    it("overrides every non-conforming strategy variant", () => {
      const variants = [
        "MANUAL_CPC",
        "TARGET_CPA",
        "TARGET_ROAS",
        "MAXIMIZE_CLICKS",
        "TARGET_IMPRESSION_SHARE",
        undefined,
      ];
      for (const v of variants) {
        const r = enforceDraftGuardrails({
          ...conforming(),
          biddingStrategy: v as string | undefined,
        });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.data.biddingStrategy).toBe("MAXIMIZE_CONVERSIONS");
      }
    });

    it("REGRESSION: replays the 2026-06-03 queue (12 MANUAL_CPC drafts)", () => {
      for (let i = 0; i < 12; i++) {
        const r = enforceDraftGuardrails({
          ...conforming(),
          biddingStrategy: "MANUAL_CPC",
          name: `Locksmith — Generated ${i + 1}`,
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.data.biddingStrategy).toBe("MAXIMIZE_CONVERSIONS");
          expect(
            r.appliedFixes.some((f) => f.field === "biddingStrategy"),
          ).toBe(true);
        }
      }
    });

    it("respects allowOverride for admin-flagged exceptions", () => {
      const r = enforceDraftGuardrails(
        { ...conforming(), biddingStrategy: "MANUAL_CPC" },
        { allowOverride: true },
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.biddingStrategy).toBe("MANUAL_CPC");
        expect(
          r.appliedFixes.some((f) => f.field === "biddingStrategy"),
        ).toBe(false);
      }
    });
  });

  describe("headlines", () => {
    it("rejects drafts with fewer than 14 headlines", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        headlines: ["only one"],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.violations.some((v) => v.field === "headlines")).toBe(true);
      }
    });

    it("truncates headlines past the Google RSA limit (15)", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        headlines: Array.from({ length: 20 }, (_, i) => `H${i}`),
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect((r.data.headlines as string[]).length).toBe(15);
        expect(r.appliedFixes.some((f) => f.field === "headlines")).toBe(true);
      }
    });
  });

  describe("descriptions", () => {
    it("rejects drafts with fewer than 4 descriptions", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        descriptions: ["one", "two", "three"],
      });
      expect(r.ok).toBe(false);
    });
  });

  describe("keywords", () => {
    it("rejects drafts with fewer than 40 keywords", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [{ text: "a", matchType: "PHRASE" as const }],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.violations.some((v) => v.field === "keywords")).toBe(true);
      }
    });

    it("counts keywords as a json array regardless of inner shape", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: Array.from({ length: 45 }, (_, i) => ({ text: `k${i}` })),
      });
      expect(r.ok).toBe(true);
    });
  });

  describe("negative keywords", () => {
    it("rejects drafts with fewer than 100 negatives", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        negativeKeywords: ["only", "a", "few"],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(
          r.violations.some((v) => v.field === "negativeKeywords"),
        ).toBe(true);
      }
    });
  });

  describe("final URL", () => {
    it("rejects missing finalUrl", () => {
      const r = enforceDraftGuardrails({ ...conforming(), finalUrl: "" });
      expect(r.ok).toBe(false);
    });

    it("rejects non-http URLs", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        finalUrl: "/locksmith-city/liverpool",
      });
      expect(r.ok).toBe(false);
    });
  });

  describe("assertDraftGuardrails (strict)", () => {
    it("returns enforced data on success", () => {
      const { data } = assertDraftGuardrails(conforming());
      expect(data.biddingStrategy).toBe("MAXIMIZE_CONVERSIONS");
    });

    it("throws DraftGuardrailError on violations", () => {
      expect(() =>
        assertDraftGuardrails({ ...conforming(), headlines: [] }),
      ).toThrow(DraftGuardrailError);
    });

    it("exposes violations on the thrown error", () => {
      try {
        assertDraftGuardrails({
          ...conforming(),
          keywords: [],
          descriptions: [],
        });
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DraftGuardrailError);
        const v = (e as DraftGuardrailError).violations;
        expect(v.some((x) => x.field === "keywords")).toBe(true);
        expect(v.some((x) => x.field === "descriptions")).toBe(true);
      }
    });

    it("auto-fixes biddingStrategy without throwing", () => {
      const { data, appliedFixes } = assertDraftGuardrails({
        ...conforming(),
        biddingStrategy: "MANUAL_CPC",
      });
      expect(data.biddingStrategy).toBe("MAXIMIZE_CONVERSIONS");
      expect(appliedFixes.some((f) => f.field === "biddingStrategy")).toBe(
        true,
      );
    });
  });

  describe("isAutoPerLocksmithGenerationEnabled (feature flag)", () => {
    const ORIG = process.env.ENABLE_AUTO_PER_LOCKSMITH_DRAFTS;
    afterEach(() => {
      process.env.ENABLE_AUTO_PER_LOCKSMITH_DRAFTS = ORIG;
    });

    it("defaults disabled when env var is unset", () => {
      delete process.env.ENABLE_AUTO_PER_LOCKSMITH_DRAFTS;
      expect(isAutoPerLocksmithGenerationEnabled()).toBe(false);
    });

    it("is disabled when env var is 'false'", () => {
      process.env.ENABLE_AUTO_PER_LOCKSMITH_DRAFTS = "false";
      expect(isAutoPerLocksmithGenerationEnabled()).toBe(false);
    });

    it("is enabled only when env var is exactly 'true'", () => {
      process.env.ENABLE_AUTO_PER_LOCKSMITH_DRAFTS = "true";
      expect(isAutoPerLocksmithGenerationEnabled()).toBe(true);
    });

    it("is disabled for ambiguous truthy values", () => {
      for (const v of ["1", "yes", "TRUE", "True", "on"]) {
        process.env.ENABLE_AUTO_PER_LOCKSMITH_DRAFTS = v;
        expect(isAutoPerLocksmithGenerationEnabled()).toBe(false);
      }
    });
  });

  describe("playbook constant sanity", () => {
    it("aligns with the playbook target bid strategy", () => {
      expect(PLAYBOOK_GUARDRAILS.BIDDING_STRATEGY).toBe("MAXIMIZE_CONVERSIONS");
    });

    it("aligns with Google RSA limits", () => {
      expect(PLAYBOOK_GUARDRAILS.MAX_HEADLINES).toBe(15);
      expect(PLAYBOOK_GUARDRAILS.MAX_DESCRIPTIONS).toBe(4);
    });

    it("encodes the per-ad-group floors (post-2026-06-02 lesson)", () => {
      expect(PLAYBOOK_GUARDRAILS.MIN_KEYWORDS_PER_AD_GROUP).toBe(10);
      expect(PLAYBOOK_GUARDRAILS.MIN_ADS_PER_AD_GROUP).toBe(1);
    });

    it("bans 'locksmith' in keywords (Local Services policy)", () => {
      expect(PLAYBOOK_GUARDRAILS.BANNED_KEYWORD_TOKENS).toContain("locksmith");
      expect(PLAYBOOK_GUARDRAILS.BANNED_KEYWORD_EXACT).toContain("lock replacement");
    });

    it("encodes forensic-validation traffic controls (§15)", () => {
      expect(PLAYBOOK_GUARDRAILS.ADVERTISING_CHANNEL_TYPE).toBe("SEARCH");
      expect(PLAYBOOK_GUARDRAILS.LOCATION_MATCH_TYPE).toBe("PRESENCE");
    });
  });

  // ─── Forensic-validation enforcement (§15) ─────────────────────────────

  describe("channel — HARD OVERRIDE to SEARCH", () => {
    it("auto-overrides DISPLAY to SEARCH", () => {
      const r = enforceDraftGuardrails({ ...conforming(), channel: "DISPLAY" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.channel).toBe("SEARCH");
        expect(r.appliedFixes.some((f) => f.field === "channel")).toBe(true);
      }
    });

    it("respects allowOverride for explicit channel experiments", () => {
      const r = enforceDraftGuardrails(
        { ...conforming(), channel: "DISPLAY" },
        { allowOverride: true },
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.channel).toBe("DISPLAY");
    });
  });

  describe("locationMatchType — HARD OVERRIDE to PRESENCE", () => {
    it("auto-overrides PRESENCE_OR_INTEREST to PRESENCE", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        locationMatchType: "PRESENCE_OR_INTEREST",
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.locationMatchType).toBe("PRESENCE");
        expect(r.appliedFixes.some((f) => f.field === "locationMatchType")).toBe(true);
      }
    });
  });

  describe("UK geo allowlist (safety net)", () => {
    it("accepts the country fallback ID (2826)", () => {
      const r = enforceDraftGuardrails({ ...conforming(), geoTargets: ["2826"] });
      expect(r.ok).toBe(true);
    });

    it("accepts known city IDs", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        geoTargets: ["1006517", "1006515"], // Yorkshire-ish
      });
      expect(r.ok).toBe(true);
    });

    it("rejects empty geoTargets", () => {
      const r = enforceDraftGuardrails({ ...conforming(), geoTargets: [] });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.violations.some((v) => v.field === "geoTargets")).toBe(true);
      }
    });

    it("rejects a non-UK ID (a French/Irish ID, a typo)", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        geoTargets: ["1006517", "9999999"], // 9999999 not on UK allowlist
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const v = r.violations.find(
          (x) => x.field === "geoTargets" && x.actual === "9999999",
        );
        expect(v).toBeDefined();
      }
    });

    it("rejects ALL geos when the only one is non-UK", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        geoTargets: ["12345"], // not on allowlist
      });
      expect(r.ok).toBe(false);
    });
  });

  // ─── New checks added 2026-06-04 after the empty-ad-group failure ────

  describe("Local Services policy — banned keyword tokens", () => {
    it("rejects keywords containing 'locksmith' at the flat-keywords level", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [
          ...Array.from({ length: 53 }, (_, i) => ({ text: `kw${i}`, matchType: "PHRASE" as const })),
          { text: "emergency locksmith", matchType: "EXACT" as const },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const v = r.violations.find((x) =>
          x.field === "keywords" && x.actual === "emergency locksmith",
        );
        expect(v).toBeDefined();
        expect(v?.severity).toBe("error");
      }
    });

    it("rejects bare 'lock replacement' even without 'locksmith'", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [
          ...Array.from({ length: 53 }, (_, i) => ({ text: `kw${i}`, matchType: "PHRASE" as const })),
          { text: "lock replacement", matchType: "EXACT" as const },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const v = r.violations.find(
          (x) => x.field === "keywords" && x.actual === "lock replacement",
        );
        expect(v).toBeDefined();
      }
    });

    it("allows qualified variants like 'door lock replacement'", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [
          ...Array.from({ length: 53 }, (_, i) => ({ text: `kw${i}`, matchType: "PHRASE" as const })),
          { text: "door lock replacement", matchType: "PHRASE" as const },
        ],
      });
      expect(r.ok).toBe(true);
    });

    it("allows the validated 'locked out' phrasing pattern", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [
          { text: "locked out", matchType: "PHRASE" },
          { text: "locked out of house", matchType: "EXACT" },
          { text: "house lockout", matchType: "EXACT" },
          ...Array.from({ length: 50 }, (_, i) => ({
            text: `kw${i}`,
            matchType: "PHRASE" as const,
          })),
        ],
      });
      expect(r.ok).toBe(true);
    });
  });

  describe("per-ad-group enforcement (the 2026-06-02 failure mode)", () => {
    const conformingAdGroup = (name: string) => ({
      name,
      keywords: Array.from({ length: 12 }, (_, i) => ({
        text: `${name.toLowerCase()}-kw${i}`,
        matchType: "PHRASE" as const,
      })),
      ads: [
        {
          headlines: Array.from({ length: 14 }, (_, i) => `H${i + 1}`),
          descriptions: Array.from({ length: 4 }, (_, i) => `D${i + 1}`),
        },
      ],
      headlines: Array.from({ length: 14 }, (_, i) => `H${i + 1}`),
      descriptions: Array.from({ length: 4 }, (_, i) => `D${i + 1}`),
    });

    it("passes when all 5 themed ad groups are fully populated", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        adGroups: [
          conformingAdGroup("Emergency & 24hr"),
          conformingAdGroup("Locked Out"),
          conformingAdGroup("Lock Change & Burglary"),
          conformingAdGroup("uPVC & Composite Doors"),
          conformingAdGroup("Trust & USP"),
        ],
      });
      expect(r.ok).toBe(true);
    });

    it("REGRESSION: rejects the 2026-06-02 pattern — 3 of 5 ad groups empty", () => {
      // Reproduces what shipped on 2026-06-02: only Locked Out + uPVC got
      // populated; Emergency & 24hr, Lock Change & Burglary, Trust & USP
      // shipped with empty keywords arrays.
      const r = enforceDraftGuardrails({
        ...conforming(),
        adGroups: [
          { ...conformingAdGroup("Emergency & 24hr"), keywords: [] },
          conformingAdGroup("Locked Out"),
          { ...conformingAdGroup("Lock Change & Burglary"), keywords: [] },
          conformingAdGroup("uPVC & Composite Doors"),
          { ...conformingAdGroup("Trust & USP"), keywords: [] },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        // Each of the 3 empty ad groups must produce a keywords violation
        const labels = [
          "Emergency & 24hr",
          "Lock Change & Burglary",
          "Trust & USP",
        ];
        for (const label of labels) {
          const v = r.violations.find((x) =>
            x.field === `adGroups[${label}].keywords`,
          );
          expect(v).toBeDefined();
        }
      }
    });

    it("rejects an ad group with zero ads (the LC&B-no-RSA case)", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        adGroups: [
          { ...conformingAdGroup("Lock Change & Burglary"), ads: [] },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const v = r.violations.find(
          (x) => x.field === "adGroups[Lock Change & Burglary].ads",
        );
        expect(v).toBeDefined();
      }
    });

    it("rejects per-ad-group keywords containing 'locksmith'", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        adGroups: [
          {
            ...conformingAdGroup("Emergency & 24hr"),
            keywords: [
              { text: "emergency locksmith", matchType: "EXACT" },
              { text: "24 hour locksmith", matchType: "EXACT" },
              ...Array.from({ length: 10 }, (_, i) => ({
                text: `kw${i}`,
                matchType: "PHRASE" as const,
              })),
            ],
          },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(
          r.violations.some(
            (x) =>
              x.field === "adGroups[Emergency & 24hr].keywords" &&
              x.actual === "emergency locksmith",
          ),
        ).toBe(true);
      }
    });

    it("uses ad group index when name is missing", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        adGroups: [{ keywords: [], ads: [] }],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(
          r.violations.some((x) => x.field.includes("ad group 1")),
        ).toBe(true);
      }
    });
  });
});
