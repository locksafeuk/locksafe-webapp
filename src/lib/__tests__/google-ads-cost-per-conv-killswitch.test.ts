/**
 * @jest-environment node
 *
 * Tests for §32 — Cost-per-verified-conversion kill switch threshold logic.
 *
 * Pure-function tests against `evaluateKillSwitch` — covers the four
 * decision branches:
 *   1. 0 conv + low spend → keep (too early)
 *   2. 0 conv + spend > floor → pause (Infinity > threshold)
 *   3. verified > 0 AND cost/conv > threshold → pause
 *   4. verified > 0 AND cost/conv ≤ threshold → keep
 */

import {
  evaluateKillSwitch,
  type CampaignSpendRow,
} from "../google-ads-cost-per-conv-killswitch";

const row = (
  spendGbp: number,
  verifiedConversions: number,
  name = `c-${spendGbp}-${verifiedConversions}`,
): CampaignSpendRow => ({
  campaignId:          `id-${name}`,
  campaignName:        name,
  status:              "ENABLED",
  spendGbp,
  verifiedConversions,
});

describe("§32 kill switch — evaluateKillSwitch", () => {
  it("KEEPS a campaign with 0 conv and £50 spend (below £100 floor)", () => {
    const [d] = evaluateKillSwitch([row(50, 0)]);
    expect(d.action).toBe("keep");
    expect(d.costPerConvGbp).toBe(0);
    expect(d.reason).toMatch(/too early/i);
  });

  it("PAUSES a campaign with 0 conv and £150 spend (above £100 floor)", () => {
    const [d] = evaluateKillSwitch([row(150, 0)]);
    expect(d.action).toBe("pause");
    expect(d.costPerConvGbp).toBe(Number.POSITIVE_INFINITY);
    expect(d.reason).toMatch(/Infinity/);
  });

  it("PAUSES a campaign at £180/conv (above £150 threshold)", () => {
    const [d] = evaluateKillSwitch([row(180, 1)]);
    expect(d.action).toBe("pause");
    expect(d.costPerConvGbp).toBeCloseTo(180);
  });

  it("KEEPS a campaign at £120/conv (below £150 threshold)", () => {
    const [d] = evaluateKillSwitch([row(120, 1)]);
    expect(d.action).toBe("keep");
    expect(d.costPerConvGbp).toBeCloseTo(120);
  });

  it("KEEPS a campaign at exactly £150/conv (= threshold, not >)", () => {
    const [d] = evaluateKillSwitch([row(150, 1)]);
    expect(d.action).toBe("keep");
  });

  it("REGRESSION: Liverpool L1 v2 — £648 spent, 0 verified conv → pause", () => {
    const [d] = evaluateKillSwitch([row(648, 0, "Liverpool L1 v2")]);
    expect(d.action).toBe("pause");
    expect(d.costPerConvGbp).toBe(Number.POSITIVE_INFINITY);
  });

  it("evaluates a batch and yields one decision per row in order", () => {
    const decisions = evaluateKillSwitch([
      row(50, 0,  "early"),
      row(200, 0, "bleed"),
      row(180, 1, "expensive"),
      row(60, 1,  "healthy"),
    ]);
    expect(decisions.map((d) => d.action)).toEqual([
      "keep",
      "pause",
      "pause",
      "keep",
    ]);
  });

  it("respects custom threshold via options", () => {
    // Same row that pauses at default £150 should KEEP when threshold = £200.
    const [d] = evaluateKillSwitch([row(180, 1)], { thresholdGbp: 200 });
    expect(d.action).toBe("keep");
  });

  it("respects custom zeroConvSpendFloor via options", () => {
    const [d] = evaluateKillSwitch([row(50, 0)], { zeroConvSpendFloor: 20 });
    expect(d.action).toBe("pause");
  });
});
