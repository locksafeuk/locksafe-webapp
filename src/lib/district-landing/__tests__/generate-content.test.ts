/**
 * Tests for the LLM-driven district content generator.
 *
 * We mock the LLM router so the suite is fully deterministic. The
 * critical assertions:
 *   • The prompt always bans MLA + Master Locksmiths phrases
 *   • The prompt embeds the engineer's base LOCATION, never their name
 *   • The prompt forbids inventing facts
 *   • Retry path appends fresh banned phrases on attempt 2
 *   • Two failures → ContentGenerationError (does NOT ship garbage)
 */

const chatMock = jest.fn();

jest.mock("@/lib/llm-router", () => ({
  __esModule: true,
  chat: (...args: unknown[]) => chatMock(...args),
  Models: {
    FAST: "FAST", AGENT: "AGENT", HERMES: "HERMES",
    REASONING: "REASONING", CONTENT: "CONTENT", QUALITY: "QUALITY",
  },
}));

import {
  buildPrompt,
  generateDistrictContent,
  ContentGenerationError,
} from "@/lib/district-landing/generate-content";
import type { DistrictFacts } from "@/lib/district-landing/assemble-facts";
import type { RawContent } from "@/lib/district-landing/validate-content";

const FACTS: DistrictFacts = {
  district:       "RG1",
  anchorTown:     "Reading",
  region:         "Berkshire",
  lat:            51.4570,
  lng:            -0.9710,
  nearbyOutcodes: ["RG2", "RG4", "RG30"],
  country:        "England",
  featuredEngineerBaseLocation: "Caversham",
  featuredEngineerRadiusMi:     12,
  featuredEngineerTravelMins:   "around 15 minutes",
  featuredEngineerYears:        7,
  totalEngineersCount: 3,
  trustSignals: {
    dbsChecked: true, insured: true, fixedPriceProcess: true,
    realLocalEngineer: true, twentyFourSeven: true, gpsTracked: true,
  },
};

const VALID_LLM_RESPONSE: RawContent = {
  heroHeadline:      "Locksmith in RG1, central Reading",
  heroSubcopy:       "LockSafe covers RG1 with a real local engineer based in Caversham.",
  introParagraph:    "RG1 covers central Reading from the Oracle to Caversham bridge. LockSafe works this district every week of the year. Calls usually connect within a minute.",
  coverageNarrative: "LockSafe operates in RG1 from a workshop a few miles north of the centre. Three engineers cover the postcode rota. Response runs around fifteen minutes on average.",
  whyChooseUs:       "We agree a fixed price before any work starts. No callout fee. Real local engineer dispatched, not a national call-centre running price-bait on Google.",
  faqs: [
    { question: "Can you reach RG1 at 11pm?", answer: "Yes. Dispatch runs around the clock and an engineer covers the RG1 rota overnight." },
    { question: "How much for a lock change in RG1?", answer: "Standard uPVC cylinder swaps in RG1 start around £85 plus the cylinder. We quote a fixed price before any work starts." },
    { question: "Do you cover RG2 and RG30 as well?", answer: "Yes. The nearest engineer works RG1, RG2, RG4 and RG30 from the same workshop." },
    { question: "Are you insured?", answer: "Yes. Every LockSafe engineer carries public-liability insurance, AI-verified at onboarding." },
  ],
  localTrustAnchors: [
    "DBS-checked engineer",
    "Fixed price agreed up front",
    "Within 8 miles of every RG1 postcode",
  ],
};

beforeEach(() => {
  chatMock.mockReset();
});

// ── Prompt builder ─────────────────────────────────────────────────────────

describe("buildPrompt", () => {
  it("bans MLA, Master Locksmiths, Which? Trusted Trader, Checkatrade", () => {
    const { system } = buildPrompt(FACTS);
    expect(system).toMatch(/MLA/);
    expect(system).toMatch(/Master Locksmiths Association/);
    expect(system).toMatch(/Which\? Trusted Trader/);
    expect(system).toMatch(/Checkatrade/);
  });

  it("instructs the LLM to never name the engineer", () => {
    const { system } = buildPrompt(FACTS);
    expect(system).toMatch(/never name an individual engineer/i);
  });

  it("includes the engineer's BASE LOCATION (Caversham) — but never a name", () => {
    const { user } = buildPrompt(FACTS);
    expect(user).toContain("Caversham");
    // The fixture's facts has no name field — but if a name accidentally
    // leaked in, the prompt would forward it. The system prompt says don't
    // name; the facts block carries location only.
    expect(user).toMatch(/Engineer's base location/);
  });

  it("lists the verified-claimable trust signals", () => {
    const { user } = buildPrompt(FACTS);
    expect(user).toMatch(/DBS-checked engineers/);
    expect(user).toMatch(/Insured \(public liability\)/);
    expect(user).toMatch(/Fixed price agreed before any work starts/);
    expect(user).toMatch(/24\/7/);
  });

  it("ALWAYS includes the 'GROUNDING RULES — STRICT' block", () => {
    const { system } = buildPrompt(FACTS);
    expect(system).toMatch(/GROUNDING RULES — STRICT/);
    expect(system).toMatch(/NEVER invent/);
  });

  it("appends extra banned phrases on retry", () => {
    const { system } = buildPrompt(FACTS, ["look no further", "MLA"]);
    expect(system).toMatch(/look no further/);
    expect(system).toMatch(/DO NOT USE — they appeared in a prior attempt/);
  });

  it("omits sections when corresponding facts are absent", () => {
    const sparseFacts: DistrictFacts = {
      ...FACTS,
      featuredEngineerYears: null,
      nearbyOutcodes: [],
    };
    const { user } = buildPrompt(sparseFacts);
    expect(user).not.toContain("years of experience");
    expect(user).not.toContain("Nearby outcodes");
  });
});

// ── Generation flow ────────────────────────────────────────────────────────

describe("generateDistrictContent — happy path", () => {
  it("returns the parsed content + records the model used (single attempt)", async () => {
    chatMock.mockResolvedValueOnce({
      content:       JSON.stringify(VALID_LLM_RESPONSE),
      model:         "qwen3:32b",
      usedFallback:  false,
      durationMs:    1234,
    });

    const result = await generateDistrictContent(FACTS);

    expect(result.content.heroHeadline).toBe("Locksmith in RG1, central Reading");
    expect(result.attempts).toBe(1);
    expect(result.modelUsed).toBe("ollama:qwen3:32b");
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it("marks usedFallback responses correctly", async () => {
    chatMock.mockResolvedValueOnce({
      content:      JSON.stringify(VALID_LLM_RESPONSE),
      model:        "gpt-4o-mini",
      usedFallback: true,
      durationMs:   2345,
    });
    const result = await generateDistrictContent(FACTS);
    expect(result.modelUsed).toBe("openai:gpt-4o-mini");
  });

  it("retries once when first attempt has banned phrases — succeeds on second", async () => {
    const dirty = { ...VALID_LLM_RESPONSE, heroHeadline: "MLA-approved locksmith RG1" };
    chatMock
      .mockResolvedValueOnce({
        content: JSON.stringify(dirty),
        model: "qwen3:32b", usedFallback: false, durationMs: 1000,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(VALID_LLM_RESPONSE),
        model: "qwen3:32b", usedFallback: false, durationMs: 1100,
      });

    const result = await generateDistrictContent(FACTS);

    expect(chatMock).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.content.heroHeadline).toBe("Locksmith in RG1, central Reading");
    // Second prompt should explicitly include the offending phrases
    const secondCallSystemPrompt = chatMock.mock.calls[1][1][0].content;
    expect(secondCallSystemPrompt).toMatch(/DO NOT USE — they appeared in a prior attempt/);
  });
});

describe("generateDistrictContent — failure modes", () => {
  it("throws ContentGenerationError when both attempts have banned phrases", async () => {
    const dirty = JSON.stringify({ ...VALID_LLM_RESPONSE, heroHeadline: "MLA-approved locksmith" });
    chatMock.mockResolvedValue({
      content: dirty, model: "qwen3:32b", usedFallback: false, durationMs: 500,
    });

    await expect(generateDistrictContent(FACTS)).rejects.toThrow(ContentGenerationError);
    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  it("throws when both attempts return malformed JSON", async () => {
    chatMock.mockResolvedValue({
      content: "not json at all", model: "qwen3:32b", usedFallback: false, durationMs: 500,
    });
    await expect(generateDistrictContent(FACTS)).rejects.toThrow(ContentGenerationError);
  });

  it("attaches the validation log to the error for debugging", async () => {
    chatMock.mockResolvedValue({
      content: JSON.stringify({ ...VALID_LLM_RESPONSE, heroHeadline: "MLA Locksmith" }),
      model: "qwen3:32b", usedFallback: false, durationMs: 500,
    });
    try {
      await generateDistrictContent(FACTS);
      fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ContentGenerationError);
      const ce = err as ContentGenerationError;
      expect(ce.attempts.length).toBe(2);
      expect(ce.attempts[0].bannedHits.length).toBeGreaterThan(0);
    }
  });
});
