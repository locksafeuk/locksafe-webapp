export type VoiceAlertSeverity = "info" | "warning" | "critical";

export type VoiceAlertCode =
  | "completion_rate_low"
  | "call_to_job_rate_low"
  | "escalation_spike"
  | "naturalness_regression"
  | "no_traffic";

export type VoiceAlert = {
  code: VoiceAlertCode;
  severity: VoiceAlertSeverity;
  message: string;
  metric?: number;
  threshold?: number;
};

export type VoiceObservabilityMetrics = {
  totalCalls: number;
  completionRate: number;
  callToJobRate: number;
  escalationRate: number;
  avgNaturalness: number;
  reviewCount: number;
};

export const VOICE_ALERT_THRESHOLDS = {
  completionRateWarn: 80,
  completionRateCritical: 70,
  callToJobRateWarn: 20,
  callToJobRateCritical: 12,
  escalationRateWarn: 18,
  escalationRateCritical: 28,
  naturalnessWarn: 3.7,
  naturalnessCritical: 3.2,
  minTrafficForQuality: 5,
} as const;

export function evaluateVoiceObservabilityAlerts(metrics: VoiceObservabilityMetrics): VoiceAlert[] {
  const alerts: VoiceAlert[] = [];

  if (metrics.totalCalls === 0) {
    alerts.push({
      code: "no_traffic",
      severity: "warning",
      message: "No voice calls recorded for this window.",
      metric: 0,
    });
    return alerts;
  }

  if (metrics.completionRate < VOICE_ALERT_THRESHOLDS.completionRateCritical) {
    alerts.push({
      code: "completion_rate_low",
      severity: "critical",
      message: `Completion rate critical: ${metrics.completionRate}%`,
      metric: metrics.completionRate,
      threshold: VOICE_ALERT_THRESHOLDS.completionRateCritical,
    });
  } else if (metrics.completionRate < VOICE_ALERT_THRESHOLDS.completionRateWarn) {
    alerts.push({
      code: "completion_rate_low",
      severity: "warning",
      message: `Completion rate low: ${metrics.completionRate}%`,
      metric: metrics.completionRate,
      threshold: VOICE_ALERT_THRESHOLDS.completionRateWarn,
    });
  }

  if (metrics.callToJobRate < VOICE_ALERT_THRESHOLDS.callToJobRateCritical) {
    alerts.push({
      code: "call_to_job_rate_low",
      severity: "critical",
      message: `Call-to-job rate critical: ${metrics.callToJobRate}%`,
      metric: metrics.callToJobRate,
      threshold: VOICE_ALERT_THRESHOLDS.callToJobRateCritical,
    });
  } else if (metrics.callToJobRate < VOICE_ALERT_THRESHOLDS.callToJobRateWarn) {
    alerts.push({
      code: "call_to_job_rate_low",
      severity: "warning",
      message: `Call-to-job rate low: ${metrics.callToJobRate}%`,
      metric: metrics.callToJobRate,
      threshold: VOICE_ALERT_THRESHOLDS.callToJobRateWarn,
    });
  }

  if (metrics.escalationRate > VOICE_ALERT_THRESHOLDS.escalationRateCritical) {
    alerts.push({
      code: "escalation_spike",
      severity: "critical",
      message: `Escalation spike critical: ${metrics.escalationRate}%`,
      metric: metrics.escalationRate,
      threshold: VOICE_ALERT_THRESHOLDS.escalationRateCritical,
    });
  } else if (metrics.escalationRate > VOICE_ALERT_THRESHOLDS.escalationRateWarn) {
    alerts.push({
      code: "escalation_spike",
      severity: "warning",
      message: `Escalation rate elevated: ${metrics.escalationRate}%`,
      metric: metrics.escalationRate,
      threshold: VOICE_ALERT_THRESHOLDS.escalationRateWarn,
    });
  }

  if (metrics.reviewCount > 0) {
    if (metrics.avgNaturalness < VOICE_ALERT_THRESHOLDS.naturalnessCritical) {
      alerts.push({
        code: "naturalness_regression",
        severity: "critical",
        message: `Naturalness regression critical: ${metrics.avgNaturalness}/5`,
        metric: metrics.avgNaturalness,
        threshold: VOICE_ALERT_THRESHOLDS.naturalnessCritical,
      });
    } else if (metrics.avgNaturalness < VOICE_ALERT_THRESHOLDS.naturalnessWarn) {
      alerts.push({
        code: "naturalness_regression",
        severity: "warning",
        message: `Naturalness regression: ${metrics.avgNaturalness}/5`,
        metric: metrics.avgNaturalness,
        threshold: VOICE_ALERT_THRESHOLDS.naturalnessWarn,
      });
    }
  }

  return alerts;
}

export function summarizeVoiceAlerts(alerts: VoiceAlert[]) {
  return {
    total: alerts.length,
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    warning: alerts.filter((alert) => alert.severity === "warning").length,
    info: alerts.filter((alert) => alert.severity === "info").length,
  };
}
