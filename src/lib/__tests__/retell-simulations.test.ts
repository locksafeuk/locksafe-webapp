import { RETELL_SIMULATION_SCENARIOS, scoreSimulationOutput } from "@/lib/retell-simulations";

describe("retell simulation scenarios", () => {
  it("includes appointment booking and price objection scenarios", () => {
    const keys = new Set(RETELL_SIMULATION_SCENARIOS.map((s) => s.key));

    expect(keys.has("appointment_booking")).toBe(true);
    expect(keys.has("price_objection")).toBe(true);
  });

  it("fails when required fields are missing", () => {
    const scenario = RETELL_SIMULATION_SCENARIOS.find((s) => s.key === "appointment_booking");
    expect(scenario).toBeDefined();

    const result = scoreSimulationOutput({
      transcript: "",
      collectedFields: ["name", "postcode"],
      naturalnessScore: 4,
      escalated: false,
      scenario: scenario!,
    });

    expect(result.passed).toBe(false);
    expect(result.failureReason).toContain("missing fields");
  });

  it("requires email and job reference sms linkage in emergency scenario", () => {
    const scenario = RETELL_SIMULATION_SCENARIOS.find((s) => s.key === "emergency_lockout");
    expect(scenario).toBeDefined();

    const result = scoreSimulationOutput({
      transcript: "",
      collectedFields: ["name", "postcode", "phone"],
      naturalnessScore: 4,
      escalated: false,
      scenario: scenario!,
    });

    expect(result.passed).toBe(false);
    expect(result.failureReason).toContain("email");
    expect(result.failureReason).toContain("job_reference");
    expect(result.failureReason).toContain("sms_link_sent");
  });
});
