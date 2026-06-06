import { getAgentAlertMinIntervalMs, shouldHoldForCadence } from "../communication";

describe("getAgentAlertMinIntervalMs", () => {
  afterEach(() => {
    delete process.env.AGENT_ALERT_MIN_INTERVAL_MINUTES_CTO;
  });

  it("defaults executives to 12h", () => {
    expect(getAgentAlertMinIntervalMs("cto")).toBe(720 * 60 * 1000);
    expect(getAgentAlertMinIntervalMs("ceo")).toBe(720 * 60 * 1000);
    expect(getAgentAlertMinIntervalMs("cmo")).toBe(720 * 60 * 1000);
  });

  it("keeps the COO (dispatch guardian) at 60m", () => {
    expect(getAgentAlertMinIntervalMs("coo")).toBe(60 * 60 * 1000);
  });

  it("honours per-agent env overrides", () => {
    process.env.AGENT_ALERT_MIN_INTERVAL_MINUTES_CTO = "30";
    expect(getAgentAlertMinIntervalMs("cto")).toBe(30 * 60 * 1000);
  });
});

describe("shouldHoldForCadence", () => {
  const NOW = new Date("2026-06-07T12:00:00Z");

  it("allows when the agent has never paged", () => {
    expect(shouldHoldForCadence(null, NOW, 720 * 60_000)).toBe(false);
  });

  it("holds inside the window (LLM rewording is irrelevant)", () => {
    const oneHourAgo = new Date(NOW.getTime() - 60 * 60_000);
    expect(shouldHoldForCadence(oneHourAgo, NOW, 720 * 60_000)).toBe(true);
  });

  it("allows once the window has passed", () => {
    const thirteenHoursAgo = new Date(NOW.getTime() - 13 * 60 * 60_000);
    expect(shouldHoldForCadence(thirteenHoursAgo, NOW, 720 * 60_000)).toBe(false);
  });

  it("interval of 0 disables the cadence", () => {
    const oneMinuteAgo = new Date(NOW.getTime() - 60_000);
    expect(shouldHoldForCadence(oneMinuteAgo, NOW, 0)).toBe(false);
  });
});
