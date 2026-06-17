/**
 * @jest-environment node
 *
 * Tests for §28 — per-region CPC cap matrix.
 *
 * Covers:
 *   - Liverpool resolves to "regional" tier → £14 ceiling
 *   - London resolves to "metro" tier      → £20 ceiling
 *   - Unknown town defaults to "town"      → £6 ceiling
 *   - Label parsing handles postcode suffixes ("Liverpool L1 v2")
 *   - The tier table includes the 4 named regional + 3 named metro cities
 */

import {
  CPC_CEILING_GBP_BY_TIER,
  citySlugFromLabel,
  getCpcCeilingGbp,
  regionTierFromLabel,
  resolveCpcCeilingFromLabel,
  getRegionTierTable,
} from "../google-ads-cpc-matrix";

describe("§28 — per-region CPC cap matrix", () => {
  describe("CPC_CEILING_GBP_BY_TIER constants", () => {
    it("encodes the 2026-06-17 research midpoints", () => {
      expect(CPC_CEILING_GBP_BY_TIER.town).toBe(6);
      expect(CPC_CEILING_GBP_BY_TIER.regional).toBe(14);
      expect(CPC_CEILING_GBP_BY_TIER.metro).toBe(20);
    });
  });

  describe("getCpcCeilingGbp(tier)", () => {
    it("returns £6 for town tier", () => {
      expect(getCpcCeilingGbp("town")).toBe(6);
    });
    it("returns £14 for regional tier", () => {
      expect(getCpcCeilingGbp("regional")).toBe(14);
    });
    it("returns £20 for metro tier", () => {
      expect(getCpcCeilingGbp("metro")).toBe(20);
    });
    it("defaults to regional (£14) when tier is undefined", () => {
      expect(getCpcCeilingGbp()).toBe(14);
    });
  });

  describe("citySlugFromLabel — label normalisation", () => {
    it("strips postcode + version suffixes", () => {
      expect(citySlugFromLabel("Liverpool L1 v2")).toBe("liverpool");
      expect(citySlugFromLabel("Newcastle NE1")).toBe("newcastle");
      expect(citySlugFromLabel("London E15 — Newham")).toBe("london");
    });
    it("handles plain city names", () => {
      expect(citySlugFromLabel("London")).toBe("london");
      expect(citySlugFromLabel("Manchester")).toBe("manchester");
    });
    it("returns empty string for empty/undefined input", () => {
      expect(citySlugFromLabel("")).toBe("");
      expect(citySlugFromLabel(undefined)).toBe("");
      expect(citySlugFromLabel(null)).toBe("");
    });
  });

  describe("regionTierFromLabel", () => {
    it("classifies known metros", () => {
      expect(regionTierFromLabel("London E15")).toBe("metro");
      expect(regionTierFromLabel("Manchester M1")).toBe("metro");
      expect(regionTierFromLabel("Birmingham B1")).toBe("metro");
    });
    it("classifies known regional cities", () => {
      expect(regionTierFromLabel("Liverpool L1 v2")).toBe("regional");
      expect(regionTierFromLabel("Newcastle NE1")).toBe("regional");
      expect(regionTierFromLabel("Bristol BS1")).toBe("regional");
      expect(regionTierFromLabel("Bradford BD1")).toBe("regional");
    });
    it("defaults to town for unknown labels", () => {
      expect(regionTierFromLabel("Newham")).toBe("town");
      expect(regionTierFromLabel("Salford")).toBe("town");
      expect(regionTierFromLabel("")).toBe("town");
      expect(regionTierFromLabel(undefined)).toBe("town");
    });
  });

  describe("resolveCpcCeilingFromLabel — the headline test", () => {
    it("(a) Liverpool gets £14", () => {
      expect(resolveCpcCeilingFromLabel("Liverpool L1 v2")).toBe(14);
    });
    it("(b) London gets £20", () => {
      expect(resolveCpcCeilingFromLabel("London E15 — Newham")).toBe(20);
    });
    it("(c) unknown town gets £6", () => {
      expect(resolveCpcCeilingFromLabel("Saltaire")).toBe(6);
      expect(resolveCpcCeilingFromLabel("Newham E15")).toBe(6);
    });
  });

  describe("getRegionTierTable — keys present for all named cities", () => {
    it("includes all 3 metros", () => {
      const t = getRegionTierTable();
      expect(t.london).toBe("metro");
      expect(t.manchester).toBe("metro");
      expect(t.birmingham).toBe("metro");
    });
    it("includes all 4 regional cities", () => {
      const t = getRegionTierTable();
      expect(t.liverpool).toBe("regional");
      expect(t.newcastle).toBe("regional");
      expect(t.bristol).toBe("regional");
      expect(t.bradford).toBe("regional");
    });
    it("returns a defensive copy (mutations don't affect the source)", () => {
      const t = getRegionTierTable() as Record<string, "town" | "regional" | "metro">;
      t.london = "town";
      expect(getRegionTierTable().london).toBe("metro");
    });
  });
});
