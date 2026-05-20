import {
  VOICE_ALERT_THRESHOLDS,
  evaluateVoiceObservabilityAlerts,
  summarizeVoiceAlerts,
} from "@/lib/retell-observability";

const HEALTHY = {
  totalCalls: 50,
  completionRate: 92,
  callToJobRate: 35,
  escalationRate: 8,
  avgNaturalness: 4.3,
  reviewCount: 12,
};

describe("voice observability alerts", () => {
  it("returns no alerts for healthy metrics", () => {
    expect(evaluateVoiceObservabilityAlerts(HEALTHY)).toEqual([]);
  });

  it("emits a no_traffic alert when there are zero calls", () => {
    const alerts = evaluateVoiceObservabilityAlerts({
      ...HEALTHY,
      totalCalls: 0,
      completionRate: 0,
      callToJobRate: 0,
      escalationRate: 0,
      avgNaturalness: 0,
      reviewCount: 0,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].code).toBe("no_traffic");
  });

  it("flags warning vs critical thresholds for completion rate", () => {
    const warning = evaluateVoiceObservabilityAlerts({
      ...HEALTHY,
      completionRate: VOICE_ALERT_THRESHOLDS.completionRateWarn - 1,
    });
    const critical = evaluateVoiceObservabilityAlerts({
      ...HEALTHY,
      completionRate: VOICE_ALERT_THRESHOLDS.completionRateCritical - 5,
    });

    expect(warning.find((alert) => alert.code === "completion_rate_low")?.severity).toBe("warning");
    expect(critical.find((alert) => alert.code === "completion_rate_low")?.severity).toBe("critical");
  });

  it("flags escalation spikes by severity", () => {
    const elevated = evaluateVoiceObservabilityAlerts({
      ...HEALTHY,
      escalationRate: VOICE_ALERT_THRESHOLDS.escalationRateWarn + 1,
    });
    const critical = evaluateVoiceObservabilityAlerts({
      ...HEALTHY,
      escalationRate: VOICE_ALERT_THRESHOLDS.escalationRateCritical + 1,
    });

    expect(elevated.find((alert) => alert.code === "escalation_spike")?.severity).toBe("warning");
    expect(critical.find((alert) => alert.code === "escalation_spike")?.severity).toBe("critical");
  });

  it("only flags naturalness when there are reviews", () => {
    const noReviews = evaluateVoiceObservabilityAlerts({
      ...HEALTHY,
      avgNaturalness: 1.0,
      reviewCount: 0,
    });
    const withReviews = evaluateVoiceObservabilityAlerts({
      ...HEALTHY,
      avgNaturalness: VOICE_ALERT_THRESHOLDS.naturalnessCritical - 0.1,
      reviewCount: 8,
    });

    expect(noReviews.find((alert) => alert.code === "naturalness_regression")).toBeUndefined();
    expect(withReviews.find((alert) => alert.code === "naturalness_regression")?.severity).toBe(
      "critical"
    );
  });

  it("summarizes alerts by severity", () => {
    const alerts = evaluateVoiceObservabilityAlerts({
      ...HEALTHY,
      completionRate: VOICE_ALERT_THRESHOLDS.completionRateCritical - 5,
      escalationRate: VOICE_ALERT_THRESHOLDS.escalationRateWarn + 1,
    });

    const summary = summarizeVoiceAlerts(alerts);
    expect(summary.total).toBe(alerts.length);
    expect(summary.critical).toBeGreaterThanOrEqual(1);
    expect(summary.warning).toBeGreaterThanOrEqual(1);
  });
});
