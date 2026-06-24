import { derivePlatformFlags, type PlatformSnapshot } from "@/agents/tools/cross-repo";

const base = (over: Partial<PlatformSnapshot> = {}): PlatformSnapshot => ({
  checkedAt: "2026-06-24T00:00:00Z",
  repos: [{ repo: "locksafe-mobile", hash: "abc", subject: "x", ageDays: 3 }],
  mobile: {
    configVersion: "1.0.7", iosBuild: "28", androidVersionCode: "35",
    packageVersion: "1.0.7", statusDocVersion: "1.0.7",
    versionDrift: false, distinctVersions: ["1.0.7"],
  },
  socialAutomation: { totalPostsMade: 12, lastPostDate: "2026-06-01", dormant: false },
  ...over,
});

it("flags mobile version drift", () => {
  const flags = derivePlatformFlags(base({
    mobile: { configVersion: "1.0.7", iosBuild: "28", androidVersionCode: "35", packageVersion: "1.0.4", statusDocVersion: "1.0.3", versionDrift: true, distinctVersions: ["1.0.7", "1.0.4", "1.0.3"] },
  }));
  expect(flags.some((f) => /version drift/i.test(f))).toBe(true);
  expect(flags.join(" ")).toContain("1.0.4");
});

it("flags a dormant social-automation repo", () => {
  const flags = derivePlatformFlags(base({
    socialAutomation: { totalPostsMade: 0, lastPostDate: null, dormant: true },
  }));
  expect(flags.some((f) => /dormant/i.test(f))).toBe(true);
});

it("flags a stale repo (no commit > 30 days)", () => {
  const flags = derivePlatformFlags(base({
    repos: [{ repo: "locksafe-social-media", hash: "x", subject: "y", ageDays: 45 }],
  }));
  expect(flags.some((f) => /no commit in 45 days/.test(f))).toBe(true);
});

it("flags a git read failure", () => {
  const flags = derivePlatformFlags(base({
    repos: [{ repo: "locksafe-mobile", hash: null, subject: null, ageDays: null, error: "not a repo" }],
  }));
  expect(flags.some((f) => /git read failed/.test(f))).toBe(true);
});

it("returns no flags for a healthy platform", () => {
  expect(derivePlatformFlags(base())).toEqual([]);
});
