/**
 * Discovery Campaign Orchestrator — unit tests.
 *
 * Mocks Prisma to verify the selection + write contract end-to-end:
 *   • pulls KeywordSeed rows respecting isActive=true
 *   • scores + sorts via phoneLeadIntentScore
 *   • applies per-family quota + overall cap
 *   • optional shark-saturation demotion
 *   • idempotent writes (skips when name already exists)
 *   • dryRun = zero side effects
 *   • bubbles up errors without crashing the run
 */

// ── Module mocks ────────────────────────────────────────────────────────────

const findManyMock          = jest.fn();
const findFirstMock         = jest.fn();
const createMock            = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: {
    keywordSeed: { findMany: findManyMock },
    googleAdsCampaignDraft: {
      findFirst: findFirstMock,
      create:    createMock,
    },
  },
  default: {
    keywordSeed: { findMany: findManyMock },
    googleAdsCampaignDraft: {
      findFirst: findFirstMock,
      create:    createMock,
    },
  },
}));

// ── Imports (after mock) ────────────────────────────────────────────────────

import {
  generateDiscoveryDrafts,
  applyFamilyQuotas,
  DEFAULT_FAMILY_QUOTA,
} from "@/lib/discovery-campaign-orchestrator";
import { scorePhoneLeadIntent } from "@/lib/phone-lead-intent-score";
import type { SeedCategory } from "@/agents/core/seed-bank";

// ── Helpers ─────────────────────────────────────────────────────────────────

const ACCOUNT_ID = "acct-test-1";

interface FakeSeed {
  keyword:   string;
  category:  SeedCategory;
  winCount?: number;
  lossCount?: number;
}

function mockSeeds(seeds: FakeSeed[]) {
  findManyMock.mockResolvedValue(
    seeds.map((s) => ({
      keyword:   s.keyword,
      category:  s.category,
      winCount:  s.winCount  ?? 0,
      lossCount: s.lossCount ?? 0,
    })),
  );
}

beforeEach(() => {
  findManyMock.mockReset();
  findFirstMock.mockReset();
  createMock.mockReset();

  // Defaults: nothing exists yet → every draft writes
  findFirstMock.mockResolvedValue(null);
  createMock.mockResolvedValue({ id: "new-draft" });
});

// ── DEFAULT_FAMILY_QUOTA invariants ──────────────────────────────────────────

describe("DEFAULT_FAMILY_QUOTA", () => {
  it("sums to 6 for the opening launch", () => {
    const total = Object.values(DEFAULT_FAMILY_QUOTA).reduce((s, n) => s + n, 0);
    expect(total).toBe(6);
  });

  it("gives postcode_local the largest quota", () => {
    expect(DEFAULT_FAMILY_QUOTA.postcode_local).toBeGreaterThan(
      DEFAULT_FAMILY_QUOTA.trust_signal,
    );
    expect(DEFAULT_FAMILY_QUOTA.postcode_local).toBeGreaterThan(
      DEFAULT_FAMILY_QUOTA.b2b_specialist,
    );
  });

  it("keeps research_intent + negative + service at 0 in the opening", () => {
    expect(DEFAULT_FAMILY_QUOTA.research_intent).toBe(0);
    expect(DEFAULT_FAMILY_QUOTA.negative).toBe(0);
    expect(DEFAULT_FAMILY_QUOTA.service_long_tail).toBe(0);
  });
});

// ── applyFamilyQuotas (pure) ────────────────────────────────────────────────

describe("applyFamilyQuotas", () => {
  // Helper: score-like input for the pure selector
  const s = (keyword: string, family: SeedCategory, score: number) => ({
    keyword,
    family,
    winCount: 0,
    lossCount: 0,
    phoneLeadIntent: scorePhoneLeadIntent({ keyword, category: family }),
    // Override score for predictable test ordering
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as Parameters<typeof applyFamilyQuotas>[0][number] & { phoneLeadIntent: { score: number } };

  it("never returns more than maxDrafts entries", () => {
    const scored = [
      s("a", "postcode_local", 90),
      s("b", "postcode_local", 85),
      s("c", "trust_signal",   80),
      s("d", "b2b_specialist", 70),
    ];
    expect(applyFamilyQuotas(scored, DEFAULT_FAMILY_QUOTA, 3)).toHaveLength(3);
  });

  it("respects per-family quota — extra postcode_local seeds are skipped past the cap", () => {
    const quota = { ...DEFAULT_FAMILY_QUOTA, postcode_local: 2 } as Record<SeedCategory, number>;
    const scored = [
      s("a", "postcode_local", 90),
      s("b", "postcode_local", 85),
      s("c", "postcode_local", 80),  // over quota — should be dropped
      s("d", "trust_signal",   70),
    ];
    const selected = applyFamilyQuotas(scored, quota, 10);
    expect(selected.map((x) => x.keyword)).toEqual(["a", "b", "d"]);
  });

  it("drops families with quota=0 entirely", () => {
    const scored = [
      s("research", "research_intent", 90),  // quota 0
      s("post",     "postcode_local",  60),
    ];
    const selected = applyFamilyQuotas(scored, DEFAULT_FAMILY_QUOTA, 10);
    expect(selected.map((x) => x.keyword)).toEqual(["post"]);
  });

  it("preserves input ordering within each family", () => {
    const scored = [
      s("p1", "postcode_local", 90),
      s("p2", "postcode_local", 85),
      s("p3", "postcode_local", 80),
      s("p4", "postcode_local", 75),
    ];
    const selected = applyFamilyQuotas(scored, DEFAULT_FAMILY_QUOTA, 10);
    expect(selected.map((x) => x.keyword)).toEqual(["p1", "p2", "p3", "p4"]);
  });
});

// ── Orchestrator end-to-end ─────────────────────────────────────────────────

describe("generateDiscoveryDrafts — selection + writes", () => {
  it("creates drafts for the top candidates respecting the default mix", async () => {
    mockSeeds([
      { keyword: "emergency locksmith RG1",   category: "postcode_local"    },
      { keyword: "locked out M1",             category: "postcode_local"    },
      { keyword: "mla locksmith leeds",        category: "trust_signal"      },
      { keyword: "commercial locksmith bristol", category: "b2b_specialist" },
      { keyword: "lock change SW1A",           category: "service_long_tail" }, // quota 0 in default
      { keyword: "how to pick a lock",         category: "research_intent"   }, // quota 0
    ]);

    const result = await generateDiscoveryDrafts({ accountId: ACCOUNT_ID });

    expect(result.consideredSeeds).toBe(6);
    expect(result.draftsCreated).toBeGreaterThan(0);
    expect(result.draftsCreated).toBeLessThanOrEqual(6);
    // service_long_tail + research_intent should NOT have been written
    const writtenNames = createMock.mock.calls.map((c) => c[0].data.name);
    expect(writtenNames.some((n: string) => n.includes("Research"))).toBe(false);
    expect(writtenNames.some((n: string) => n.includes("Service"))).toBe(false);
  });

  it("calls prisma.create with the discovery-orchestrator audit prompt", async () => {
    mockSeeds([{ keyword: "emergency locksmith RG1", category: "postcode_local" }]);
    await generateDiscoveryDrafts({ accountId: ACCOUNT_ID });
    expect(createMock).toHaveBeenCalled();
    const args = createMock.mock.calls[0][0].data;
    expect(args.accountId).toBe(ACCOUNT_ID);
    expect(args.aiPrompt).toBe("discovery-orchestrator:phase2c");
    expect(args.status).toBe("PENDING_APPROVAL");
  });

  it("skips a draft whose name already exists (idempotent re-run)", async () => {
    mockSeeds([{ keyword: "emergency locksmith RG1", category: "postcode_local" }]);
    findFirstMock.mockResolvedValueOnce({ id: "existing-draft" });

    const result = await generateDiscoveryDrafts({ accountId: ACCOUNT_ID });
    expect(result.draftsCreated).toBe(0);
    expect(result.draftsSkipped).toBe(1);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("dryRun → no findFirst, no create, full draft list still returned", async () => {
    mockSeeds([
      { keyword: "emergency locksmith RG1", category: "postcode_local" },
      { keyword: "mla locksmith leeds",      category: "trust_signal"   },
    ]);

    const result = await generateDiscoveryDrafts({ accountId: ACCOUNT_ID, dryRun: true });

    expect(createMock).not.toHaveBeenCalled();
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(result.draftsCreated).toBe(0);
    expect(result.drafts.length).toBeGreaterThan(0);
    expect(result.drafts.every((d) => d.skippedReason === "dryRun")).toBe(true);
  });

  it("errors out gracefully when no seeds exist", async () => {
    mockSeeds([]);
    const result = await generateDiscoveryDrafts({ accountId: ACCOUNT_ID });
    expect(result.errors[0]).toMatch(/no active KeywordSeed/i);
    expect(result.draftsCreated).toBe(0);
  });

  it("captures per-draft errors without aborting the whole run", async () => {
    mockSeeds([
      { keyword: "emergency locksmith RG1", category: "postcode_local" },
      { keyword: "emergency locksmith M1",   category: "postcode_local" },
    ]);
    // First create succeeds, second throws
    createMock
      .mockResolvedValueOnce({ id: "ok" })
      .mockRejectedValueOnce(new Error("simulated DB outage"));

    const result = await generateDiscoveryDrafts({ accountId: ACCOUNT_ID });
    expect(result.draftsCreated).toBe(1);
    expect(result.errors[0]).toMatch(/simulated DB outage/);
  });

  it("requires an accountId — returns an error when missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await generateDiscoveryDrafts({} as any);
    expect(result.errors[0]).toMatch(/accountId is required/);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("queries only active KeywordSeeds", async () => {
    mockSeeds([{ keyword: "x", category: "postcode_local" }]);
    await generateDiscoveryDrafts({ accountId: ACCOUNT_ID, dryRun: true });
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const args = findManyMock.mock.calls[0][0];
    expect(args.where).toEqual({ isActive: true });
  });
});

// ── Shark-saturation gating ─────────────────────────────────────────────────

describe("generateDiscoveryDrafts — shark-saturation gating", () => {
  it("drops keywords flagged as saturated when intelKeywords + flagSource are passed", async () => {
    mockSeeds([
      { keyword: "emergency locksmith london", category: "postcode_local" },
      { keyword: "emergency locksmith bristol", category: "postcode_local" },
    ]);

    const result = await generateDiscoveryDrafts({
      accountId: ACCOUNT_ID,
      dryRun:    true,
      intelKeywords: [
        // London's SERP is shark-dominated → should be dropped
        {
          keyword: "emergency locksmith london",
          cpcGbp: 4.5, monthlyClicks: 200, competitionIndex: 90, avgPosition: 1.5,
          serpConfirmed: true, fingerprintConfirmed: true, dualConfirmed: true,
          geoCount: 1, geos: ["london"], competitorCount: 4, adCopyVariants: 4,
          isEntering: false, isExiting: false,
          serpDomains:        ["shark-a.co.uk", "shark-b.co.uk", "shark-c.co.uk"],
          fingerprintDomains: [],
        },
        // Bristol's SERP looks clean → should be kept
        {
          keyword: "emergency locksmith bristol",
          cpcGbp: 3, monthlyClicks: 80, competitionIndex: 50, avgPosition: 2,
          serpConfirmed: true, fingerprintConfirmed: true, dualConfirmed: true,
          geoCount: 1, geos: ["bristol"], competitorCount: 3, adCopyVariants: 2,
          isEntering: true, isExiting: false,
          serpDomains:        ["independent-bristol.co.uk", "honest-locks.co.uk", "another.co.uk"],
          fingerprintDomains: [],
        },
      ],
      sharkFlagSource: new Set(["shark-a.co.uk", "shark-b.co.uk", "shark-c.co.uk"]),
    });

    expect(result.saturatedDropped).toBe(1);
    expect(result.drafts.map((d) => d.keyword)).toContain("emergency locksmith bristol");
    expect(result.drafts.map((d) => d.keyword)).not.toContain("emergency locksmith london");
  });

  it("does NOT demote anything when intelKeywords is omitted", async () => {
    mockSeeds([
      { keyword: "emergency locksmith london",  category: "postcode_local" },
      { keyword: "emergency locksmith bristol", category: "postcode_local" },
    ]);

    const result = await generateDiscoveryDrafts({
      accountId: ACCOUNT_ID,
      dryRun:    true,
      // intelKeywords intentionally omitted
    });
    expect(result.saturatedDropped).toBe(0);
  });
});
