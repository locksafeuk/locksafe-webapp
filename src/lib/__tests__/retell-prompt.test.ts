import { buildRetellPrompt } from "@/lib/retell-prompt";

describe("retell prompt builder", () => {
  it("includes new scenario modules by default", () => {
    const prompt = buildRetellPrompt();

    expect(prompt).toContain("## EMERGENCY_ROUTING");
    expect(prompt).toContain("## APPOINTMENT_ROUTING");
    expect(prompt).toContain("## OBJECTION_HANDLING");
    expect(prompt).toContain("## INTERRUPTION_RECOVERY");
  });

  it("respects includeScenarios filter", () => {
    const prompt = buildRetellPrompt({
      includeScenarios: ["emergency", "interruption"],
      maxClarificationLoops: 1,
    });

    expect(prompt).toContain("## EMERGENCY_ROUTING");
    expect(prompt).toContain("## INTERRUPTION_RECOVERY");
    expect(prompt).not.toContain("## APPOINTMENT_ROUTING");
    expect(prompt).not.toContain("## OBJECTION_HANDLING");
    expect(prompt).toContain("Do not exceed 1 clarification attempts");
  });
});
