/**
 * Tests for the LocksmithCoverage primitives.
 *
 * Pure tests: extractDistrict, extractDistrictsFromText.
 * Stubbed-prisma tests: getCoverageForDistrict reasons (no_active_locksmith,
 *   all_paused, all_at_capacity, covered) and the campaign-create coverage
 *   gate behaviour.
 *
 * Run with:
 *   node_modules/.bin/ts-node -r tsconfig-paths/register --project tsconfig.scripts.json scripts/run-coverage-tests.ts
 */

import path from "path";

// Register @ alias resolution.
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

// ── Tiny test runner ────────────────────────────────────────────────────────

const C = { reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
            green: "\x1b[32m", red: "\x1b[31m", blue: "\x1b[34m" };
let passed = 0; let failed = 0;
const failures: string[] = [];
function suite(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${C.bold}${C.blue}── ${name}${C.reset}`);
  return Promise.resolve(fn());
}
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => { passed++; console.log(`  ${C.green}✓${C.reset} ${name}`); },
    (err) => {
      failed++;
      const d = err instanceof Error ? err.message : String(err);
      failures.push(`${name} — ${d}`);
      console.log(`  ${C.red}✗${C.reset} ${name}\n      ${C.dim}${d}${C.reset}`);
    },
  );
}
function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected)
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== "number" || actual <= n)
        throw new Error(`expected > ${n}, got ${actual}`);
    },
    toContain(item: unknown) {
      if (!Array.isArray(actual) && typeof actual !== "string")
        throw new Error(`toContain on non-array/string`);
      if (!(actual as Array<unknown> | string).includes(item as never))
        throw new Error(`expected to contain ${JSON.stringify(item)}, got ${JSON.stringify(actual)}`);
    },
  };
}

// ── Stub prisma via require.cache injection ─────────────────────────────────
// Same pattern as run-competitor-intel-agent-test.ts.

interface Row { id: string; [k: string]: unknown }
const tables: Record<string, Map<string, Row>> = {
  locksmithCoverage: new Map(),
  locksmith:         new Map(),
  job:               new Map(),
};
let nextId = 1;
const mkId = () => `id_${nextId++}`;
function matches(row: Row, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      // Handle Prisma's { gte: ... } and nested filters loosely
      if ("gte" in (v as object)) {
        const rowVal = row[k] as unknown;
        if (rowVal instanceof Date && (v as { gte: Date }).gte instanceof Date) {
          if (rowVal < (v as { gte: Date }).gte) return false;
          continue;
        }
      }
      if ("equals" in (v as object)) {
        if (row[k] !== (v as { equals: unknown }).equals) return false;
        continue;
      }
      if ("in" in (v as object)) {
        if (!((v as { in: unknown[] }).in.includes(row[k]))) return false;
        continue;
      }
      // Nested relation filter: { locksmith: { isActive: true, ... } } —
      // resolve by looking up the related row.
      if (k === "locksmith" && row.locksmithId) {
        const rel = tables.locksmith.get(row.locksmithId as string);
        if (!rel || !matches(rel, v as Record<string, unknown>)) return false;
        continue;
      }
      if (k === "NOT") {
        if (matches(row, v as Record<string, unknown>)) return false;
        continue;
      }
      // Fall through to deep-equal-ish
      if (JSON.stringify(row[k]) !== JSON.stringify(v)) return false;
      continue;
    }
    if (row[k] !== v) return false;
  }
  return true;
}
function makeTableProxy(name: string): unknown {
  return {
    findUnique: async (args: { where: Record<string, unknown> }) => {
      // Support compound-key lookups (locksmithId_postcodeDistrict)
      const w = args.where;
      const compound = w.locksmithId_postcodeDistrict as { locksmithId: string; postcodeDistrict: string } | undefined;
      const eff = compound ? { locksmithId: compound.locksmithId, postcodeDistrict: compound.postcodeDistrict } : w;
      for (const row of tables[name].values()) if (matches(row, eff)) return row;
      return null;
    },
    findFirst: async (args: { where: Record<string, unknown> }) => {
      for (const row of tables[name].values()) if (matches(row, args.where)) return row;
      return null;
    },
    findMany: async (args: { where?: Record<string, unknown>; select?: unknown; include?: unknown } = {}) => {
      const rows: Row[] = [];
      for (const row of tables[name].values()) {
        if (!args.where || matches(row, args.where)) {
          // For include: { locksmith: { select } } — attach the related row
          if (args.include && (args.include as Record<string, unknown>).locksmith && row.locksmithId) {
            const rel = tables.locksmith.get(row.locksmithId as string);
            rows.push({ ...row, locksmith: rel ? { id: rel.id, name: rel.name } : null });
          } else {
            rows.push(row);
          }
        }
      }
      return rows;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const id = mkId();
      const row: Row = { id, ...data };
      tables[name].set(id, row);
      return row;
    },
  };
}
const fakePrisma = new Proxy({} as Record<string, unknown>, {
  get: (target, prop: string) => {
    if (!target[prop]) target[prop] = makeTableProxy(prop);
    return target[prop];
  },
});

const repoRoot = path.resolve(__dirname, "..");
const aliasPath = (rel: string) => path.join(repoRoot, "src", rel);
function injectStub(absPath: string, exports: unknown) {
  require.cache[absPath] = {
    id: absPath, filename: absPath, loaded: true, parent: null,
    children: [], paths: [], exports,
  } as unknown as NodeModule;
}
injectStub(aliasPath("lib/db.ts"), { __esModule: true, default: fakePrisma, prisma: fakePrisma });
injectStub(aliasPath("lib/db.js"), { __esModule: true, default: fakePrisma, prisma: fakePrisma });

// Now import the coverage module — picks up the stubbed prisma.
const cov = require(aliasPath("lib/locksmith-coverage.ts"));

// ── Pure tests ──────────────────────────────────────────────────────────────

(async () => {

await suite("extractDistrict", async () => {
  await test("full postcode → district", () => expect(cov.extractDistrict("RG1 2AB")).toBe("RG1"));
  await test("lowercase", () => expect(cov.extractDistrict("rg1 2ab")).toBe("RG1"));
  await test("London edge case (final letter)", () => expect(cov.extractDistrict("sw1a 1aa")).toBe("SW1A"));
  await test("bare district", () => expect(cov.extractDistrict("M3")).toBe("M3"));
  await test("two-digit district", () => expect(cov.extractDistrict("WD25")).toBe("WD25"));
  await test("US zip rejected", () => expect(cov.extractDistrict("12345")).toBe(""));
  await test("garbage rejected", () => expect(cov.extractDistrict("hello world")).toBe(""));
  await test("empty / null safe", () => {
    expect(cov.extractDistrict("")).toBe("");
    expect(cov.extractDistrict(null)).toBe("");
    expect(cov.extractDistrict(undefined)).toBe("");
  });
});

await suite("extractDistrictsFromText", async () => {
  await test("comma-separated list", () =>
    expect(cov.extractDistrictsFromText("RG1, RG2, RG30")).toEqual(["RG1", "RG2", "RG30"]));
  await test("mixed full postcodes + districts + garbage", () =>
    expect(cov.extractDistrictsFromText("RG1, RG2, SK4 1AA, M3 8AA, garbage"))
      .toEqual(["RG1", "RG2", "SK4", "M3"]));
  await test("dedupes", () =>
    expect(cov.extractDistrictsFromText("RG1 RG1 RG1")).toEqual(["RG1"]));
  await test("empty → []", () => expect(cov.extractDistrictsFromText("")).toEqual([]));
});

// ── Stubbed-prisma scenarios ────────────────────────────────────────────────

// Seed fake locksmith + coverage + jobs
const aliceId = "lk_alice";
const bobId   = "lk_bob";
const carolId = "lk_carol";
tables.locksmith.set(aliceId, { id: aliceId, name: "Alice", isActive: true, onboardingCompleted: true, isAvailable: true });
tables.locksmith.set(bobId,   { id: bobId,   name: "Bob",   isActive: true, onboardingCompleted: true, isAvailable: true });
tables.locksmith.set(carolId, { id: carolId, name: "Carol", isActive: true, onboardingCompleted: false, isAvailable: true });

// Alice covers RG1 with capacity 5
tables.locksmithCoverage.set("c1", { id: "c1", locksmithId: aliceId, postcodeDistrict: "RG1",
  weeklyCapacity: 5, isPaused: false, pauseReason: null, confidenceScore: 1.0 });
// Bob covers RG1 paused
tables.locksmithCoverage.set("c2", { id: "c2", locksmithId: bobId, postcodeDistrict: "RG1",
  weeklyCapacity: 5, isPaused: true, pauseReason: "vacation", confidenceScore: 1.0 });
// Carol covers RG1 but onboarding incomplete → should be excluded
tables.locksmithCoverage.set("c3", { id: "c3", locksmithId: carolId, postcodeDistrict: "RG1",
  weeklyCapacity: 5, isPaused: false, pauseReason: null, confidenceScore: 1.0 });
// SK4: only Bob covers, and he's paused → all_paused expected
tables.locksmithCoverage.set("c4", { id: "c4", locksmithId: bobId, postcodeDistrict: "SK4",
  weeklyCapacity: 5, isPaused: true, pauseReason: "training", confidenceScore: 1.0 });
// MK9: nobody → no_active_locksmith expected
// LE2: Alice has cap 2, with 2 jobs already → all_at_capacity expected
tables.locksmithCoverage.set("c5", { id: "c5", locksmithId: aliceId, postcodeDistrict: "LE2",
  weeklyCapacity: 2, isPaused: false, pauseReason: null, confidenceScore: 1.0 });

// Alice has 2 jobs in LE2 in the last 7 days, 1 in RG1
const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
tables.job.set("j1", { id: "j1", locksmithId: aliceId, postcode: "LE2 5XY", createdAt: recent, status: "COMPLETED" });
tables.job.set("j2", { id: "j2", locksmithId: aliceId, postcode: "LE2 6AB", createdAt: recent, status: "IN_PROGRESS" });
tables.job.set("j3", { id: "j3", locksmithId: aliceId, postcode: "RG1 1AA", createdAt: recent, status: "COMPLETED" });
// Cancelled job — should NOT consume capacity
tables.job.set("j4", { id: "j4", locksmithId: aliceId, postcode: "LE2 7CD", createdAt: recent, status: "CANCELLED" });
// Old job (> 7d) — should NOT count
tables.job.set("j5", { id: "j5", locksmithId: aliceId, postcode: "LE2 8EF",
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), status: "COMPLETED" });

await suite("currentWeeklyLoad", async () => {
  await test("counts in-window non-cancelled jobs matching district", async () => {
    const n = await cov.currentWeeklyLoad(aliceId, "LE2");
    expect(n).toBe(2);  // j1 + j2 (j4 cancelled, j5 too old)
  });
  await test("returns 0 for district with no jobs", async () => {
    expect(await cov.currentWeeklyLoad(aliceId, "M3")).toBe(0);
  });
});

await suite("getCoverageForDistrict", async () => {
  await test("RG1: Alice has 5 cap, 1 job → covered, freeCapacity = 4", async () => {
    const v = await cov.getCoverageForDistrict("RG1");
    expect(v.covered).toBe(true);
    expect(v.totalFreeCapacity).toBe(4);
    expect(v.bestLocksmith?.locksmithName).toBe("Alice");
    expect(v.bestLocksmith?.freeCapacity).toBe(4);
  });
  await test("RG1: Carol excluded because onboarding incomplete", async () => {
    const v = await cov.getCoverageForDistrict("RG1");
    const names = v.allLocksmiths.map((l: { locksmithName: string }) => l.locksmithName);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
    if (names.includes("Carol")) throw new Error("Carol should be excluded");
  });
  await test("SK4: only Bob, paused → all_paused", async () => {
    const v = await cov.getCoverageForDistrict("SK4");
    expect(v.covered).toBe(false);
    expect(v.reason).toBe("all_paused");
  });
  await test("MK9: no rows → no_active_locksmith", async () => {
    const v = await cov.getCoverageForDistrict("MK9");
    expect(v.covered).toBe(false);
    expect(v.reason).toBe("no_active_locksmith");
  });
  await test("LE2: Alice cap 2 + 2 jobs → all_at_capacity", async () => {
    const v = await cov.getCoverageForDistrict("LE2");
    expect(v.covered).toBe(false);
    expect(v.reason).toBe("all_at_capacity");
  });
  await test("invalid district → no_coverage_row", async () => {
    const v = await cov.getCoverageForDistrict("hello");
    expect(v.covered).toBe(false);
    expect(v.reason).toBe("no_coverage_row");
  });
});

await suite("getCoverageForDistricts (batch)", async () => {
  await test("returns a Map keyed by normalised district", async () => {
    const m = await cov.getCoverageForDistricts(["rg1", "SK4", "MK9"]);
    expect(m.size).toBe(3);
    expect(m.get("RG1")?.covered).toBe(true);
    expect(m.get("SK4")?.covered).toBe(false);
    expect(m.get("MK9")?.covered).toBe(false);
  });
});

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${C.bold}${C.blue}══════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}Passed: ${C.green}${passed}${C.reset}   ${C.bold}Failed: ${failed > 0 ? C.red : C.dim}${failed}${C.reset}`);
if (failures.length > 0) {
  console.log(`\n${C.red}Failures:${C.reset}`);
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(failed > 0 ? 1 : 0);

})().catch((err) => { console.error("Test runner crashed:", err); process.exit(2); });
