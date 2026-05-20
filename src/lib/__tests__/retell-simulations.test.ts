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

  it("requires phone and job reference sms linkage in emergency scenario", () => {
    const scenario = RETELL_SIMULATION_SCENARIOS.find((s) => s.key === "emergency_lockout");
    expect(scenario).toBeDefined();

    const result = scoreSimulationOutput({
      transcript: "",
      collectedFields: ["name", "postcode"],
      naturalnessScore: 4,
      escalated: false,
      scenario: scenario!,
    });

    expect(result.passed).toBe(false);
    expect(result.failureReason).toContain("phone");
    expect(result.failureReason).toContain("job_reference");
    expect(result.failureReason).toContain("sms_link_sent");
  });

  it("rejects transcript language that claims lockout help is out of scope", () => {
    const scenario = RETELL_SIMULATION_SCENARIOS.find((s) => s.key === "emergency_lockout");
    expect(scenario).toBeDefined();

    const result = scoreSimulationOutput({
      transcript: "We do not handle online account lockouts, so I cannot help further.",
      collectedFields: ["name", "postcode", "phone", "email", "job_reference", "sms_link_sent"],
      naturalnessScore: 4,
      escalated: false,
      scenario: scenario!,
    });

    expect(result.passed).toBe(false);
    expect(result.failureReason).toContain("transcript policy violation");
  });

  it("rejects transcript language that ends early due to a suspected loop", () => {
    const scenario = RETELL_SIMULATION_SCENARIOS.find((s) => s.key === "emergency_lockout");
    expect(scenario).toBeDefined();

    const result = scoreSimulationOutput({
      transcript: "Ending the conversation early as there might be a loop.",
      collectedFields: ["name", "postcode", "phone", "email", "job_reference", "sms_link_sent"],
      naturalnessScore: 4,
      escalated: false,
      scenario: scenario!,
    });

    expect(result.passed).toBe(false);
    expect(result.failureReason).toContain("transcript policy violation");
  });

  it("rejects transcript language that reframes lockout calls as online account recovery", () => {
    const scenario = RETELL_SIMULATION_SCENARIOS.find((s) => s.key === "emergency_lockout");
    expect(scenario).toBeDefined();

    const result = scoreSimulationOutput({
      transcript: "We do not handle online account recovery and do not collect emails for locksmith services.",
      collectedFields: ["name", "postcode", "phone", "email", "job_reference", "sms_link_sent"],
      naturalnessScore: 4,
      escalated: false,
      scenario: scenario!,
    });

    expect(result.passed).toBe(false);
    expect(result.failureReason).toContain("transcript policy violation");
  });
});
