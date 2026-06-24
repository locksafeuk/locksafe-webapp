import { evaluateDailySpendAlert } from "../google-ads-daily-spend-alert";

describe("§38 — Daily spend alert (2026-06-24)", () => {
  describe("threshold logic", () => {
    it("does NOT alert when spend is under threshold", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 50 });
      expect(d.shouldAlert).toBe(false);
      expect(d.message).toBeUndefined();
      expect(d.thresholdGbp).toBe(80);
    });

    it("does NOT alert when spend equals threshold (strictly over)", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 80 });
      expect(d.shouldAlert).toBe(false);
      expect(d.overByGbp).toBe(0);
    });

    it("alerts when spend exceeds default £80 threshold", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 95.50 });
      expect(d.shouldAlert).toBe(true);
      expect(d.overByGbp).toBeCloseTo(15.5, 2);
      expect(d.message).toMatch(/£95\.50/);
      expect(d.message).toMatch(/over the £80 daily alert threshold/i);
    });

    it("respects custom threshold via thresholdGbp", () => {
      const under = evaluateDailySpendAlert({ spendGbp: 100, thresholdGbp: 150 });
      expect(under.shouldAlert).toBe(false);

      const over = evaluateDailySpendAlert({ spendGbp: 160, thresholdGbp: 150 });
      expect(over.shouldAlert).toBe(true);
      expect(over.message).toMatch(/£150 daily alert threshold/i);
    });

    it("falls back to default 80 when thresholdGbp is invalid (NaN, 0, negative)", () => {
      for (const bad of [NaN, 0, -10, -1.5]) {
        const d = evaluateDailySpendAlert({ spendGbp: 100, thresholdGbp: bad });
        expect(d.thresholdGbp).toBe(80);
        expect(d.shouldAlert).toBe(true);
      }
    });

    it("treats non-finite spend as 0 (no alert)", () => {
      const nan = evaluateDailySpendAlert({ spendGbp: NaN });
      expect(nan.shouldAlert).toBe(false);
      expect(nan.spendGbp).toBe(0);
    });
  });

  describe("alert message content", () => {
    it("includes the day in YYYY-MM-DD form when dayIso supplied", () => {
      const d = evaluateDailySpendAlert({
        spendGbp: 100,
        dayIso: "2026-06-24T07:15:00Z",
      });
      expect(d.message).toMatch(/2026-06-24/);
    });

    it("includes monthly projection (£spend × 30.4 days)", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 100 });
      // 100 * 30.4 = 3040
      expect(d.message).toMatch(/3,040|3040/);
    });

    it("mentions the engineered £2,500 monthly cap", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 95 });
      expect(d.message).toMatch(/£2,500/);
    });

    it("mentions the MAX_DAILY_ACCOUNT_SPEND_GBP publish-time gate", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 95 });
      expect(d.message).toMatch(/MAX_DAILY_ACCOUNT_SPEND_GBP/);
    });

    it("explains the 2× Google over-deliver context", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 95 });
      expect(d.message).toMatch(/over-deliver/i);
    });
  });

  describe("boundary cases for §38 engineered cap", () => {
    it("spend just over £80 (£80.01) DOES alert", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 80.01 });
      expect(d.shouldAlert).toBe(true);
      expect(d.overByGbp).toBeCloseTo(0.01, 2);
    });

    it("spend at the £85 publish-cap level produces an alert", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 85 });
      expect(d.shouldAlert).toBe(true);
      expect(d.overByGbp).toBe(5);
    });

    it("spend at the worst-case 2× daily (£164) produces a strong alert", () => {
      const d = evaluateDailySpendAlert({ spendGbp: 164 });
      expect(d.shouldAlert).toBe(true);
      expect(d.overByGbp).toBe(84);
      // Monthly projection 164 × 30.4 = 4985.6 ≈ £4,986
      expect(d.message).toMatch(/4,986/);
    });
  });
});
