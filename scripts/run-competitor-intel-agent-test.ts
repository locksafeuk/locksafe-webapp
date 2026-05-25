/**
 * Integration test for runCompetitorIntelAgent().
 *
 * Stubs prisma + seed-bank + SERP/fingerprint clients via require.cache
 * pre-population so the FULL agent loop runs end-to-end without hitting a
 * real DB or the network. This proves the DB persistence path is correct
 * (CompetitorDomain seeding, CompetitorKeyword upserts, GeoSignal trends,
 * AdCopy persistence, seed graduation, counters).
 *
 * Run with:
 *   node_modules/.bin/ts-node --project tsconfig.scripts.json scripts/run-competitor-intel-agent-test.ts
 */

import path from "path";
import Module from "module";

// Register tsconfig path aliases (@/...) at runtime so the agent's imports
// resolve to absolute paths under src/. Without this, ts-node alone resolves
// .ts files but not the @/ alias.
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

// ── Stub Prisma ──────────────────────────────────────────────────────────────
// In-memory tables modelled as Maps so we can assert the writes happened.

interface Row { id: string; [k: string]: unknown }
type Table = Map<string, Row>;

const tables: Record<string, Table> = {
  competitorDomain:     new Map(),
  competitorKeyword:    new Map(),
  competitorGeoSignal:  new Map(),
  competitorAdCopy:     new Map(),
  serviceCatalogItem:   new Map(),
  metaAdAccount:        new Map(),
};

// Call log for assertions on what the agent did to the DB.
const callLog: Array<{ table: string; op: string; args: unknown }> = [];

let nextId = 1;
const mkId = () => `id_${nextId++}`;

function matches(row: Row, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (row[k] !== v) return false;
  }
  return true;
}

function makeTableProxy(name: string): unknown {
  return {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      callLog.push({ table: name, op: "findUnique", args: where });
      for (const row of tables[name].values()) if (matches(row, where)) return row;
      return null;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      callLog.push({ table: name, op: "findFirst", args: where });
      for (const row of tables[name].values()) if (matches(row, where)) return row;
      return null;
    },
    findMany: async (
      { where, select }: { where?: Record<string, unknown>; select?: unknown } = {},
    ) => {
      callLog.push({ table: name, op: "findMany", args: { where, select } });
      const rows: Row[] = [];
      for (const row of tables[name].values()) {
        if (!where || matches(row, where)) rows.push(row);
      }
      return rows;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const id = mkId();
      const row: Row = { id, ...data };
      tables[name].set(id, row);
      callLog.push({ table: name, op: "create", args: data });
      return row;
    },
    update: async (
      { where, data }: { where: Record<string, unknown>; data: Record<string, unknown> },
    ) => {
      callLog.push({ table: name, op: "update", args: { where, data } });
      for (const row of tables[name].values()) {
        if (matches(row, where)) {
          // Handle Prisma's { increment: N } sugar
          const patch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === "object" && "increment" in (v as object)) {
              const cur = typeof row[k] === "number" ? (row[k] as number) : 0;
              patch[k] = cur + ((v as { increment: number }).increment);
            } else {
              patch[k] = v;
            }
          }
          Object.assign(row, patch);
          return row;
        }
      }
      throw new Error(`update: no row matching ${JSON.stringify(where)} in ${name}`);
    },
    updateMany: async (
      { where, data }: { where: Record<string, unknown>; data: Record<string, unknown> },
    ) => {
      callLog.push({ table: name, op: "updateMany", args: { where, data } });
      let count = 0;
      for (const row of tables[name].values()) {
        // Handle Prisma's { id: { in: [...] } } sugar
        let ok = true;
        for (const [k, v] of Object.entries(where)) {
          if (v && typeof v === "object" && "in" in (v as object)) {
            if (!((v as { in: unknown[] }).in.includes(row[k]))) { ok = false; break; }
          } else if (row[k] !== v) { ok = false; break; }
        }
        if (ok) { Object.assign(row, data); count++; }
      }
      return { count };
    },
    count: async ({ where }: { where?: Record<string, unknown> } = {}) => {
      callLog.push({ table: name, op: "count", args: where });
      let n = 0;
      for (const row of tables[name].values()) {
        if (!where || matches(row, where)) n++;
      }
      return n;
    },
  };
}

const fakePrisma = new Proxy({} as Record<string, unknown>, {
  get: (target, prop: string) => {
    if (!target[prop]) target[prop] = makeTableProxy(prop);
    return target[prop];
  },
});

// ── Inject stubs into require.cache BEFORE importing the agent ───────────────
//
// Strategy: also stuff the alias key ("@/lib/db") directly into require.cache
// because tsconfig-paths resolves aliases via Module._resolveFilename — which
// returns the file's true absolute path. We populate both the alias-resolved
// absolute path AND the bare-alias key to cover both ts-node and direct
// Module._load paths.

function injectStub(absolutePath: string, exports: unknown): void {
  require.cache[absolutePath] = {
    id:        absolutePath,
    filename:  absolutePath,
    loaded:    true,
    parent:    null,
    children:  [],
    paths:     [],
    exports,
  } as unknown as NodeModule;
}

// Resolve path-alias `@/...` manually to absolute file paths.
const repoRoot = path.resolve(__dirname, "..");
const aliasPath = (rel: string) => path.join(repoRoot, "src", rel);

// Stub @/lib/db
// `__esModule: true` is required so TS's __importDefault helper picks up
// `.default` instead of wrapping the whole exports object.
const dbStub = { __esModule: true, default: fakePrisma, prisma: fakePrisma };
injectStub(aliasPath("lib/db.ts"), dbStub);
injectStub(aliasPath("lib/db.js"), dbStub);

// Stub @/agents/core/seed-bank
const addSeedCalls: Array<{ keyword: string; opts: unknown }> = [];
const seedBankStub = {
  __esModule: true,
  addSeed: async (keyword: string, opts: unknown) => {
    addSeedCalls.push({ keyword, opts });
  },
};
injectStub(aliasPath("agents/core/seed-bank.ts"), seedBankStub);
injectStub(aliasPath("agents/core/seed-bank.js"), seedBankStub);

// Stub @/lib/serp-intelligence-client BEFORE the agent imports it.
// We feed the agent fixture SERP results so it has known data to merge.
const fixtureSerp: import("../src/lib/serp-intelligence-client").SerpScanResult[] = [
  {
    keyword: "emergency locksmith",
    geo: "manchester",
    scannedAt: new Date(),
    ads: [
      { domain: "lockforce.co.uk",      position: 1, headline: "Emergency Locksmith Manchester",
        description: "24/7 service",     displayUrl: "lockforce.co.uk",      sitelinks: [] },
      { domain: "local-heroes.co.uk",   position: 2, headline: "Find a Locksmith Manchester",
        description: "Vetted locksmiths", displayUrl: "local-heroes.co.uk",   sitelinks: [] },
    ],
    organicDomains: ["checkatrade.com", "yell.com"],
    query: "emergency locksmith manchester",
    blocked: false,
  },
  {
    keyword: "emergency locksmith",
    geo: "leeds",
    scannedAt: new Date(),
    ads: [
      { domain: "lockforce.co.uk", position: 1, headline: "Emergency Locksmith Leeds",
        description: "24/7", displayUrl: "lockforce.co.uk", sitelinks: [] },
    ],
    organicDomains: ["checkatrade.com"],
    query: "emergency locksmith leeds",
    blocked: false,
  },
];

// Re-export the REAL constants alongside the stubbed factory
const realSerpModule = require(aliasPath("lib/serp-intelligence-client.ts"));
const serpStub = {
  __esModule: true,
  ...realSerpModule,
  getSerpIntelligenceClient: () => ({
    scanMultiGeo: async () => ({
      results:       fixtureSerp,
      byKeyword:     new Map(),
      byDomain:      new Map(),
      requestsUsed:  fixtureSerp.length,
      blockedCount:  0,
      blockedRate:   0,
    }),
    get requestCount() { return fixtureSerp.length; },
  }),
};
injectStub(aliasPath("lib/serp-intelligence-client.ts"), serpStub);
injectStub(aliasPath("lib/serp-intelligence-client.js"), serpStub);

// Stub competitor-fingerprint factory
const realFpModule = require(aliasPath("lib/competitor-fingerprint.ts"));
const fpStub: Record<string, unknown> = {
  __esModule: true,
  ...realFpModule,
  getCompetitorFingerprintClient: () => ({
    fingerprintAll: async (domains: string[]) => {
      const m = new Map();
      for (const d of domains) {
        const lockforce  = d === "lockforce.co.uk";
        const heroes     = d === "local-heroes.co.uk";
        m.set(d, {
          domain: d, scannedAt: new Date(), httpStatus: 200, blocked: false,
          searchableText: lockforce
            ? "emergency locksmith manchester | 24/7 | mla approved | lockforce"
            : heroes
              ? "find a locksmith leeds | british gas local heroes | trusted trades"
              : "general services site",
          titleKeywords: [], metaKeywords: [], h1Keywords: [],
          serviceAreas: lockforce ? ["manchester","leeds","london"] : [],
          hasDedicatedCityPages: lockforce, claimsNationwide: lockforce,
          hasPpcTracking: lockforce, hasGoogleAdsTag: lockforce, hasGoogleTagManager: lockforce,
          googleAdsIds: lockforce ? ["AW-111"] : [],
          isMlaApproved: lockforce, isDbsChecked: lockforce, hasWhichTrusted: false, trustBadges: [],
          priceAnchors: lockforce ? ["from £49"] : [], lowestPriceGbp: lockforce ? 49 : null,
          emphasises24h: lockforce, leadsWithEmergency: lockforce, noCallOutFee: false,
        });
      }
      return m;
    },
  }),
};
injectStub(aliasPath("lib/competitor-fingerprint.ts"), fpStub);
injectStub(aliasPath("lib/competitor-fingerprint.js"), fpStub);

// ── NOW import the agent (uses our stubs) ────────────────────────────────────

const { runCompetitorIntelAgent, runQualityGate, DEFAULT_COMPETITOR_DOMAINS } =
  require(aliasPath("agents/cmo/subagents/competitor-intel/agent.ts"));

// ── Tiny test harness ────────────────────────────────────────────────────────

const C = { reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
            green: "\x1b[32m", red: "\x1b[31m", blue: "\x1b[34m" };
let passed = 0; let failed = 0;
const failures: string[] = [];
function ok(label: string)   { passed++; console.log(`  ${C.green}✓${C.reset} ${label}`); }
function fail(label: string, d = "") { failed++; failures.push(label + (d ? " — " + d : ""));
  console.log(`  ${C.red}✗${C.reset} ${label}${d ? "\n      " + C.dim + d + C.reset : ""}`); }
function check(cond: boolean, label: string, d = "") { cond ? ok(label) : fail(label, d); }
function head(title: string) { console.log(`\n${C.bold}${C.blue}── ${title}${C.reset}`); }

// ── Run the full agent against the stubs ─────────────────────────────────────

async function main() {
  console.log(`${C.bold}Integration: runCompetitorIntelAgent() with stubbed prisma + clients${C.reset}\n`);

  head("Pure quality gate");
  const passing = runQualityGate("emergency locksmith manchester", 4.20, 70, true);
  check(passing.passes === true, "high-CPC + dualConfirmed passes the gate");
  const offTopic = runQualityGate("free music lessons", 0, 0, false);
  check(offTopic.passes === false && offTopic.reason === "not_locksmith",
    "off-topic query (no locksmith-domain term) rejected by relevance gate",
    `got passes=${offTopic.passes}, reason=${offTopic.reason}`);

  head("Full agent run");
  const result = await runCompetitorIntelAgent();
  console.log(`\n  ${C.bold}CompetitorIntelResult:${C.reset} ${JSON.stringify(result, null, 2)
    .split("\n").map((l) => "    " + l).join("\n")}`);

  // ── Counter assertions ─────────────────────────────────────────────────────
  head("Counters");
  check(result.domainsScanned === DEFAULT_COMPETITOR_DOMAINS.length,
    `domainsScanned = ${DEFAULT_COMPETITOR_DOMAINS.length} default competitors`,
    `got ${result.domainsScanned}`);
  check(result.serpRequestsUsed === 2,
    "serpRequestsUsed = 2 (two fixture geos)",
    `got ${result.serpRequestsUsed}`);
  check(result.fingerprintsScanned === DEFAULT_COMPETITOR_DOMAINS.length,
    `fingerprintsScanned = ${DEFAULT_COMPETITOR_DOMAINS.length}`,
    `got ${result.fingerprintsScanned}`);
  check(result.keywordsDiscovered > 0, "keywordsDiscovered > 0",
    `got ${result.keywordsDiscovered}`);
  check(result.dualConfirmedKws > 0,
    "dualConfirmedKws > 0 (lockforce matched both SERP + fingerprint)",
    `got ${result.dualConfirmedKws}`);
  check(result.seedsGraduated > 0,
    "seedsGraduated > 0 (passing keywords go to seed bank)",
    `got ${result.seedsGraduated}`);
  check(result.errors.length === 0, "no errors",
    result.errors.length ? result.errors.join(" | ") : "");

  // ── DB persistence assertions ──────────────────────────────────────────────
  head("DB persistence (verified via in-memory prisma stub)");

  const competitorDomainCreates = callLog.filter(
    (c) => c.table === "competitorDomain" && c.op === "create",
  );
  check(competitorDomainCreates.length === DEFAULT_COMPETITOR_DOMAINS.length,
    `${DEFAULT_COMPETITOR_DOMAINS.length} CompetitorDomain rows created (default seeds)`,
    `got ${competitorDomainCreates.length}`);

  const keywordCreates = callLog.filter(
    (c) => c.table === "competitorKeyword" && c.op === "create",
  );
  check(keywordCreates.length > 0, "CompetitorKeyword rows created",
    `got ${keywordCreates.length}`);

  // Verify column mapping: seenInSemrush ← serpConfirmed, seenInSpyFu ← fingerprintConfirmed
  // The agent stores the template (the SERP keyword) — "emergency locksmith".
  // Cities live in CompetitorGeoSignal rows, not in the keyword text itself.
  const lockforceRow = keywordCreates.find(
    (c) => (c.args as Record<string, unknown>).domainId &&
           (c.args as Record<string, unknown>).keyword === "emergency locksmith",
  );
  if (lockforceRow) {
    const r = lockforceRow.args as Record<string, unknown>;
    check(r.seenInSemrush === true,
      "schema mapping: seenInSemrush ← serpConfirmed (true for lockforce in Manchester)");
    check(r.seenInSpyFu === true,
      "schema mapping: seenInSpyFu ← fingerprintConfirmed (lockforce fingerprint has the phrase)");
    check(r.dualSource === true,
      "schema mapping: dualSource ← dualConfirmed");
    check(r.passedQualityGate === true,
      "passedQualityGate = true for relevant keyword");
    check(r.countryCode === "GB", "countryCode locked to GB");
  } else {
    fail("expected a CompetitorKeyword for 'emergency locksmith manchester'");
  }

  const geoSignalCreates = callLog.filter(
    (c) => c.table === "competitorGeoSignal" && c.op === "create",
  );
  check(geoSignalCreates.length > 0, "CompetitorGeoSignal rows created for geo-attributed kws",
    `got ${geoSignalCreates.length}`);

  const adCopyCreates = callLog.filter(
    (c) => c.table === "competitorAdCopy" && c.op === "create",
  );
  check(adCopyCreates.length > 0, "CompetitorAdCopy rows created from SERP headlines",
    `got ${adCopyCreates.length}`);
  const sampleAd = adCopyCreates[0]?.args as Record<string, unknown> | undefined;
  if (sampleAd) {
    check(sampleAd.source === "serp-live",
      "ad copy source = 'serp-live' (provenance preserved)");
    check(typeof sampleAd.headline1 === "string" && (sampleAd.headline1 as string).length > 0,
      "ad copy has a headline");
  }

  const domainUpdates = callLog.filter(
    (c) => c.table === "competitorDomain" && c.op === "update",
  );
  check(domainUpdates.length === DEFAULT_COMPETITOR_DOMAINS.length,
    `CompetitorDomain.lastScannedAt updated for each tracked domain`,
    `got ${domainUpdates.length}`);

  // ── Seed-bank assertions ───────────────────────────────────────────────────
  head("Seed bank graduation");
  check(addSeedCalls.length > 0, "addSeed() invoked for passing keywords",
    `got ${addSeedCalls.length}`);
  const lockforceSeed = addSeedCalls.find((s) => s.keyword.includes("emergency locksmith"));
  if (lockforceSeed) {
    const o = lockforceSeed.opts as Record<string, unknown>;
    check(o.category === "competitor", "seed category = 'competitor'");
    check(typeof o.source === "string" && (o.source as string).startsWith("competitor-intel:"),
      "seed source tagged with 'competitor-intel:<domain>'");
    check(typeof o.notes === "string" && (o.notes as string).includes("Dual-confirmed"),
      "seed notes mention dual confirmation");
  } else {
    fail("expected an addSeed call for an emergency-locksmith keyword");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${C.blue}══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}Passed: ${C.green}${passed}${C.reset}   ` +
              `${C.bold}Failed: ${failed > 0 ? C.red : C.dim}${failed}${C.reset}`);
  if (failures.length > 0) {
    console.log(`\n${C.red}Failures:${C.reset}`);
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error("Test crashed:", err); process.exit(2); });
