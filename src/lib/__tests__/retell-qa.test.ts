import {
  computeCompositeQaScore,
  normalizeQaReviewInput,
  prioritizeQaQueue,
  type QaQueueCall,
} from "@/lib/retell-qa";

const baseCall: QaQueueCall = {
  id: "call_default",
  startedAt: new Date("2026-05-01T10:00:00.000Z"),
  durationSeconds: 60,
  outcome: "info_provided",
  wasEscalated: false,
  flaggedForReview: false,
  isTestCall: false,
  callStatus: "completed",
  reviewCount: 1,
};

describe("normalizeQaReviewInput", () => {
  it("rejects payloads without a callId", () => {
    const result = normalizeQaReviewInput({ callId: "", naturalnessScore: 4 } as any);
    expect(result.ok).toBe(false);
    if ("errors" in result) {
      expect(result.errors).toContain("callId_required");
    }
  });

  it("rejects payloads with no scores", () => {
    const result = normalizeQaReviewInput({ callId: "call_1" });
    expect(result.ok).toBe(false);
    if ("errors" in result) {
      expect(result.errors).toContain("at_least_one_score_required");
    }
  });

  it("clamps invalid score values to null and keeps valid ones", () => {
    const result = normalizeQaReviewInput({
      callId: "call_1",
      naturalnessScore: 4,
      accuracyScore: 6,
      empathyScore: -1,
      complianceScore: "5",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.naturalnessScore).toBe(4);
      expect(result.review.accuracyScore).toBeNull();
      expect(result.review.empathyScore).toBeNull();
      expect(result.review.complianceScore).toBeNull();
    }
  });

  it("filters labels to non-empty strings", () => {
    const result = normalizeQaReviewInput({
      callId: "call_1",
      naturalnessScore: 4,
      labels: ["natural", 7, "", "complete"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.labels).toEqual(["natural", "complete"]);
    }
  });
});

describe("computeCompositeQaScore", () => {
  it("returns null when no scores are present", () => {
    expect(
      computeCompositeQaScore({
        naturalnessScore: null,
        accuracyScore: null,
        empathyScore: null,
        complianceScore: null,
      })
    ).toBeNull();
  });

  it("produces a weighted average across populated scores", () => {
    const score = computeCompositeQaScore({
      naturalnessScore: 5,
      accuracyScore: 5,
      empathyScore: null,
      complianceScore: null,
    });
    expect(score).toBe(5);
  });

  it("weights naturalness and accuracy higher than empathy/compliance", () => {
    const score = computeCompositeQaScore({
      naturalnessScore: 5,
      accuracyScore: 5,
      empathyScore: 1,
      complianceScore: 1,
    });
    // Higher than a flat average of 3 because of weighting
    expect(score).toBeGreaterThan(3);
  });
});

describe("prioritizeQaQueue", () => {
  it("filters out test calls", () => {
    const queue = prioritizeQaQueue([
      { ...baseCall, id: "call_test", isTestCall: true, flaggedForReview: true },
    ]);
    expect(queue).toEqual([]);
  });

  it("ranks flagged calls above unflagged with the same other signals", () => {
    const queue = prioritizeQaQueue([
      { ...baseCall, id: "call_a", flaggedForReview: false, reviewCount: 0 },
      { ...baseCall, id: "call_b", flaggedForReview: true, reviewCount: 0 },
    ]);
    expect(queue[0].id).toBe("call_b");
  });

  it("includes reasons for prioritization", () => {
    const queue = prioritizeQaQueue([
      {
        ...baseCall,
        id: "call_priority",
        wasEscalated: true,
        outcome: "abandoned",
        reviewCount: 0,
      },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].reasons).toEqual(
      expect.arrayContaining(["escalated", "abandoned", "never_reviewed"])
    );
  });

  it("excludes calls with no priority signals", () => {
    const queue = prioritizeQaQueue([
      { ...baseCall, id: "call_none", reviewCount: 2, durationSeconds: 60 },
    ]);
    expect(queue).toEqual([]);
  });
});
