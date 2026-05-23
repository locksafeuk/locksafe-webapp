export type CutoverCheckStatus = "pass" | "warn" | "fail";

export type CutoverCheck = {
  id: string;
  label: string;
  status: CutoverCheckStatus;
  details: string;
};

export type RetellCutoverInput = {
  env: {
    hasRetellApiKey: boolean;
    hasRetellAgentId: boolean;
    hasRetellWebhookSecret: boolean;
    smsProvider: "twilio" | "zadarma";
    hasTwilioConfigured: boolean;
    hasZadarmaConfigured: boolean;
    hasSiteUrl: boolean;
  };
  activeConfig: {
    exists: boolean;
    isPaused: boolean;
    speakingRate: number | null;
    hasRetellAgentId: boolean;
    hasRealismProfile: boolean;
  };
  deployedVersion: {
    exists: boolean;
    publishStatus: string | null;
    hasRetellVersionId: boolean;
  };
  last24h: {
    totalCalls: number;
    callToJobRate: number;
    escalationRate: number;
    alertCount: number;
  };
};

function summarizeStatus(checks: CutoverCheck[]) {
  if (checks.some((check) => check.status === "fail")) return "fail" as const;
  if (checks.some((check) => check.status === "warn")) return "warn" as const;
  return "pass" as const;
}

export function evaluateRetellCutoverReadiness(input: RetellCutoverInput) {
  const checks: CutoverCheck[] = [];

  const missingEnv: string[] = [];
  if (!input.env.hasRetellApiKey) missingEnv.push("RETELL_API_KEY");
  if (!input.env.hasRetellAgentId) missingEnv.push("RETELL_AGENT_ID");
  if (!input.env.hasRetellWebhookSecret) missingEnv.push("RETELL_WEBHOOK_SECRET");
  if (input.env.smsProvider === "twilio" && !input.env.hasTwilioConfigured) {
    missingEnv.push(
      "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + one sender (TWILIO_MESSAGING_SERVICE_SID or TWILIO_ALPHANUMERIC_SENDER_ID or TWILIO_SMS_PHONE_NUMBER/TWILIO_PHONE_NUMBER)",
    );
  }
  if (input.env.smsProvider === "zadarma" && !input.env.hasZadarmaConfigured) {
    missingEnv.push("ZADARMA_USER_KEY + ZADARMA_API_SECRET");
  }
  if (!input.env.hasSiteUrl) missingEnv.push("NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_BASE_URL");

  checks.push({
    id: "env",
    label: "Core environment",
    status: missingEnv.length === 0 ? "pass" : "fail",
    details:
      missingEnv.length === 0
        ? `Retell, ${input.env.smsProvider} SMS, and site URL env vars are present.`
        : `Missing required env vars: ${missingEnv.join(", ")}`,
  });

  checks.push({
    id: "active_config",
    label: "Active voice config",
    status: !input.activeConfig.exists
      ? "fail"
      : input.activeConfig.isPaused
        ? "fail"
        : "pass",
    details: !input.activeConfig.exists
      ? "No active voice config found."
      : input.activeConfig.isPaused
        ? "Voice config is paused."
        : "Active voice config is available and not paused.",
  });

  const speakingRate = input.activeConfig.speakingRate;
  const inSafeRate = typeof speakingRate === "number" && speakingRate >= 0.85 && speakingRate <= 1.1;
  checks.push({
    id: "cadence",
    label: "Cadence bounds",
    status: inSafeRate ? "pass" : "warn",
    details: inSafeRate
      ? `speakingRate ${speakingRate?.toFixed(2)} is in safe range.`
      : `speakingRate ${speakingRate ?? "N/A"} is outside 0.85-1.10 safe range.`,
  });

  checks.push({
    id: "deployed_version",
    label: "Published deployed version",
    status:
      input.deployedVersion.exists &&
      input.deployedVersion.publishStatus === "published" &&
      input.deployedVersion.hasRetellVersionId
        ? "pass"
        : "fail",
    details:
      input.deployedVersion.exists &&
      input.deployedVersion.publishStatus === "published" &&
      input.deployedVersion.hasRetellVersionId
        ? "Latest deployed version is published to Retell."
        : "No deployed+published Retell version is active.",
  });

  checks.push({
    id: "realism_profile",
    label: "Realism profile",
    status: input.activeConfig.hasRealismProfile ? "pass" : "warn",
    details: input.activeConfig.hasRealismProfile
      ? "Realism profile is configured."
      : "Realism profile missing; defaults will apply.",
  });

  const lowTraffic = input.last24h.totalCalls < 3;
  checks.push({
    id: "traffic_signal",
    label: "Recent traffic signal",
    status: lowTraffic ? "warn" : "pass",
    details: lowTraffic
      ? `Only ${input.last24h.totalCalls} non-test calls in last 24h.`
      : `${input.last24h.totalCalls} non-test calls in last 24h.`,
  });

  checks.push({
    id: "conversion",
    label: "Call-to-job baseline",
    status:
      input.last24h.totalCalls === 0
        ? "warn"
        : input.last24h.callToJobRate < 10
          ? "warn"
          : "pass",
    details:
      input.last24h.totalCalls === 0
        ? "No baseline traffic yet for conversion signal."
        : `callToJobRate is ${input.last24h.callToJobRate.toFixed(1)}%.`,
  });

  checks.push({
    id: "escalation",
    label: "Escalation health",
    status:
      input.last24h.totalCalls === 0
        ? "warn"
        : input.last24h.escalationRate > 35
          ? "fail"
          : input.last24h.escalationRate > 25
            ? "warn"
            : "pass",
    details:
      input.last24h.totalCalls === 0
        ? "No baseline traffic yet for escalation signal."
        : `escalationRate is ${input.last24h.escalationRate.toFixed(1)}%.`,
  });

  checks.push({
    id: "alerts",
    label: "Daily scorecard alerts",
    status: input.last24h.alertCount > 0 ? "warn" : "pass",
    details:
      input.last24h.alertCount > 0
        ? `${input.last24h.alertCount} active scorecard alerts.`
        : "No scorecard alerts in current day snapshot.",
  });

  const overall = summarizeStatus(checks);
  return {
    readyForSwitch: overall !== "fail",
    overall,
    checks,
  };
}
