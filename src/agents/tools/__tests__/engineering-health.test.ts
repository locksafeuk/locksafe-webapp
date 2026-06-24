import { deriveEngineeringFlags, type EngineeringHealth } from "@/agents/tools/engineering-health";

const base = (over: Partial<EngineeringHealth["metrics"]> = {}, crit: string[] = []): EngineeringHealth => ({
  checkedAt: "2026-06-24T00:00:00Z",
  metrics: { prismaAsAny: 0, asAny: 0, anyType: 0, tsIgnore: 0, eslintDisable: 0, todos: 0, ...over },
  criticalPathsWithoutTests: crit,
});

it("is clean (no flags, needsReview false) for a healthy snapshot", () => {
  const r = deriveEngineeringFlags(base());
  expect(r.flags).toEqual([]);
  expect(r.needsReview).toBe(false);
});

it("flags high prisma-as-any and sets needsReview", () => {
  const r = deriveEngineeringFlags(base({ prismaAsAny: 83 }));
  expect(r.needsReview).toBe(true);
  expect(r.flags.join(" ")).toMatch(/prisma as any/);
});

it("flags critical paths without tests", () => {
  const r = deriveEngineeringFlags(base({}, ["src/app/api/payments", "src/app/api/webhooks"]));
  expect(r.needsReview).toBe(true);
  expect(r.flags.filter((f) => /no tests/.test(f)).length).toBe(2);
});

it("does not flag counts under threshold", () => {
  const r = deriveEngineeringFlags(base({ prismaAsAny: 10, anyType: 50, todos: 5, eslintDisable: 20 }));
  expect(r.needsReview).toBe(false);
});
