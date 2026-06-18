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
  stripGeoTokens,
} from "../google-ads-draft-enforcement";
import {
  isCalloutAsset,
  isSitelinkAsset,
} from "../google-ads-copy-guard";

// A fully-conforming draft. Each test starts from a fresh copy and mutates
// one field to verify isolation.
const conforming = () => ({
  accountId: "acct1",
  status: "PENDING_APPROVAL",
  name: "Locksmith — Test (TST1)",
  dailyBudget: 25,
  biddingStrategy: "MAXIMIZE_CLICKS",
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
  // Playbook §20 (Rule §20, 2026-06-10): every draft must ship with
  // a CALL asset carrying a UK phone number. Required for AD_CALL
  // conversion to fire (30s+ duration → counts as conversion).
  //
  // Playbook §36 (2026-06-18): every draft must ALSO ship with ≥4
  // sitelinks + ≥4 callouts. Auto-injects from
  // GODMODE_RECOMMENDED_SITELINKS / GODMODE_RECOMMENDED_CALLOUTS when
  // missing, but the conforming fixture supplies them explicitly so the
  // "no fixes applied" baseline stays valid.
  assets: [
    { type: "CALL", phoneNumber: "+44 20 4577 1989", countryCode: "GB" },
    { type: "SITELINK", linkText: "24/7 Emergency Help", finalUrl: "/" },
    { type: "SITELINK", linkText: "How It Works",        finalUrl: "/how-it-works" },
    { type: "SITELINK", linkText: "Our Services",        finalUrl: "/services" },
    { type: "SITELINK", linkText: "Fixed Pricing",       finalUrl: "/pricing" },
    { type: "CALLOUT",  text: "MLA-Approved Engineers" },
    { type: "CALLOUT",  text: "DBS-Checked & Uniformed" },
    { type: "CALLOUT",  text: "Fixed Price Before Work" },
    { type: "CALLOUT",  text: "Anti-Fraud Platform" },
  ],
});

describe("google-ads-draft-enforcement", () => {
  describe("conforming case", () => {
    it("passes a conforming draft unchanged with no fixes", () => {
      const r = enforceDraftGuardrails(conforming());
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.appliedFixes).toHaveLength(0);
        expect(r.data.biddingStrategy).toBe("MAXIMIZE_CLICKS");
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
        expect(r.data.biddingStrategy).toBe("MAXIMIZE_CLICKS");
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
        if (r.ok) expect(r.data.biddingStrategy).toBe("MAXIMIZE_CLICKS");
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
          expect(r.data.biddingStrategy).toBe("MAXIMIZE_CLICKS");
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
      expect(data.biddingStrategy).toBe("MAXIMIZE_CLICKS");
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
      expect(data.biddingStrategy).toBe("MAXIMIZE_CLICKS");
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
      expect(PLAYBOOK_GUARDRAILS.BIDDING_STRATEGY).toBe("MAXIMIZE_CLICKS");
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

  describe("locationMatchType — §31 HARD REJECT (2026-06-17, GODMODE)", () => {
    it("REJECTS an explicit PRESENCE_OR_INTEREST instead of silently fixing it", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        locationMatchType: "PRESENCE_OR_INTEREST",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const v = r.violations.find((x) => x.field === "locationMatchType");
        expect(v).toBeDefined();
        expect(v?.expected).toMatch(/§31/);
      }
    });

    it("still auto-corrects an UNDEFINED locationMatchType to PRESENCE", () => {
      // We only want to reject the explicit dangerous value. Missing /
      // undefined remains a backwards-compatible auto-fix for legacy
      // callers that never set the field.
      const r = enforceDraftGuardrails({
        ...conforming(),
        locationMatchType: undefined,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.locationMatchType).toBe("PRESENCE");
        expect(r.appliedFixes.some((f) => f.field === "locationMatchType")).toBe(true);
      }
    });

    it("allowOverride bypasses §31 (admin-flagged experiment)", () => {
      const r = enforceDraftGuardrails(
        { ...conforming(), locationMatchType: "PRESENCE_OR_INTEREST" },
        { allowOverride: true },
      );
      expect(r.ok).toBe(true);
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

  // ─── §35 — No hyperlocal city/postcode in keyword text (2026-06-18) ───
  describe("§35 — no hyperlocal city/postcode in keyword text", () => {
    const ORIG_OVERRIDE = process.env.LOCKSAFE_ALLOW_HYPERLOCAL_KEYWORDS;
    afterEach(() => {
      process.env.LOCKSAFE_ALLOW_HYPERLOCAL_KEYWORDS = ORIG_OVERRIDE;
    });

    it("REGRESSION: rejects TW20 Pipeline Test's hyperlocal exact strings", () => {
      // Real keywords from TW20 Pipeline Test (2026-06-18) that ALL came
      // back "Not eligible — Low search volume" from Google.
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [
          ...Array.from({ length: 40 }, (_, i) => ({
            text: `kw${i}`,
            matchType: "PHRASE" as const,
          })),
          { text: "locked out tw20", matchType: "EXACT" as const },
          { text: "emergency lockout egham", matchType: "EXACT" as const },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const tw20 = r.violations.find(
          (x) => x.field === "keywords" && x.actual.includes("locked out tw20"),
        );
        const egham = r.violations.find(
          (x) => x.field === "keywords" && x.actual.includes("emergency lockout egham"),
        );
        expect(tw20).toBeDefined();
        expect(egham).toBeDefined();
        expect(tw20?.expected).toMatch(/§35/);
      }
    });

    it("rejects keywords containing a UK postcode like NE1, SW1A, M1", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [
          ...Array.from({ length: 40 }, (_, i) => ({
            text: `kw${i}`,
            matchType: "PHRASE" as const,
          })),
          { text: "locked out ne1", matchType: "EXACT" as const },
          { text: "lock change sw1a", matchType: "EXACT" as const },
          { text: "lockout m1", matchType: "EXACT" as const },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.violations.filter((x) => x.field === "keywords").length).toBeGreaterThanOrEqual(3);
      }
    });

    it("rejects per-ad-group keywords that contain a city/postcode", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        adGroups: [
          {
            name: "Emergency",
            keywords: [
              ...Array.from({ length: 10 }, (_, i) => ({
                text: `safe-kw${i}`,
                matchType: "PHRASE" as const,
              })),
              { text: "emergency locksmith liverpool", matchType: "EXACT" as const },
            ],
            ads: [{ headlines: ["H1"], descriptions: ["D1"] }],
          },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        // Note: 'locksmith' is ALSO banned (§10), so we expect TWO different
        // violations on the same line. We assert the §35 hyperlocal one fires.
        const hyperlocal = r.violations.find(
          (x) =>
            x.field === "adGroups[Emergency].keywords" &&
            x.expected.includes("§35"),
        );
        expect(hyperlocal).toBeDefined();
      }
    });

    it("allows the Newcastle NE1 proven pattern — generic phrase-match intents", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [
          { text: "lock change", matchType: "PHRASE" as const },
          { text: "locked out", matchType: "PHRASE" as const },
          { text: "emergency lockout", matchType: "PHRASE" as const },
          ...Array.from({ length: 50 }, (_, i) => ({
            text: `generic-${i}`,
            matchType: "PHRASE" as const,
          })),
        ],
      });
      expect(r.ok).toBe(true);
    });

    it("override LOCKSAFE_ALLOW_HYPERLOCAL_KEYWORDS=true bypasses §35", () => {
      process.env.LOCKSAFE_ALLOW_HYPERLOCAL_KEYWORDS = "true";
      const r = enforceDraftGuardrails({
        ...conforming(),
        keywords: [
          ...Array.from({ length: 40 }, (_, i) => ({
            text: `kw${i}`,
            matchType: "PHRASE" as const,
          })),
          { text: "locked out tw20", matchType: "EXACT" as const },
        ],
      });
      expect(r.ok).toBe(true);
    });

    it("stripGeoTokens returns a suggestion the operator can use as-is", () => {
      expect(stripGeoTokens("locked out tw20")).toBe("locked out");
      expect(stripGeoTokens("emergency lockout egham")).toBe("emergency lockout");
      expect(stripGeoTokens("liverpool lock change")).toBe("lock change");
    });
  });

  // ─── §36 — Mandatory sitelinks + callouts (2026-06-18) ───────────────
  describe("§36 — mandatory sitelinks (≥4) + callouts (≥4)", () => {
    it("auto-injects GODMODE_RECOMMENDED_SITELINKS when draft has zero sitelinks", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        assets: [
          { type: "CALL", phoneNumber: "+44 20 4577 1989", countryCode: "GB" },
          // 4 callouts so §36 callouts pass, but ZERO sitelinks
          { type: "CALLOUT", text: "MLA-Approved Engineers" },
          { type: "CALLOUT", text: "DBS-Checked & Uniformed" },
          { type: "CALLOUT", text: "Fixed Price Before Work" },
          { type: "CALLOUT", text: "Anti-Fraud Platform" },
        ],
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const assets = (r.data.assets as unknown[]) ?? [];
        const sitelinks = assets.filter(isSitelinkAsset);
        expect(sitelinks.length).toBeGreaterThanOrEqual(4);
        const sitelinkFix = r.appliedFixes.find(
          (f) => f.field === "assets" && /sitelinks/.test(f.expected),
        );
        expect(sitelinkFix).toBeDefined();
      }
    });

    it("auto-injects GODMODE_RECOMMENDED_CALLOUTS when draft has zero callouts", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        assets: [
          { type: "CALL", phoneNumber: "+44 20 4577 1989", countryCode: "GB" },
          // 4 sitelinks so §36 sitelinks pass, but ZERO callouts
          { type: "SITELINK", linkText: "24/7 Emergency Help", finalUrl: "/" },
          { type: "SITELINK", linkText: "How It Works",        finalUrl: "/how-it-works" },
          { type: "SITELINK", linkText: "Our Services",        finalUrl: "/services" },
          { type: "SITELINK", linkText: "Fixed Pricing",       finalUrl: "/pricing" },
        ],
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const assets = (r.data.assets as unknown[]) ?? [];
        const callouts = assets.filter(isCalloutAsset);
        expect(callouts.length).toBeGreaterThanOrEqual(4);
        const calloutFix = r.appliedFixes.find(
          (f) => f.field === "assets" && /callouts/.test(f.expected),
        );
        expect(calloutFix).toBeDefined();
      }
    });

    it("auto-injects BOTH when the draft has only a CALL asset (TW20 + Newcastle pattern)", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        assets: [{ type: "CALL", phoneNumber: "+44 20 4577 1989", countryCode: "GB" }],
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const assets = (r.data.assets as unknown[]) ?? [];
        expect(assets.filter(isSitelinkAsset).length).toBeGreaterThanOrEqual(4);
        expect(assets.filter(isCalloutAsset).length).toBeGreaterThanOrEqual(4);
      }
    });

    it("REJECTS a sitelink with banned 'no call-out fee' text in linkText", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        assets: [
          { type: "CALL", phoneNumber: "+44 20 4577 1989", countryCode: "GB" },
          { type: "SITELINK", linkText: "No Call-Out Fee", finalUrl: "/x" },
          { type: "SITELINK", linkText: "How It Works",   finalUrl: "/how-it-works" },
          { type: "SITELINK", linkText: "Our Services",   finalUrl: "/services" },
          { type: "SITELINK", linkText: "Fixed Pricing",  finalUrl: "/pricing" },
          { type: "CALLOUT", text: "MLA-Approved Engineers" },
          { type: "CALLOUT", text: "DBS-Checked & Uniformed" },
          { type: "CALLOUT", text: "Fixed Price Before Work" },
          { type: "CALLOUT", text: "Anti-Fraud Platform" },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(
          r.violations.some(
            (v) => v.field === "assets.sitelink" && /no call-out fee/i.test(v.actual),
          ),
        ).toBe(true);
      }
    });

    it("REJECTS a callout with banned 'no surprise fees' text", () => {
      const r = enforceDraftGuardrails({
        ...conforming(),
        assets: [
          { type: "CALL", phoneNumber: "+44 20 4577 1989", countryCode: "GB" },
          { type: "SITELINK", linkText: "24/7 Emergency Help", finalUrl: "/" },
          { type: "SITELINK", linkText: "How It Works",       finalUrl: "/how-it-works" },
          { type: "SITELINK", linkText: "Our Services",       finalUrl: "/services" },
          { type: "SITELINK", linkText: "Fixed Pricing",      finalUrl: "/pricing" },
          { type: "CALLOUT", text: "No Surprise Fees" },
          { type: "CALLOUT", text: "DBS-Checked & Uniformed" },
          { type: "CALLOUT", text: "Fixed Price Before Work" },
          { type: "CALLOUT", text: "Anti-Fraud Platform" },
        ],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(
          r.violations.some(
            (v) => v.field === "assets.callout" && /no surprise fees/i.test(v.actual),
          ),
        ).toBe(true);
      }
    });

    it("conforming draft passes with no §36 fixes applied", () => {
      const r = enforceDraftGuardrails(conforming());
      expect(r.ok).toBe(true);
      if (r.ok) {
        const sitelinkFixes = r.appliedFixes.filter(
          (f) => f.field === "assets" && /sitelinks/.test(f.expected),
        );
        const calloutFixes = r.appliedFixes.filter(
          (f) => f.field === "assets" && /callouts/.test(f.expected),
        );
        expect(sitelinkFixes).toHaveLength(0);
        expect(calloutFixes).toHaveLength(0);
      }
    });
  });
});
