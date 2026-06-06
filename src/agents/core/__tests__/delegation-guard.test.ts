import { delegationBlockReason } from "../delegation-guard";

describe("delegationBlockReason", () => {
  const base = { fromAgentId: "X", targetAgentId: "Y", reciprocalOpenCount: 0, duplicateOpenCount: 0 };

  it("allows a normal delegation", () => {
    expect(delegationBlockReason(base)).toBeNull();
  });

  it("blocks self-delegation", () => {
    expect(delegationBlockReason({ ...base, targetAgentId: "X" })).toBe("self-delegation");
  });

  it("blocks a reciprocal cycle (Y→X already open)", () => {
    expect(delegationBlockReason({ ...base, reciprocalOpenCount: 1 })).toBe("circular-delegation");
  });

  it("blocks a duplicate open delegation", () => {
    expect(delegationBlockReason({ ...base, duplicateOpenCount: 2 })).toBe("duplicate-delegation");
  });

  it("prioritises self-delegation over other reasons", () => {
    expect(delegationBlockReason({ fromAgentId: "X", targetAgentId: "X", reciprocalOpenCount: 5, duplicateOpenCount: 5 })).toBe("self-delegation");
  });
});
