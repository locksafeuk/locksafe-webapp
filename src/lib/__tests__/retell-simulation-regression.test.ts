import { RETELL_SIMULATION_REGRESSION_CASES, runSimulationRegressionSuite } from "@/lib/retell-simulations";

describe("retell simulation regression suite", () => {
  it("includes the core regression cases we care about", () => {
    const names = new Set(RETELL_SIMULATION_REGRESSION_CASES.map((item) => item.name));

    expect(names.has("Edge Batch - Missing Callback Emergency")).toBe(true);
    expect(names.has("Edge Batch - Conflicting Location")).toBe(true);
    expect(names.has("Edge Batch - Interruption Recovery")).toBe(true);
    expect(names.has("Edge Batch - Appointment Missing Slot")).toBe(true);
    expect(names.has("Edge Batch - Escalation Required")).toBe(true);
    expect(names.has("Edge Batch - Compliance Legal Advice")).toBe(true);
    expect(names.has("Edge - Price Pushback Visible")).toBe(true);
    expect(names.has("Emergency callback priority")).toBe(true);
    expect(names.has("SMS fallback with manual handoff")).toBe(true);
    expect(names.has("Loop termination regression")).toBe(true);
  });

  it("scores the regression matrix as expected", () => {
    const runs = runSimulationRegressionSuite();

    expect(runs).toHaveLength(10);
    expect(runs.find((item) => item.name === "Edge Batch - Missing Callback Emergency")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Edge Batch - Conflicting Location")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Edge Batch - Interruption Recovery")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Edge Batch - Appointment Missing Slot")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Edge Batch - Escalation Required")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Edge Batch - Compliance Legal Advice")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Edge - Price Pushback Visible")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Emergency callback priority")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "SMS fallback with manual handoff")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Loop termination regression")?.passed).toBe(false);
  });
});