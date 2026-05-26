/**
 * Validator tests — pin the doorway-page + false-trust-claim defences.
 *
 * The whole anti-shark, honesty-first thesis depends on this validator
 * catching every banned phrase. If we ever weaken it, this suite
 * must scream.
 */

import {
  BANNED_PHRASES,
  scanForBannedPhrases,
  findMissingBlocks,
  validateLLMOutput,
  type RawContent,
} from "@/lib/district-landing/validate-content";

const VALID: RawContent = {
  heroHeadline:      "Locksmith in RG1, central Reading",
  heroSubcopy:       "LockSafe covers RG1 with a real local engineer based in Caversham.",
  introParagraph:    "RG1 covers central Reading from the Oracle to Caversham bridge. We work this district every week. Calls usually connect to a dispatcher in under a minute.",
  coverageNarrative: "LockSafe operates in RG1 from a workshop a few miles north of the centre. Three engineers cover the postcode rota. Typical response is around fifteen minutes.",
  whyChooseUs:       "We agree a fixed price before any work starts. No callout fee. Real local engineer dispatched, not a national call-centre running price-bait on Google.",
  faqs: [
    { question: "Can you reach RG1 at 11pm?", answer: "Yes. Our dispatch runs around the clock and an engineer covers the RG1 rota overnight." },
    { question: "How much for a lock change in RG1?", answer: "Standard uPVC cylinder swaps in RG1 start around £85 plus the cylinder. We quote a fixed price before any work starts." },
    { question: "Do you cover RG2 and RG30 as well?", answer: "Yes. Our nearest engineer works the RG1, RG2, RG4 and RG30 outcodes from the same workshop." },
    { question: "Are you insured?", answer: "Yes. Every LockSafe engineer carries public-liability insurance, AI-verified at onboarding." },
  ],
  localTrustAnchors: [
    "DBS-checked engineer",
    "Fixed price agreed up front",
    "Within 8 miles of every RG1 postcode",
  ],
};

describe("BANNED_PHRASES integrity", () => {
  it("bans every MLA variant", () => {
    expect(BANNED_PHRASES).toEqual(expect.arrayContaining([
      "mla", "mla-approved", "mla approved", "mla member", "mla licensed",
      "master locksmiths association", "master locksmith",
    ]));
  });

  it("bans every false-accreditation variant LockSafe doesn't hold", () => {
    expect(BANNED_PHRASES).toEqual(expect.arrayContaining([
      "which? trusted trader", "which trusted trader",
      "checkatrade", "trustmark", "trading standards approved",
    ]));
  });

  it("bans the classic template-tell phrases", () => {
    expect(BANNED_PHRASES).toEqual(expect.arrayContaining([
      "need a locksmith in", "look no further", "click here",
      "trusted by thousands", "wide range of services",
    ]));
  });
});

describe("scanForBannedPhrases", () => {
  it("returns empty when content is clean", () => {
    expect(scanForBannedPhrases(VALID)).toEqual([]);
  });

  it("flags an MLA mention in the hero", () => {
    const bad = { ...VALID, heroHeadline: "MLA-approved locksmith for RG1" };
    expect(scanForBannedPhrases(bad)).toEqual(expect.arrayContaining(["mla-approved", "mla"]));
  });

  it("flags 'master locksmith' (implies MLA)", () => {
    const bad = { ...VALID, coverageNarrative: VALID.coverageNarrative + " A master locksmith covers the rota." };
    expect(scanForBannedPhrases(bad)).toContain("master locksmith");
  });

  it("flags a template-tell anywhere — including inside an FAQ answer", () => {
    const bad = {
      ...VALID,
      faqs: [
        ...VALID.faqs.slice(0, -1),
        { question: "Why pick you?", answer: "Look no further — we are the best locksmith in Reading." },
      ],
    };
    const hits = scanForBannedPhrases(bad);
    expect(hits).toEqual(expect.arrayContaining(["look no further", "best locksmith in"]));
  });

  it("flags Checkatrade / Which? false claims", () => {
    const bad = { ...VALID, whyChooseUs: VALID.whyChooseUs + " We are a Checkatrade member." };
    expect(scanForBannedPhrases(bad)).toContain("checkatrade");
  });

  it("does NOT false-flag legitimate words that contain the banned substring", () => {
    // "checkatrade" inside a normal word shouldn't fire (we use word
    // boundaries). E.g. "We checked at the trade counter".
    const clean = {
      ...VALID,
      whyChooseUs: VALID.whyChooseUs + " We checked at the workshop this morning.",
    };
    expect(scanForBannedPhrases(clean).filter((h) => h === "checkatrade")).toEqual([]);
  });
});

describe("findMissingBlocks", () => {
  it("returns empty when every block is present", () => {
    expect(findMissingBlocks(VALID)).toEqual([]);
  });

  it("flags missing hero headline", () => {
    expect(findMissingBlocks({ ...VALID, heroHeadline: "" })).toContain("heroHeadline");
  });

  it("flags too-short hero subcopy", () => {
    expect(findMissingBlocks({ ...VALID, heroSubcopy: "Hi" })).toContain("heroSubcopy");
  });

  it("flags fewer than 3 FAQs", () => {
    expect(findMissingBlocks({ ...VALID, faqs: VALID.faqs.slice(0, 2) })).toContain("faqs");
  });

  it("flags fewer than 3 trust anchors", () => {
    expect(findMissingBlocks({ ...VALID, localTrustAnchors: ["one"] })).toContain("localTrustAnchors");
  });

  it("flags a malformed FAQ entry", () => {
    const bad = {
      ...VALID,
      faqs: [
        VALID.faqs[0],
        { question: "Hi", answer: "Yes" },  // both too short
        ...VALID.faqs.slice(2),
      ],
    };
    const missing = findMissingBlocks(bad);
    expect(missing.some((m) => m.startsWith("faqs["))).toBe(true);
  });
});

describe("validateLLMOutput — parse + validate end-to-end", () => {
  it("accepts clean valid JSON", () => {
    const out = validateLLMOutput(JSON.stringify(VALID));
    expect(out.ok).toBe(true);
    expect(out.parsed).toEqual(VALID);
    expect(out.bannedHits).toEqual([]);
    expect(out.missing).toEqual([]);
    expect(out.malformed).toBeUndefined();
  });

  it("rejects malformed JSON", () => {
    const out = validateLLMOutput("not json");
    expect(out.ok).toBe(false);
    expect(out.malformed).toBe(true);
    expect(out.parsed).toBeUndefined();
  });

  it("rejects array-wrapped JSON (must be a single object)", () => {
    const out = validateLLMOutput(JSON.stringify([VALID]));
    expect(out.ok).toBe(false);
    expect(out.malformed).toBe(true);
  });

  it("returns banned hits + does NOT include parsed when content is dirty", () => {
    const bad = { ...VALID, heroHeadline: "MLA-Approved Locksmith in RG1" };
    const out = validateLLMOutput(JSON.stringify(bad));
    expect(out.ok).toBe(false);
    expect(out.bannedHits.length).toBeGreaterThan(0);
    expect(out.parsed).toBeUndefined();
  });
});
