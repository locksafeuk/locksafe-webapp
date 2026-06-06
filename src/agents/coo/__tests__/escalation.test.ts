import { planCooEscalations } from "../escalation";

const base = { stuckJobCount: 0, unassignedEmergencyCount: 0, sweptCount: 0, sweepNotified: 0, availableLocksmiths: 10 };

describe("planCooEscalations", () => {
  it("does nothing when operations are healthy", () => {
    expect(planCooEscalations(base)).toHaveLength(0);
  });

  it("escalates a stalled dispatch pipeline to CTO", () => {
    const out = planCooEscalations({ ...base, stuckJobCount: 4 });
    expect(out.map((e) => e.toAgent)).toContain("cto");
  });

  it("escalates an unassigned emergency to CTO at high priority", () => {
    const out = planCooEscalations({ ...base, unassignedEmergencyCount: 1 });
    const cto = out.find((e) => e.toAgent === "cto");
    expect(cto?.priority).toBe(9);
  });

  it("escalates a coverage shortage with unmet demand to CMO", () => {
    const out = planCooEscalations({ ...base, stuckJobCount: 1, availableLocksmiths: 2 });
    expect(out.map((e) => e.toAgent)).toContain("cmo");
  });

  it("does not ask CMO to recruit when coverage is fine", () => {
    const out = planCooEscalations({ ...base, stuckJobCount: 5, availableLocksmiths: 9 });
    expect(out.map((e) => e.toAgent)).not.toContain("cmo");
  });
});
