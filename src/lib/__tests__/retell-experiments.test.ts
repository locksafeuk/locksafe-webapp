import { EXPERIMENT_GUARDRAILS, evaluateRolloutGuardrails } from "@/lib/retell-experiments";

describe("rollout guardrails", () => {
  it("passes for a valid configuration", () => {
    const issues = evaluateRolloutGuardrails({
      controlVersionId: "ver_a",
      challengerVersionId: "ver_b",
      trafficSplit: 50,
      stopLossThreshold: 15,
    });

    expect(issues).toHaveLength(0);
  });

  it("flags missing versions", () => {
    const issues = evaluateRolloutGuardrails({
      controlVersionId: null,
      challengerVersionId: "ver_b",
      trafficSplit: 50,
      stopLossThreshold: 15,
    });

    expect(issues.map((issue) => issue.code)).toContain("missing_versions");
  });

  it("flags identical control and challenger", () => {
    const issues = evaluateRolloutGuardrails({
      controlVersionId: "ver_same",
      challengerVersionId: "ver_same",
      trafficSplit: 50,
      stopLossThreshold: 15,
    });

    expect(issues.map((issue) => issue.code)).toContain("same_version");
  });

  it("flags traffic split outside the allowed range", () => {
    const tooLow = evaluateRolloutGuardrails({
      controlVersionId: "ver_a",
      challengerVersionId: "ver_b",
      trafficSplit: EXPERIMENT_GUARDRAILS.minTrafficSplit - 1,
      stopLossThreshold: 15,
    });
    const tooHigh = evaluateRolloutGuardrails({
      controlVersionId: "ver_a",
      challengerVersionId: "ver_b",
      trafficSplit: EXPERIMENT_GUARDRAILS.maxTrafficSplit + 1,
      stopLossThreshold: 15,
    });

    expect(tooLow.map((issue) => issue.code)).toContain("traffic_split_out_of_range");
    expect(tooHigh.map((issue) => issue.code)).toContain("traffic_split_out_of_range");
  });

  it("flags stop-loss threshold outside the allowed range", () => {
    const issues = evaluateRolloutGuardrails({
      controlVersionId: "ver_a",
      challengerVersionId: "ver_b",
      trafficSplit: 50,
      stopLossThreshold: EXPERIMENT_GUARDRAILS.maxStopLossThreshold + 5,
    });

    expect(issues.map((issue) => issue.code)).toContain("stop_loss_out_of_range");
  });
});
