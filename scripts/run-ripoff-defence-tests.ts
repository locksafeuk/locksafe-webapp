/**
 * Tests for the rip-off-defence stack:
 *   • google-ads-conversions.ts — payload formatting, eligibility, skip rules
 *   • google-ads-auto-pause (logic) — pause decision matrix
 *
 * Pure tests where possible. Stubbed-prisma + stubbed-Google-client for
 * the integration paths.
 *
 * Run with:
 *   node_modules/.bin/ts-node -r tsconfig-paths/register --project tsconfig.scripts.json scripts/run-ripoff-defence-tests.ts
 */

import path from "path";

require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

// ── Tiny runner ────────────────────────────────────────────────────────────

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
    toMatch(re: RegExp) {
      if (typeof actual !== "string" || !re.test(actual))
        throw new Error(`expected to match ${re}, got ${JSON.stringify(actual)}`);
    },
    toContain(item: unknown) {
      if (typeof actual !== "string" && !Array.isArray(actual))
        throw new Error(`toContain on non-string/array`);
      if (!(actual as Array<unknown> | string).includes(item as never))
        throw new Error(`expected to contain ${JSON.stringify(item)}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== "number" || actual <= n)
        throw new Error(`expected > ${n}, got ${actual}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`expected null, got ${JSON.stringify(actual)}`);
    },
  };
}

// ── Stub prisma + google-ads client via require.cache ───────────────────────

interface Row { id: string; [k: string]: unknown }
const tables: Record<string, Map<string, Row>> = {
  job:                       new Map(),
  adCampaign:                new Map(),  // kept for Meta-side tests; not used by Google auto-pause
  googleAdsCampaignDraft:    new Map(),  // Google Ads campaigns — what auto-pause queries
  adPerformanceSnapshot:     new Map(),
  quote:                     new Map(),
  userSession:               new Map(),
};
let nextId = 1;
const mkId = () => `id_${nextId++}`;

function matches(row: Row, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      if ("gte" in (v as object)) {
        const rv = row[k] as unknown;
        if (rv instanceof Date && (v as { gte: Date }).gte instanceof Date) {
          if (rv < (v as { gte: Date }).gte) return false;
          continue;
        }
      }
      if ("not" in (v as object)) {
        if (row[k] === (v as { not: unknown }).not) return false;
        continue;
      }
      if (JSON.stringify(row[k]) !== JSON.stringify(v)) return false;
      continue;
    }
    if (row[k] !== v) return false;
  }
  return true;
}

function makeTable(name: string): unknown {
  return {
    findUnique: async (args: { where: Record<string, unknown>; include?: unknown }) => {
      for (const row of tables[name].values()) {
        if (matches(row, args.where)) {
          // Resolve include: { quote: true }
          if (args.include && (args.include as Record<string, unknown>).quote && row.quoteId) {
            return { ...row, quote: tables.quote.get(row.quoteId as string) ?? null };
          }
          return row;
        }
      }
      return null;
    },
    findFirst: async (args: { where: Record<string, unknown> }) => {
      for (const row of tables[name].values()) if (matches(row, args.where)) return row;
      return null;
    },
    findMany: async (args: { where?: Record<string, unknown>; select?: unknown } = {}) => {
      const rows: Row[] = [];
      for (const row of tables[name].values()) {
        if (!args.where || matches(row, args.where)) {
          // Resolve simple nested select for quote
          if (args.select && (args.select as Record<string, unknown>).quote && row.quoteId) {
            rows.push({ ...row, quote: tables.quote.get(row.quoteId as string) ?? null });
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
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      for (const row of tables[name].values()) {
        if (matches(row, where)) { Object.assign(row, data); return row; }
      }
      throw new Error(`update: no match in ${name}`);
    },
  };
}
const fakePrisma = new Proxy({} as Record<string, unknown>, {
  get: (target, prop: string) => {
    if (!target[prop]) target[prop] = makeTable(prop);
    return target[prop];
  },
});

// Stub @/lib/db
const repoRoot = path.resolve(__dirname, "..");
const aliasPath = (rel: string) => path.join(repoRoot, "src", rel);
function injectStub(absPath: string, exports: unknown) {
  require.cache[absPath] = {
    id: absPath, filename: absPath, loaded: true, parent: null,
    children: [], paths: [], exports,
  } as unknown as NodeModule;
}
const dbStub = { __esModule: true, default: fakePrisma, prisma: fakePrisma };
injectStub(aliasPath("lib/db.ts"), dbStub);
injectStub(aliasPath("lib/db.js"), dbStub);

// Stub @/lib/google-ads
const googleAdsCalls: Array<{ url: string; method: string; body: unknown }> = [];
let nextGoogleAdsResponse: unknown = { results: [{ gclid: "Cj0KCQiAtest", message: "" }] };
const fakeGoogleClient = {
  request: async (url: string, method: string, body: unknown) => {
    googleAdsCalls.push({ url, method, body });
    return nextGoogleAdsResponse;
  },
  mutate: async (url: string, method: string, body: unknown) => {
    googleAdsCalls.push({ url, method, body });
    return nextGoogleAdsResponse;
  },
};
injectStub(aliasPath("lib/google-ads.ts"), {
  __esModule: true,
  getDefaultGoogleAdsClient: async () => fakeGoogleClient,
});

// Stub @/lib/telegram (we don't want to send real Telegrams)
const telegramAlerts: Array<{ title: string; message: string }> = [];
injectStub(aliasPath("lib/telegram.ts"), {
  __esModule: true,
  sendAdminAlert: async (data: { title: string; message: string }) => {
    telegramAlerts.push(data);
    return true;
  },
});

// Stub @/lib/cron-auth
injectStub(aliasPath("lib/cron-auth.ts"), {
  __esModule: true,
  verifyCronAuth: () => true,
});

// Now we can require the modules under test
const conv = require(aliasPath("lib/google-ads-conversions.ts"));
const autoPauseRoute = require(aliasPath("app/api/cron/google-ads-auto-pause/route.ts"));

// ── Tests ────────────────────────────────────────────────────────────────────

(async () => {

await suite("toGoogleDateString", async () => {
  await test("formats Date as YYYY-MM-DD HH:mm:ss+00:00", () => {
    const d = new Date("2026-05-25T14:32:18Z");
    expect(conv.toGoogleDateString(d)).toBe("2026-05-25 14:32:18+00:00");
  });
  await test("pads single-digit components", () => {
    const d = new Date("2026-01-05T03:07:09Z");
    expect(conv.toGoogleDateString(d)).toBe("2026-01-05 03:07:09+00:00");
  });
});

await suite("uploadClickConversion — refuses without env config", async () => {
  await test("missing GOOGLE_ADS_CONVERSION_ACTION_RESOURCE → failed/typed error", async () => {
    delete process.env["GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"];
    const r = await conv.uploadClickConversion({
      gclid: "x", conversionDateTime: "2026-01-01 00:00:00+00:00",
      conversionValue: 100, orderId: "LS-1",
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("failed");
    expect(r.error || "").toContain("GOOGLE_ADS_CONVERSION_ACTION_RESOURCE");
  });
});

await suite("uploadClickConversion — env configured", async () => {
  process.env["GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"] = "customers/1234567890/conversionActions/9999";
  await test("posts to uploadClickConversions endpoint with the right shape", async () => {
    googleAdsCalls.length = 0;
    const r = await conv.uploadClickConversion({
      gclid: "Cj0KCQiAtest123",
      conversionDateTime: "2026-05-25 14:32:18+00:00",
      conversionValue: 175,
      orderId: "LS-42",
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe("uploaded");
    expect(googleAdsCalls.length).toBe(1);
    expect(googleAdsCalls[0].url).toMatch(/^customers\/1234567890:uploadClickConversions$/);
    expect(googleAdsCalls[0].method).toBe("POST");
    const body = googleAdsCalls[0].body as { conversions: Array<{ gclid: string; conversionAction: string; conversionValue: number; currencyCode: string; orderId: string }> };
    expect(body.conversions.length).toBe(1);
    expect(body.conversions[0].gclid).toBe("Cj0KCQiAtest123");
    expect(body.conversions[0].conversionAction).toBe("customers/1234567890/conversionActions/9999");
    expect(body.conversions[0].conversionValue).toBe(175);
    expect(body.conversions[0].currencyCode).toBe("GBP");
    expect(body.conversions[0].orderId).toBe("LS-42");
  });
  await test("malformed env → typed error", async () => {
    process.env["GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"] = "garbage";
    const r = await conv.uploadClickConversion({
      gclid: "x", conversionDateTime: "2026-01-01 00:00:00+00:00",
      conversionValue: 100, orderId: "LS-1",
    });
    expect(r.ok).toBe(false);
    expect(r.error || "").toContain("Malformed");
    process.env["GOOGLE_ADS_CONVERSION_ACTION_RESOURCE"] = "customers/1234567890/conversionActions/9999";
  });
});

// ── Job-level wrapper: eligibility & idempotency ────────────────────────────

await suite("uploadJobConversionIfEligible — eligibility rules", async () => {
  await test("Job without gclid → skipped_no_gclid (no Google call)", async () => {
    googleAdsCalls.length = 0;
    tables.job.set("job_no_gclid", {
      id: "job_no_gclid",
      jobNumber: "LS-100",
      gclid: null,
      status: "COMPLETED",
      assessmentPaid: true,
      assessmentFee: 29,
      workCompletedAt: new Date(),
    });
    const r = await conv.uploadJobConversionIfEligible("job_no_gclid");
    expect(r.status).toBe("skipped_no_gclid");
    expect(googleAdsCalls.length).toBe(0);
    const persisted = tables.job.get("job_no_gclid");
    expect((persisted as unknown as { conversionUploadStatus: string }).conversionUploadStatus).toBe("skipped_no_gclid");
  });

  await test("Job with gclid → uploads with revenue from quote", async () => {
    googleAdsCalls.length = 0;
    tables.quote.set("q1", { id: "q1", totalAmount: 250, status: "PAID" });
    tables.job.set("job_with_gclid", {
      id: "job_with_gclid",
      jobNumber: "LS-101",
      gclid: "Cj0KCQiAjobtest",
      quoteId: "q1",
      status: "COMPLETED",
      assessmentPaid: true,
      assessmentFee: 29,
      workCompletedAt: new Date("2026-05-25T14:32:18Z"),
    });
    const r = await conv.uploadJobConversionIfEligible("job_with_gclid");
    expect(r.ok).toBe(true);
    expect(r.status).toBe("uploaded");
    expect(googleAdsCalls.length).toBe(1);
    const body = googleAdsCalls[0].body as { conversions: Array<{ conversionValue: number; orderId: string }> };
    expect(body.conversions[0].conversionValue).toBe(250);
    expect(body.conversions[0].orderId).toBe("LS-101");
  });

  await test("Re-firing the same Job → skipped_already_uploaded", async () => {
    googleAdsCalls.length = 0;
    const r = await conv.uploadJobConversionIfEligible("job_with_gclid");
    expect(r.status).toBe("skipped_already_uploaded");
    expect(googleAdsCalls.length).toBe(0);
  });

  await test("Job not found → failed", async () => {
    const r = await conv.uploadJobConversionIfEligible("does_not_exist");
    expect(r.ok).toBe(false);
    expect(r.status).toBe("failed");
  });
});

// ── Auto-pause cron decision matrix ─────────────────────────────────────────

await suite("Auto-pause cron — decision matrix", async () => {
  // Reset tables — Google Ads campaigns live in GoogleAdsCampaignDraft,
  // performance snapshots use platform="google" + googleCampaignId.
  tables.job.clear();
  tables.googleAdsCampaignDraft.clear();
  tables.adPerformanceSnapshot.clear();
  tables.quote.clear();
  telegramAlerts.length = 0; googleAdsCalls.length = 0;

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  // Campaign A: spent £50, produced 1 completed job → costPerComplete=£50 → PAUSE
  tables.googleAdsCampaignDraft.set("camp_a", {
    id: "camp_a", name: "Reading Emergency", status: "PUBLISHED",
    googleCampaignId: "g_a", account: { customerId: "1234567890" },
  });
  tables.adPerformanceSnapshot.set("snap_a", {
    id: "snap_a", platform: "google", googleCampaignId: "g_a",
    date: twoDaysAgo, spend: 50,
  });
  tables.quote.set("q_a", { id: "q_a", totalAmount: 175 });
  tables.job.set("job_a", {
    id: "job_a", jobNumber: "LS-A", utmCampaign: "reading_emergency",
    status: "COMPLETED", assessmentPaid: true, quoteId: "q_a", createdAt: twoDaysAgo,
  });

  // Campaign B: spent £100, 5 bookings but ZERO completed → PAUSE (vanity pattern)
  tables.googleAdsCampaignDraft.set("camp_b", {
    id: "camp_b", name: "MK Lockout", status: "PUBLISHED",
    googleCampaignId: "g_b", account: { customerId: "1234567890" },
  });
  tables.adPerformanceSnapshot.set("snap_b", {
    id: "snap_b", platform: "google", googleCampaignId: "g_b",
    date: twoDaysAgo, spend: 100,
  });
  for (let i = 0; i < 5; i++) {
    tables.job.set(`job_b_${i}`, {
      id: `job_b_${i}`, jobNumber: `LS-B${i}`, utmCampaign: "mk_lockout",
      status: "PENDING", assessmentPaid: false, createdAt: twoDaysAgo,
    });
  }

  // Campaign C: under MIN_SPEND_GBP (£20) — don't pause yet
  tables.googleAdsCampaignDraft.set("camp_c", {
    id: "camp_c", name: "Coventry Trust", status: "PUBLISHED",
    googleCampaignId: "g_c", account: { customerId: "1234567890" },
  });
  tables.adPerformanceSnapshot.set("snap_c", {
    id: "snap_c", platform: "google", googleCampaignId: "g_c",
    date: twoDaysAgo, spend: 20,
  });

  // Campaign D: spent £150, completed 10 jobs → KEEP
  tables.googleAdsCampaignDraft.set("camp_d", {
    id: "camp_d", name: "Derby Anti Snap", status: "PUBLISHED",
    googleCampaignId: "g_d", account: { customerId: "1234567890" },
  });
  tables.adPerformanceSnapshot.set("snap_d", {
    id: "snap_d", platform: "google", googleCampaignId: "g_d",
    date: twoDaysAgo, spend: 150,
  });
  tables.quote.set("q_d", { id: "q_d", totalAmount: 200 });
  for (let i = 0; i < 10; i++) {
    tables.job.set(`job_d_${i}`, {
      id: `job_d_${i}`, jobNumber: `LS-D${i}`, utmCampaign: "derby_anti_snap",
      status: "COMPLETED", assessmentPaid: true, quoteId: "q_d", createdAt: twoDaysAgo,
    });
  }

  await test("runs and returns verdicts for all active campaigns", async () => {
    const req = new Request("https://example.com/api/cron/google-ads-auto-pause", { method: "POST" }) as unknown as import("next/server").NextRequest;
    const res = await autoPauseRoute.POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.evaluated).toBe(4);
  });

  await test("Campaign A (over cost-per-complete threshold) paused", () => {
    const a = tables.googleAdsCampaignDraft.get("camp_a");
    expect((a as unknown as { status: string }).status).toBe("PAUSED");
  });

  await test("Campaign B (vanity conversions) paused", () => {
    const b = tables.googleAdsCampaignDraft.get("camp_b");
    expect((b as unknown as { status: string }).status).toBe("PAUSED");
  });

  await test("Campaign C (under MIN_SPEND) NOT paused", () => {
    const c = tables.googleAdsCampaignDraft.get("camp_c");
    expect((c as unknown as { status: string }).status).toBe("PUBLISHED");
  });

  await test("Campaign D (healthy ROI) NOT paused", () => {
    const d = tables.googleAdsCampaignDraft.get("camp_d");
    expect((d as unknown as { status: string }).status).toBe("PUBLISHED");
  });

  await test("Telegram alerts fired for paused campaigns (2 of 4)", () => {
    expect(telegramAlerts.length).toBe(2);
    const allAlerts = telegramAlerts.map((a) => `${a.title}\n${a.message}`).join("\n\n");
    expect(allAlerts).toContain("Reading Emergency");
    expect(allAlerts).toContain("MK Lockout");
  });

  await test("Google Ads mutate called to pause remote (2 of 4)", () => {
    const mutateCalls = googleAdsCalls.filter((c) => c.url.includes("campaigns:mutate"));
    expect(mutateCalls.length).toBe(2);
  });

  await test("dryRun=1 evaluates but does NOT pause or alert", async () => {
    // Reset campaign A back to PUBLISHED (the active state for Google Ads drafts)
    const a = tables.googleAdsCampaignDraft.get("camp_a") as unknown as { status: string };
    a.status = "PUBLISHED";
    telegramAlerts.length = 0; googleAdsCalls.length = 0;
    const req = new Request("https://example.com/api/cron/google-ads-auto-pause?dryRun=1", { method: "POST" }) as unknown as import("next/server").NextRequest;
    const res = await autoPauseRoute.POST(req);
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(json.paused).toBeGreaterThan(0);  // verdict counted
    expect((tables.googleAdsCampaignDraft.get("camp_a") as unknown as { status: string }).status).toBe("PUBLISHED");
    expect(telegramAlerts.length).toBe(0);
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
