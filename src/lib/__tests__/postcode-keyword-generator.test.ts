/**
 * Postcode × service keyword generator — generatePostcodeKeywords() tests.
 *
 * Pins down the contract that ops cares about:
 *
 *   • Generated keyword count = (unique covered districts) × (templates)
 *   • Coverage gating: never seed a keyword we can't fulfil
 *   • Idempotency: re-running doesn't double-write — existing seeds are
 *     counted as alreadyExisted, untouched
 *   • dryRun: zero side effects (no addSeed calls, no findUnique calls)
 *   • maxSeeds: hard cap is respected even with many districts × templates
 *
 * Prisma + seed-bank are mocked. No DB connection needed.
 */

// ── Module mocks (must come before importing the SUT) ────────────────────────

const findManyMock     = jest.fn();
const findUniqueMock   = jest.fn();
const addSeedMock      = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: {
    locksmithCoverage: { findMany: findManyMock },
    keywordSeed:       { findUnique: findUniqueMock },
  },
  default: {
    locksmithCoverage: { findMany: findManyMock },
    keywordSeed:       { findUnique: findUniqueMock },
  },
}));

jest.mock("@/agents/core/seed-bank", () => ({
  __esModule: true,
  addSeed: (...args: unknown[]) => addSeedMock(...args),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  generatePostcodeKeywords,
  POSTCODE_SERVICE_TEMPLATES,
} from "@/lib/postcode-keyword-generator";

// ── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  findManyMock.mockReset();
  findUniqueMock.mockReset();
  addSeedMock.mockReset();
  // Default: every keyword is brand new
  findUniqueMock.mockResolvedValue(null);
  addSeedMock.mockResolvedValue({ id: "x" });
});

function mockDistricts(districts: string[]) {
  findManyMock.mockResolvedValue(
    districts.map((d) => ({ postcodeDistrict: d })),
  );
}

// ── Template sanity (catches accidental edits to the family taxonomy) ────────

describe("POSTCODE_SERVICE_TEMPLATES", () => {
  it("has at least 5 templates per family-bucket coverage", () => {
    expect(POSTCODE_SERVICE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("every template contains the {district} placeholder", () => {
    for (const t of POSTCODE_SERVICE_TEMPLATES) {
      expect(t.template).toMatch(/\{district\}/);
    }
  });

  it("every template uses one of the four families", () => {
    const allowed = new Set([
      "postcode_local",
      "service_long_tail",
      "trust_signal",
      "b2b_specialist",
      "research_intent",
    ]);
    for (const t of POSTCODE_SERVICE_TEMPLATES) {
      expect(allowed.has(t.family)).toBe(true);
    }
  });

  it("includes all four core families (postcode_local, service_long_tail, trust_signal, b2b_specialist)", () => {
    const families = new Set(POSTCODE_SERVICE_TEMPLATES.map((t) => t.family));
    expect(families.has("postcode_local")).toBe(true);
    expect(families.has("service_long_tail")).toBe(true);
    expect(families.has("trust_signal")).toBe(true);
    expect(families.has("b2b_specialist")).toBe(true);
  });

  it("has every keyword template lowercased (matches addSeed normalisation)", () => {
    for (const t of POSTCODE_SERVICE_TEMPLATES) {
      expect(t.template).toBe(t.template.toLowerCase());
    }
  });

  it("has unique template strings", () => {
    const set = new Set(POSTCODE_SERVICE_TEMPLATES.map((t) => t.template));
    expect(set.size).toBe(POSTCODE_SERVICE_TEMPLATES.length);
  });
});

// ── Dry-run behaviour ────────────────────────────────────────────────────────

describe("generatePostcodeKeywords — dryRun mode", () => {
  it("returns the expected keyword count without side effects", async () => {
    mockDistricts(["RG1", "SK4"]);

    const result = await generatePostcodeKeywords({ dryRun: true });

    expect(result.districtsConsidered).toBe(2);
    expect(result.templatesUsed).toBe(POSTCODE_SERVICE_TEMPLATES.length);
    expect(result.keywordsGenerated).toBe(2 * POSTCODE_SERVICE_TEMPLATES.length);

    // No writes happened
    expect(addSeedMock).not.toHaveBeenCalled();
    expect(findUniqueMock).not.toHaveBeenCalled();

    // alreadyExisted / newSeedsCreated remain at zero — dry run does NOT
    // pre-count what would have happened
    expect(result.alreadyExisted).toBe(0);
    expect(result.newSeedsCreated).toBe(0);
  });

  it("samples the first 10 generated keywords", async () => {
    mockDistricts(["RG1", "SK4", "M1"]);
    const result = await generatePostcodeKeywords({ dryRun: true });

    expect(result.sampleKeywords.length).toBeLessThanOrEqual(10);
    expect(result.sampleKeywords.length).toBeGreaterThan(0);
    expect(result.sampleKeywords[0]).toMatch(/\b(RG1|SK4|M1)\b/);
    // First template substituted with first district by deterministic order
    expect(result.sampleKeywords[0]).toContain("RG1");
  });
});

// ── Coverage gating ──────────────────────────────────────────────────────────

describe("generatePostcodeKeywords — coverage gating", () => {
  it("returns 0 districts + an error when gateByCoverage=true and no coverage exists", async () => {
    mockDistricts([]);
    const result = await generatePostcodeKeywords({ dryRun: true });

    expect(result.districtsConsidered).toBe(0);
    expect(result.keywordsGenerated).toBe(0);
    expect(result.errors[0]).toMatch(/coverage/i);
  });

  it("returns 0 districts when gateByCoverage=false (we never seed without coverage)", async () => {
    // Even though the function CAN bypass coverage, the safety design here is
    // that gateByCoverage=false → districts array stays empty (no seeding
    // open-ended). Reverse if/when there's a deliberate ungated source.
    const result = await generatePostcodeKeywords({ gateByCoverage: false, dryRun: true });
    expect(result.districtsConsidered).toBe(0);
    expect(result.keywordsGenerated).toBe(0);
  });

  it("only queries LocksmithCoverage with isPaused=false + distinct postcodeDistrict", async () => {
    mockDistricts(["RG1"]);
    await generatePostcodeKeywords({ dryRun: true });

    expect(findManyMock).toHaveBeenCalledTimes(1);
    const call = findManyMock.mock.calls[0][0];
    expect(call.where).toEqual({ isPaused: false });
    expect(call.distinct).toEqual(["postcodeDistrict"]);
  });
});

// ── Idempotency / write path ─────────────────────────────────────────────────

describe("generatePostcodeKeywords — write path & idempotency", () => {
  it("writes every brand-new keyword via addSeed (no existing seeds in DB)", async () => {
    mockDistricts(["RG1"]);

    const result = await generatePostcodeKeywords();

    expect(addSeedMock).toHaveBeenCalledTimes(POSTCODE_SERVICE_TEMPLATES.length);
    expect(result.newSeedsCreated).toBe(POSTCODE_SERVICE_TEMPLATES.length);
    expect(result.alreadyExisted).toBe(0);
  });

  it("counts a keyword as alreadyExisted when KeywordSeed.findUnique returns a row", async () => {
    mockDistricts(["RG1"]);
    // Make the very first template-keyword exist; the rest are new
    findUniqueMock.mockImplementation(async ({ where }: { where: { keyword: string } }) =>
      where.keyword === `${POSTCODE_SERVICE_TEMPLATES[0].template.replace("{district}", "RG1").toLowerCase()}`
        ? { id: "existing" }
        : null,
    );

    const result = await generatePostcodeKeywords();

    expect(result.alreadyExisted).toBe(1);
    expect(result.newSeedsCreated).toBe(POSTCODE_SERVICE_TEMPLATES.length - 1);
    expect(addSeedMock).toHaveBeenCalledTimes(POSTCODE_SERVICE_TEMPLATES.length - 1);
  });

  it("passes the correct category + source tag to addSeed", async () => {
    mockDistricts(["RG1"]);
    await generatePostcodeKeywords({ batchId: "test_batch" });

    expect(addSeedMock).toHaveBeenCalled();
    const firstCall = addSeedMock.mock.calls[0];
    const [keyword, opts] = firstCall;

    expect(typeof keyword).toBe("string");
    expect(opts.source).toBe("postcode_generator:test_batch");
    // Category should be one of the family strings (typed in the generator)
    expect(["postcode_local", "service_long_tail", "trust_signal", "b2b_specialist", "research_intent"])
      .toContain(opts.category);
    expect(opts.notes).toMatch(/intent:/);
  });

  it("captures the error in result.errors when addSeed throws — does not crash", async () => {
    mockDistricts(["RG1"]);
    addSeedMock
      .mockRejectedValueOnce(new Error("simulated DB outage"))
      .mockResolvedValue({ id: "x" });

    const result = await generatePostcodeKeywords();

    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toMatch(/simulated DB outage/);
    // Remaining keywords still get written
    expect(result.newSeedsCreated).toBe(POSTCODE_SERVICE_TEMPLATES.length - 1);
  });
});

// ── Hard-cap / dedup behaviour ───────────────────────────────────────────────

describe("generatePostcodeKeywords — maxSeeds + dedup", () => {
  it("respects maxSeeds as a hard cap on queue size", async () => {
    mockDistricts(["RG1", "SK4", "M1", "L1", "B1", "S1", "LS1"]);  // 7 districts
    const cap = 10;

    const result = await generatePostcodeKeywords({ maxSeeds: cap, dryRun: true });

    expect(result.keywordsGenerated).toBeLessThanOrEqual(cap);
  });

  it("dedups identical (district, template) combos within the same run", async () => {
    // Pass the SAME district twice — DB distinct should prevent this in
    // production, but the in-memory seen-set must still de-dupe defensively.
    mockDistricts(["RG1", "RG1"]);

    const result = await generatePostcodeKeywords({ dryRun: true });

    // Same district queried twice from the DB layer, but the keyword set
    // should still be exactly templates.length (not 2× templates.length).
    expect(result.keywordsGenerated).toBe(POSTCODE_SERVICE_TEMPLATES.length);
    expect(new Set(result.sampleKeywords).size).toBe(result.sampleKeywords.length);
  });

  it("uses the supplied templates override when provided", async () => {
    mockDistricts(["RG1", "SK4"]);
    const customTemplates: typeof POSTCODE_SERVICE_TEMPLATES = [
      {
        template: "test keyword {district}",
        family:   "postcode_local",
        intent:   "custom override",
      },
    ];

    const result = await generatePostcodeKeywords({
      templates: customTemplates,
      dryRun:    true,
    });

    expect(result.templatesUsed).toBe(1);
    expect(result.keywordsGenerated).toBe(2);  // 2 districts × 1 template
    expect(result.sampleKeywords).toEqual(
      expect.arrayContaining(["test keyword RG1", "test keyword SK4"]),
    );
  });
});
