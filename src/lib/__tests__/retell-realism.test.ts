import {
  DEFAULT_REALISM_PROFILE,
  buildRealismExperimentMatrix,
  normalizeRealismProfile,
} from "@/lib/retell-realism";

describe("retell realism matrix", () => {
  it("falls back to defaults for missing or invalid fields", () => {
    const profile = normalizeRealismProfile({
      interruptionSensitivity: "extreme",
      pauseStyle: 42,
      pronunciationHints: ["LockSafe", 5, null],
    });

    expect(profile).toEqual({
      interruptionSensitivity: DEFAULT_REALISM_PROFILE.interruptionSensitivity,
      backchannelFrequency: DEFAULT_REALISM_PROFILE.backchannelFrequency,
      pauseStyle: DEFAULT_REALISM_PROFILE.pauseStyle,
      noiseHandling: DEFAULT_REALISM_PROFILE.noiseHandling,
      pronunciationHints: ["LockSafe"],
    });
  });

  it("preserves valid profile values", () => {
    const profile = normalizeRealismProfile({
      interruptionSensitivity: "high",
      backchannelFrequency: "low",
      pauseStyle: "empathetic",
      noiseHandling: "strict",
      pronunciationHints: ["postcode", "callback"],
    });

    expect(profile.interruptionSensitivity).toBe("high");
    expect(profile.backchannelFrequency).toBe("low");
    expect(profile.pauseStyle).toBe("empathetic");
    expect(profile.noiseHandling).toBe("strict");
    expect(profile.pronunciationHints).toEqual(["postcode", "callback"]);
  });

  it("builds the full 3x3x3x3 experiment matrix", () => {
    const matrix = buildRealismExperimentMatrix(DEFAULT_REALISM_PROFILE);

    expect(matrix).toHaveLength(3 * 3 * 3 * 3);
    const ids = new Set(matrix.map((variant) => variant.id));
    expect(ids.size).toBe(matrix.length);
  });

  it("places the baseline variant first with distance zero", () => {
    const matrix = buildRealismExperimentMatrix({
      interruptionSensitivity: "medium",
      backchannelFrequency: "medium",
      pauseStyle: "natural",
      noiseHandling: "adaptive",
    });

    expect(matrix[0]?.isBaseline).toBe(true);
    expect(matrix[0]?.distance).toBe(0);
    expect(matrix.filter((variant) => variant.isBaseline)).toHaveLength(1);
  });

  it("scores distance by number of dimension changes", () => {
    const matrix = buildRealismExperimentMatrix({
      interruptionSensitivity: "low",
      backchannelFrequency: "low",
      pauseStyle: "concise",
      noiseHandling: "strict",
    });

    const oneStep = matrix.find(
      (variant) =>
        variant.interruptionSensitivity === "medium" &&
        variant.backchannelFrequency === "low" &&
        variant.pauseStyle === "concise" &&
        variant.noiseHandling === "strict"
    );
    const allDifferent = matrix.find(
      (variant) =>
        variant.interruptionSensitivity === "high" &&
        variant.backchannelFrequency === "high" &&
        variant.pauseStyle === "empathetic" &&
        variant.noiseHandling === "lenient"
    );

    expect(oneStep?.distance).toBe(1);
    expect(allDifferent?.distance).toBe(4);
  });
});
