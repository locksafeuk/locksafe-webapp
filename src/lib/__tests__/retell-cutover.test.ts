import { evaluateRetellCutoverReadiness } from "@/lib/retell-cutover";

const BASE_INPUT = {
  env: {
    hasRetellApiKey: true,
    hasRetellAgentId: true,
    hasRetellWebhookSecret: true,
    smsProvider: "zadarma" as const,
    hasTwilioConfigured: true,
    hasZadarmaConfigured: true,
    hasSiteUrl: true,
  },
  activeConfig: {
    exists: true,
    isPaused: false,
    speakingRate: 0.96,
    hasRetellAgentId: true,
    hasRealismProfile: true,
  },
  deployedVersion: {
    exists: true,
    publishStatus: "published",
    hasRetellVersionId: true,
  },
  last24h: {
    totalCalls: 12,
    callToJobRate: 33.3,
    escalationRate: 8.3,
    alertCount: 0,
  },
};

describe("evaluateRetellCutoverReadiness", () => {
  it("returns pass when all gates are healthy", () => {
    const result = evaluateRetellCutoverReadiness(BASE_INPUT);

    expect(result.readyForSwitch).toBe(true);
    expect(result.overall).toBe("pass");
    expect(result.checks.find((check) => check.id === "env")?.status).toBe("pass");
  });

  it("fails when critical env vars are missing", () => {
    const result = evaluateRetellCutoverReadiness({
      ...BASE_INPUT,
      env: { ...BASE_INPUT.env, hasZadarmaConfigured: false },
    });

    expect(result.readyForSwitch).toBe(false);
    expect(result.overall).toBe("fail");
    expect(result.checks.find((check) => check.id === "env")?.status).toBe("fail");
  });

  it("fails when active config is paused", () => {
    const result = evaluateRetellCutoverReadiness({
      ...BASE_INPUT,
      activeConfig: { ...BASE_INPUT.activeConfig, isPaused: true },
    });

    expect(result.readyForSwitch).toBe(false);
    expect(result.checks.find((check) => check.id === "active_config")?.status).toBe("fail");
  });

  it("warns when speaking rate is outside safe bounds", () => {
    const result = evaluateRetellCutoverReadiness({
      ...BASE_INPUT,
      activeConfig: { ...BASE_INPUT.activeConfig, speakingRate: 1.3 },
    });

    expect(result.readyForSwitch).toBe(true);
    expect(result.overall).toBe("warn");
    expect(result.checks.find((check) => check.id === "cadence")?.status).toBe("warn");
  });

  it("fails when escalation rate is critically high", () => {
    const result = evaluateRetellCutoverReadiness({
      ...BASE_INPUT,
      last24h: {
        ...BASE_INPUT.last24h,
        totalCalls: 20,
        escalationRate: 45,
      },
    });

    expect(result.readyForSwitch).toBe(false);
    expect(result.checks.find((check) => check.id === "escalation")?.status).toBe("fail");
  });
});
