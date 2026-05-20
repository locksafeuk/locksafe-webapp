import { buildRetellPrompt } from "@/lib/retell-prompt";

describe("retell prompt builder", () => {
  it("includes new scenario modules by default", () => {
    const prompt = buildRetellPrompt();

    expect(prompt).toContain("## EMERGENCY_ROUTING");
    expect(prompt).toContain("## APPOINTMENT_ROUTING");
    expect(prompt).toContain("## OBJECTION_HANDLING");
    expect(prompt).toContain("## INTERRUPTION_RECOVERY");
    expect(prompt).toContain("## JOB_REFERENCE_AND_SMS_UPDATES");
    expect(prompt).toContain("Callback number is the priority contact field");
    expect(prompt).toContain("repeat it back explicitly before proceeding");
    expect(prompt).toContain("new job reference");
    expect(prompt).toContain("SMS link");
    expect(prompt).toContain("a locksmith can be assigned");
    expect(prompt).toContain("keep the caller on the line");
    expect(prompt).toContain("Do not claim SMS was sent unless tool output confirms success");
    expect(prompt).toContain("Do not ask the same field more than twice in a row");
    expect(prompt).toContain("Lockout help is core to the service");
    expect(prompt).toContain("Never end the call just because you suspect a loop");
    expect(prompt).toContain("online account recovery");
    expect(prompt).toContain("Email is a useful follow-up");
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
