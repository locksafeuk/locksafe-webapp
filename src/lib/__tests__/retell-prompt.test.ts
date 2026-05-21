import { buildRetellPrompt } from "@/lib/retell-prompt";
import { SUPPORT_PHONE } from "@/lib/config";

describe("retell prompt builder", () => {
  it("includes the seven canonical sections in order", () => {
    const prompt = buildRetellPrompt();

    const expected = [
      "## IDENTITY",
      "## CALL_FLOW",
      "## TOOLS",
      "## TOOL_FAILURES",
      "## BRANCHES",
      "## ESCALATION",
      "## HARD_RULES",
    ];

    let cursor = 0;
    for (const heading of expected) {
      const idx = prompt.indexOf(heading, cursor);
      expect(idx).toBeGreaterThanOrEqual(0);
      cursor = idx + heading.length;
    }
  });

  it("uses British English and the escalation number", () => {
    const prompt = buildRetellPrompt();
    expect(prompt).toContain("Speak natural British English");
    expect(prompt).toContain(SUPPORT_PHONE);
  });

  it("defines the 7-stage call flow", () => {
    const prompt = buildRetellPrompt();
    for (const stage of [
      "STAGE 1 — GREETING",
      "STAGE 2 — TRIAGE",
      "STAGE 3 — INTAKE",
      "STAGE 4 — CUSTOMER LOOKUP",
      "STAGE 5 — JOB CREATION",
      "STAGE 6 — CONFIRMATION",
      "STAGE 7 — CLOSURE OR HANDOFF",
    ]) {
      expect(prompt).toContain(stage);
    }
  });

  it("documents tool contracts inline", () => {
    const prompt = buildRetellPrompt();
    expect(prompt).toContain("check-user(");
    expect(prompt).toContain("create-job(");
    expect(prompt).toContain("missing_fields");
    expect(prompt).toContain("sms_sent");
  });

  it("covers the required decision branches", () => {
    const prompt = buildRetellPrompt();
    for (const branch of [
      "EMERGENCY LOCKOUT",
      "APPOINTMENT / PLANNED SERVICE",
      "PRICE INQUIRY",
      "COMPLAINT / ANGER",
      "LEGAL / INSURANCE / FRAUD MENTION",
      "SMS FAILURE FALLBACK",
    ]) {
      expect(prompt).toContain(branch);
    }
  });

  it("does not duplicate the V25-V31 regression rules", () => {
    const prompt = buildRetellPrompt();
    const callbackMentions = prompt.match(/callback number/gi) ?? [];
    expect(callbackMentions.length).toBeLessThan(8);
    const loopMentions = prompt.match(/loop/gi) ?? [];
    expect(loopMentions.length).toBeLessThan(3);
  });

  it("respects custom persona context", () => {
    const prompt = buildRetellPrompt({
      personaName: "Alex",
      businessName: "TestCo",
      humanEscalationNumber: "01234 567890",
      realismMode: "efficient",
      maxClarificationLoops: 1,
    });

    expect(prompt).toContain("You are Alex, the AI receptionist for TestCo");
    expect(prompt).toContain("01234 567890");
    expect(prompt).toContain("Keep it brisk");
    expect(prompt).toContain("after 1 clarification attempts");
  });
});
