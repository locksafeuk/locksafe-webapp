import { RETELL_SIMULATION_REGRESSION_CASES, runSimulationRegressionSuite } from "@/lib/retell-simulations";

describe("retell simulation regression suite", () => {
  it("includes the core regression cases we care about", () => {
    const names = new Set(RETELL_SIMULATION_REGRESSION_CASES.map((item) => item.name));

    expect(names.has("Emergency callback priority")).toBe(true);
    expect(names.has("SMS fallback with manual handoff")).toBe(true);
    expect(names.has("Loop termination regression")).toBe(true);
  });

  it("scores the regression matrix as expected", () => {
    const runs = runSimulationRegressionSuite();

    expect(runs).toHaveLength(3);
    expect(runs.find((item) => item.name === "Emergency callback priority")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "SMS fallback with manual handoff")?.passed).toBe(true);
    expect(runs.find((item) => item.name === "Loop termination regression")?.passed).toBe(false);
  });
});