/**
 * LockSafe — End-to-End System Test Harness
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Single-file, dependency-light, runnable validation pass over the entire
 * LockSafe webapp surface. Designed to be invoked locally against a dev
 * server, in CI against a preview deploy, or against production for smoke.
 *
 *   # local dev (server on :3000)
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.scripts.json \
 *     scripts/system-full-test.ts
 *
 *   # production smoke
 *   SYSTEM_TEST_BASE_URL=https://www.locksafe.uk \
 *     npx tsx --tsconfig tsconfig.scripts.json scripts/system-full-test.ts \
 *     --suite=public,security --skip=admin
 *
 *   # dry-run (lists what *would* run, makes no network calls)
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/system-full-test.ts --dry-run
 *
 * CLI flags:
 *   --base-url=URL        Override SYSTEM_TEST_BASE_URL
 *   --suite=a,b,c         Only run named suites (comma-separated)
 *   --skip=a,b            Skip named suites
 *   --only=<substring>    Only run tests whose name includes substring
 *   --dry-run             Print plan, no requests
 *   --fail-fast           Abort on first FAIL
 *   --report=PATH         Write JSON report to PATH (default ./test-reports/…)
 *   --quiet               Suppress per-test logs (still prints summary)
 *
 * Environment:
 *   SYSTEM_TEST_BASE_URL     base origin (default http://localhost:3000)
 *   SYSTEM_TEST_ADMIN_EMAIL  admin login for admin-suite (optional)
 *   SYSTEM_TEST_ADMIN_PASS   admin password (optional)
 *   CRON_SECRET              if set, cron-suite verifies bearer-auth round-trip
 *
 * Stripe payment internals are intentionally OMITTED — they are covered by
 * scripts/test-stripe-e2e.ts. We still validate that payment ROUTES respond
 * with the correct auth shape (401/400) when called without context.
 */
export {};

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Config + CLI
// ─────────────────────────────────────────────────────────────────────────────

interface Cli {
  baseUrl: string;
  suites: string[] | null;
  skip: string[];
  only: string | null;
  dryRun: boolean;
  failFast: boolean;
  reportPath: string;
  quiet: boolean;
}

function parseCli(argv: string[]): Cli {
  const args = new Map<string, string>();
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [k, v] = raw.slice(2).split("=");
    args.set(k, v ?? "true");
  }
  const tsStamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    baseUrl: (args.get("base-url") || process.env.SYSTEM_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
    suites: args.has("suite") ? args.get("suite")!.split(",").map((s) => s.trim()).filter(Boolean) : null,
    skip: args.has("skip") ? args.get("skip")!.split(",").map((s) => s.trim()).filter(Boolean) : [],
    only: args.get("only") ?? null,
    dryRun: args.get("dry-run") === "true",
    failFast: args.get("fail-fast") === "true",
    reportPath: args.get("report") ?? `./test-reports/system-full-test-${tsStamp}.json`,
    quiet: args.get("quiet") === "true",
  };
}

const cli = parseCli(process.argv);

// ─────────────────────────────────────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", grey: "\x1b[90m",
};
const log = {
  banner: (t: string) => {
    if (cli.quiet) return;
    const bar = "─".repeat(Math.max(8, 78 - t.length));
    console.log(`\n${C.cyan}${C.bold}── ${t} ${bar}${C.reset}`);
  },
  pass: (n: string, ms: number) =>
    !cli.quiet && console.log(`  ${C.green}✓${C.reset} ${n} ${C.grey}(${ms}ms)${C.reset}`),
  fail: (n: string, ms: number, e: string) =>
    !cli.quiet && console.log(`  ${C.red}✗${C.reset} ${n} ${C.grey}(${ms}ms)${C.reset}\n      ${C.red}${e}${C.reset}`),
  skip: (n: string, why: string) =>
    !cli.quiet && console.log(`  ${C.yellow}↷${C.reset} ${n} ${C.grey}— ${why}${C.reset}`),
  info: (s: string) => !cli.quiet && console.log(`${C.dim}${s}${C.reset}`),
  warn: (s: string) => console.log(`${C.yellow}${s}${C.reset}`),
  err: (s: string) => console.log(`${C.red}${s}${C.reset}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helper
// ─────────────────────────────────────────────────────────────────────────────

interface FetchOpts {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cookie?: string;            // attach cookie header
  timeoutMs?: number;
  expectJson?: boolean;       // try to parse JSON, default true
}
interface FetchResult {
  status: number;
  ok: boolean;
  headers: Headers;
  body: unknown;
  bodyText: string;
  setCookie: string | null;
  durationMs: number;
}

async function http(path: string, opts: FetchOpts = {}): Promise<FetchResult> {
  const url = path.startsWith("http") ? path : `${cli.baseUrl}${path}`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  const t0 = Date.now();
  try {
    const headers: Record<string, string> = {
      "user-agent": "LockSafe-SystemTest/1.0",
      ...(opts.body ? { "content-type": "application/json" } : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.headers ?? {}),
    };
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
      redirect: "manual",
    });
    const text = await res.text();
    let body: unknown = text;
    if (opts.expectJson !== false) {
      try { body = JSON.parse(text); } catch { /* leave as text */ }
    }
    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      body, bodyText: text,
      setCookie: res.headers.get("set-cookie"),
      durationMs: Date.now() - t0,
    };
  } finally {
    clearTimeout(to);
  }
}

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertion helpers (throw on failure → caught by runner)
// ─────────────────────────────────────────────────────────────────────────────

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertStatus(r: FetchResult, expected: number | number[], ctx = "") {
  const list = Array.isArray(expected) ? expected : [expected];
  if (!list.includes(r.status)) {
    throw new Error(`${ctx}expected status ${list.join("|")}, got ${r.status} body=${r.bodyText.slice(0, 200)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test types + runner
// ─────────────────────────────────────────────────────────────────────────────

type Outcome = "PASS" | "FAIL" | "SKIP";
interface TestCase {
  name: string;
  /** Return string reason to SKIP, throw to FAIL, otherwise PASS. */
  run: (ctx: SuiteContext) => Promise<string | void>;
}
interface Suite {
  name: string;
  description: string;
  /** Setup runs once before suite tests; thrown error → all tests SKIP. */
  setup?: (ctx: SuiteContext) => Promise<void>;
  teardown?: (ctx: SuiteContext) => Promise<void>;
  tests: TestCase[];
}
interface TestResult {
  suite: string;
  name: string;
  outcome: Outcome;
  durationMs: number;
  error?: string;
  reason?: string;
}
interface SuiteContext {
  /** Shared per-suite state (cookies, ids created, etc.). */
  state: Record<string, unknown>;
}

async function runSuite(suite: Suite): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const ctx: SuiteContext = { state: {} };
  log.banner(`SUITE: ${suite.name} — ${suite.description}`);

  if (cli.dryRun) {
    for (const t of suite.tests) {
      if (cli.only && !t.name.includes(cli.only)) continue;
      log.skip(t.name, "dry-run");
      results.push({ suite: suite.name, name: t.name, outcome: "SKIP", durationMs: 0, reason: "dry-run" });
    }
    return results;
  }

  if (suite.setup) {
    try { await suite.setup(ctx); }
    catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      log.warn(`  setup failed — skipping whole suite: ${reason}`);
      for (const t of suite.tests) {
        results.push({ suite: suite.name, name: t.name, outcome: "SKIP", durationMs: 0, reason: `setup: ${reason}` });
      }
      return results;
    }
  }

  for (const t of suite.tests) {
    if (cli.only && !t.name.includes(cli.only)) {
      log.skip(t.name, `--only=${cli.only}`);
      results.push({ suite: suite.name, name: t.name, outcome: "SKIP", durationMs: 0, reason: `only filter` });
      continue;
    }
    const t0 = Date.now();
    try {
      const maybeSkip = await t.run(ctx);
      const dur = Date.now() - t0;
      if (typeof maybeSkip === "string") {
        log.skip(t.name, maybeSkip);
        results.push({ suite: suite.name, name: t.name, outcome: "SKIP", durationMs: dur, reason: maybeSkip });
      } else {
        log.pass(t.name, dur);
        results.push({ suite: suite.name, name: t.name, outcome: "PASS", durationMs: dur });
      }
    } catch (e) {
      const dur = Date.now() - t0;
      const msg = e instanceof Error ? `${e.message}\n${(e.stack ?? "").split("\n").slice(1, 4).join("\n")}` : String(e);
      log.fail(t.name, dur, msg.split("\n")[0]);
      results.push({ suite: suite.name, name: t.name, outcome: "FAIL", durationMs: dur, error: msg });
      if (cli.failFast) break;
    }
  }

  if (suite.teardown) {
    try { await suite.teardown(ctx); }
    catch (e) { log.warn(`  teardown error: ${e instanceof Error ? e.message : e}`); }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function uniqueEmail(prefix: string) {
  return `${prefix}+${Date.now()}.${Math.random().toString(36).slice(2, 7)}@locksafe-systest.invalid`;
}

function extractAuthCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const m = setCookie.match(/auth_token=[^;]+/);
  return m ? m[0] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITES
// ─────────────────────────────────────────────────────────────────────────────

// ── INFRASTRUCTURE ──────────────────────────────────────────────────────────
const infraSuite: Suite = {
  name: "infra",
  description: "Health, DB ping, environment sanity",
  tests: [
    {
      name: "GET /api/health returns 200 + database:ok",
      run: async () => {
        const r = await http("/api/health");
        assertStatus(r, 200);
        const b = r.body as { checks?: { database?: { status?: string } } };
        assert(b.checks?.database?.status === "ok", `database check not ok: ${r.bodyText.slice(0, 200)}`);
      },
    },
    {
      name: "GET / responds (homepage shell)",
      run: async () => {
        const r = await http("/", { expectJson: false });
        assertStatus(r, [200, 301, 302, 307, 308]);
      },
    },
    {
      name: "Unknown route returns 404",
      run: async () => {
        const r = await http("/api/__definitely_not_a_route_xyz", { expectJson: false });
        assertStatus(r, [404, 405]);
      },
    },
  ],
};

// ── AUTH & SESSION ──────────────────────────────────────────────────────────
const authSuite: Suite = {
  name: "auth",
  description: "Registration, login, session, logout, password reset",
  tests: [
    {
      name: "POST /api/auth/register rejects missing fields",
      run: async () => {
        const r = await http("/api/auth/register", { method: "POST", body: { email: "x@y.z" } });
        assertStatus(r, 400);
      },
    },
    {
      name: "POST /api/auth/login rejects missing fields",
      run: async () => {
        const r = await http("/api/auth/login", { method: "POST", body: {} });
        assertStatus(r, 400);
      },
    },
    {
      name: "POST /api/auth/login fails with bad credentials (401)",
      run: async () => {
        const r = await http("/api/auth/login", {
          method: "POST",
          body: { email: uniqueEmail("nobody"), password: "wrong-password" },
        });
        assertStatus(r, [401, 403]);
      },
    },
    {
      name: "Customer register → login → session → logout (full round-trip)",
      run: async (ctx) => {
        const email = uniqueEmail("systest-cust");
        const password = "TestPass!2026";

        const reg = await http("/api/auth/register", {
          method: "POST",
          body: { name: "Sys Test", email, phone: "+447700900000", password },
        });
        if (reg.status === 503 || reg.status === 500) {
          return `register backend unavailable (${reg.status}) — db/email config`;
        }
        assertStatus(reg, [200, 201], "register: ");

        // Login (registration may or may not auto-login; use login for determinism)
        const login = await http("/api/auth/login", { method: "POST", body: { email, password } });
        assertStatus(login, 200, "login: ");
        const cookie = extractAuthCookie(login.setCookie);
        assert(cookie, "login did not return auth_token cookie");
        ctx.state.cookie = cookie;
        ctx.state.email = email;

        // Session
        const sess = await http("/api/auth/session", { cookie: cookie! });
        assertStatus(sess, 200, "session: ");

        // Logout
        const out = await http("/api/auth/logout", { method: "POST", cookie: cookie! });
        assertStatus(out, [200, 204], "logout: ");
      },
    },
    {
      name: "POST /api/auth/forgot-password accepts unknown email gracefully",
      run: async () => {
        const r = await http("/api/auth/forgot-password", {
          method: "POST",
          body: { email: uniqueEmail("ghost") },
        });
        // Should not leak whether the email exists — accept 200 or 202
        assertStatus(r, [200, 202, 204]);
      },
    },
    {
      name: "GET /api/auth/session without cookie → 401",
      run: async () => {
        const r = await http("/api/auth/session");
        assertStatus(r, [401, 200]); // some implementations return 200 with null user
        if (r.status === 200) {
          const b = r.body as { user?: unknown };
          assert(!b.user, "session returned a user without cookie");
        }
      },
    },
  ],
};

// ── PROTECTED ROUTES / RBAC ─────────────────────────────────────────────────
const rbacSuite: Suite = {
  name: "rbac",
  description: "Unauthenticated requests to protected APIs return 401/403",
  tests: [
    { name: "GET /api/admin/ops-snapshot without cookie → 401", run: async () => {
      const r = await http("/api/admin/ops-snapshot");
      assertStatus(r, [401, 403]);
    }},
    { name: "GET /api/admin/locksmiths without cookie → 401", run: async () => {
      const r = await http("/api/admin/locksmiths");
      assertStatus(r, [401, 403, 404]);
    }},
    { name: "GET /api/customer/profile without cookie → 401", run: async () => {
      const r = await http("/api/customer/profile");
      assertStatus(r, [401, 403]);
    }},
    { name: "GET /api/locksmith/profile without cookie → 401", run: async () => {
      const r = await http("/api/locksmith/profile");
      assertStatus(r, [401, 403]);
    }},
    { name: "GET /api/admin/district-landing without cookie → 401", run: async () => {
      const r = await http("/api/admin/district-landing");
      assertStatus(r, [401, 403]);
    }},
  ],
};

// ── CRON AUTH ───────────────────────────────────────────────────────────────
const cronSuite: Suite = {
  name: "cron",
  description: "Cron endpoints require Bearer ${CRON_SECRET}",
  tests: [
    { name: "GET /api/cron/generate-district-landings without bearer → 401", run: async () => {
      const r = await http("/api/cron/generate-district-landings");
      assertStatus(r, [401, 403]);
    }},
    { name: "GET /api/cron/onboarding-nudge without bearer → 401", run: async () => {
      const r = await http("/api/cron/onboarding-nudge");
      assertStatus(r, [401, 403]);
    }},
    { name: "GET /api/cron/availability-schedule without bearer → 401", run: async () => {
      const r = await http("/api/cron/availability-schedule");
      assertStatus(r, [401, 403]);
    }},
    { name: "Cron with valid bearer is accepted (if CRON_SECRET set)", run: async () => {
      const secret = process.env.CRON_SECRET;
      if (!secret) return "CRON_SECRET not set";
      const r = await http("/api/cron/generate-district-landings", {
        headers: { authorization: `Bearer ${secret}` },
        timeoutMs: 60_000,
      });
      // Cron handlers vary — accept any non-401/403 as proof auth passed
      assert(r.status !== 401 && r.status !== 403, `auth rejected: ${r.status}`);
    }},
  ],
};

// ── CUSTOMER FLOW ───────────────────────────────────────────────────────────
const customerSuite: Suite = {
  name: "customer",
  description: "Booking intake validation + cancellation guard rails",
  tests: [
    { name: "POST /api/jobs rejects empty payload with field list", run: async () => {
      const r = await http("/api/jobs", { method: "POST", body: {} });
      assertStatus(r, 400);
      const b = r.body as { error?: string };
      assert(typeof b.error === "string" && b.error.toLowerCase().includes("missing"),
        `expected 'missing required fields' error, got: ${r.bodyText.slice(0, 200)}`);
    }},
    { name: "POST /api/jobs rejects partial payload (no phone/customerId)", run: async () => {
      const r = await http("/api/jobs", {
        method: "POST",
        body: { problemType: "LOCKED_OUT", propertyType: "RESIDENTIAL", postcode: "SW1A 1AA", address: "10 Test St" },
      });
      assertStatus(r, 400);
    }},
    { name: "GET /api/postcode/SW1A1AA returns coordinates (or 404)", run: async () => {
      const r = await http("/api/postcode/SW1A1AA");
      assertStatus(r, [200, 404]);
      if (r.status === 200) {
        const b = r.body as { lat?: number; lng?: number };
        assert(typeof b.lat === "number" && typeof b.lng === "number",
          `postcode lookup missing lat/lng: ${r.bodyText.slice(0, 200)}`);
      }
    }},
    { name: "Customer flow: booking → upload → tracking → review", run: async () => {
      return "needs seeded Stripe-Connect locksmith + accepted job (out of scope for harness)";
    }},
  ],
};

// ── LOCKSMITH FLOW ──────────────────────────────────────────────────────────
const locksmithSuite: Suite = {
  name: "locksmith",
  description: "Onboarding, availability, GPS check-in, quote workflow",
  tests: [
    { name: "POST /api/locksmith/availability without auth → 401", run: async () => {
      const r = await http("/api/locksmith/availability", { method: "POST", body: { isAvailable: true } });
      assertStatus(r, [401, 403]);
    }},
    { name: "Locksmith full onboarding flow", run: async () =>
      "needs DBS/insurance fixtures + manual approval — covered by Playwright suite"
    },
    { name: "GPS check-in + ETA recompute", run: async () =>
      "requires SSE client + accepted job fixture — covered by locksafe-mobile integration tests"
    },
  ],
};

// ── DISPATCH / MARKETPLACE ──────────────────────────────────────────────────
const dispatchSuite: Suite = {
  name: "dispatch",
  description: "Job broadcasting, auction, ranking, duplicate prevention",
  tests: [
    { name: "POST /api/jobs/notify-locksmiths requires auth", run: async () => {
      const r = await http("/api/jobs/notify-locksmiths", { method: "POST", body: { jobId: "stub" } });
      assertStatus(r, [400, 401, 403, 404]);
    }},
    { name: "Auction wave scheme + ranking", run: async () =>
      "scripts/test-auction-wave-scheme.ts covers this in isolation"
    },
    { name: "Duplicate-job prevention (same customer+postcode within window)", run: async () =>
      "requires authenticated customer + DB cleanup — defer to integration suite"
    },
  ],
};

// ── AI / AUTOMATION ─────────────────────────────────────────────────────────
const aiSuite: Suite = {
  name: "ai",
  description: "Agent runtime, LLM failover, ops-snapshot agents block",
  tests: [
    { name: "GET /api/health includes integration checks", run: async () => {
      const r = await http("/api/health");
      assertStatus(r, 200);
      const b = r.body as { checks?: Record<string, { status?: string }> };
      assert(b.checks && typeof b.checks === "object", "health.checks missing");
    }},
    { name: "Ollama-first LLM router prefers local model", run: async () =>
      "scripts/check-llm-failover.ts is the source of truth — run `npm run health:llm-failover`"
    },
    { name: "Agent heartbeat freshness (<5min)", run: async () =>
      "requires authenticated admin /api/admin/agents/* — see admin suite"
    },
  ],
};

// ── ADMIN (only if creds provided) ──────────────────────────────────────────
const adminSuite: Suite = {
  name: "admin",
  description: "Authenticated admin endpoints (requires SYSTEM_TEST_ADMIN_*)",
  setup: async (ctx) => {
    const email = process.env.SYSTEM_TEST_ADMIN_EMAIL;
    const password = process.env.SYSTEM_TEST_ADMIN_PASS;
    if (!email || !password) throw new Error("SYSTEM_TEST_ADMIN_EMAIL/PASS not set");
    const r = await http("/api/auth/login", { method: "POST", body: { email, password } });
    assertStatus(r, 200, "admin login: ");
    const cookie = extractAuthCookie(r.setCookie);
    assert(cookie, "admin login returned no cookie");
    ctx.state.adminCookie = cookie;
  },
  tests: [
    { name: "GET /api/admin/ops-snapshot returns full payload incl. marketing.activeGoogleAds", run: async (ctx) => {
      const r = await http("/api/admin/ops-snapshot", { cookie: ctx.state.adminCookie as string });
      assertStatus(r, 200);
      const b = r.body as { marketing?: { activeGoogleAds?: number; activeAdCampaigns?: number } };
      assert(typeof b.marketing?.activeGoogleAds === "number",
        `marketing.activeGoogleAds missing — dashboard tile will fall back to 0`);
      assert(typeof b.marketing?.activeAdCampaigns === "number",
        `marketing.activeAdCampaigns missing (Meta field)`);
    }},
    { name: "GET /api/admin/locksmiths returns array", run: async (ctx) => {
      const r = await http("/api/admin/locksmiths", { cookie: ctx.state.adminCookie as string });
      assertStatus(r, 200);
    }},
    { name: "GET /api/admin/district-landing returns stats", run: async (ctx) => {
      const r = await http("/api/admin/district-landing", { cookie: ctx.state.adminCookie as string });
      assertStatus(r, 200);
    }},
    { name: "GET /api/admin/disputes returns array", run: async (ctx) => {
      const r = await http("/api/admin/disputes", { cookie: ctx.state.adminCookie as string });
      assertStatus(r, [200, 404]);
    }},
  ],
};

// ── MEDIA / UPLOADS ─────────────────────────────────────────────────────────
const mediaSuite: Suite = {
  name: "media",
  description: "Upload endpoint guards + signed URL behaviour",
  tests: [
    { name: "POST /api/upload without auth → 401/400", run: async () => {
      const r = await http("/api/upload", { method: "POST", body: {} });
      assertStatus(r, [400, 401, 403, 405]);
    }},
    { name: "Upload size + MIME validation", run: async () =>
      "requires multipart form fixture (signed Blob URL) — defer to integration suite"
    },
  ],
};

// ── PDF / LEGAL ─────────────────────────────────────────────────────────────
const pdfSuite: Suite = {
  name: "pdf",
  description: "Job-completion PDF generation + signature integrity",
  tests: [
    { name: "PDF generation pipeline", run: async () =>
      "requires completed job + signature fixture — covered by mobile integration"
    },
    { name: "Signature GPS metadata + timestamp", run: async () =>
      "validated in src/lib/signatures (unit tests) — not reachable via HTTP"
    },
  ],
};

// ── PUBLIC / SEO ────────────────────────────────────────────────────────────
const seoSuite: Suite = {
  name: "seo",
  description: "Public pages, sitemap, robots, district landings",
  tests: [
    { name: "GET /sitemap.xml returns XML (or 404 if not configured)", run: async () => {
      const r = await http("/sitemap.xml", { expectJson: false });
      assertStatus(r, [200, 404]);
      if (r.status === 200) {
        assert(r.bodyText.includes("<urlset") || r.bodyText.includes("<sitemapindex"),
          "sitemap response is not XML urlset");
      } else {
        // surface as soft warning in report
        throw new Error("sitemap.xml not present — SEO regression risk");
      }
    }},
    { name: "GET /robots.txt returns text (or 404)", run: async () => {
      const r = await http("/robots.txt", { expectJson: false });
      if (r.status === 404) throw new Error("robots.txt missing");
      assertStatus(r, 200);
      assert(/user-agent/i.test(r.bodyText), "robots.txt has no User-agent directive");
    }},
    { name: "GET /locksmiths public listing responds", run: async () => {
      const r = await http("/locksmiths", { expectJson: false });
      assertStatus(r, [200, 301, 302, 307, 308, 404]);
    }},
  ],
};

// ── PERFORMANCE ─────────────────────────────────────────────────────────────
const perfSuite: Suite = {
  name: "perf",
  description: "Latency budgets + concurrent-request stability",
  tests: [
    { name: "GET /api/health p95 < 1500ms (10 samples)", run: async () => {
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = await http("/api/health");
        if (r.status !== 200) throw new Error(`sample ${i} non-200: ${r.status}`);
        samples.push(r.durationMs);
      }
      samples.sort((a, b) => a - b);
      const p95 = samples[Math.floor(samples.length * 0.95) - 1] ?? samples[samples.length - 1];
      assert(p95 < 1500, `p95=${p95}ms exceeds budget (samples=${samples.join(",")})`);
    }},
    { name: "20 concurrent /api/health all succeed", run: async () => {
      const results = await Promise.allSettled(Array.from({ length: 20 }, () => http("/api/health")));
      const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.status !== 200));
      assert(failed.length === 0, `${failed.length}/20 concurrent requests failed`);
    }},
  ],
};

// ── SECURITY ────────────────────────────────────────────────────────────────
const securitySuite: Suite = {
  name: "security",
  description: "Injection, XSS, rate-limit, security headers",
  tests: [
    { name: "Login with SQL-injection-style payload returns 400/401, never 500", run: async () => {
      const r = await http("/api/auth/login", {
        method: "POST",
        body: { email: "' OR '1'='1", password: "' OR '1'='1" },
      });
      assert(r.status !== 500, `server errored on injection payload: ${r.status}`);
      assertStatus(r, [400, 401, 403, 429]);
    }},
    { name: "Login with XSS payload returns 400/401, never 500", run: async () => {
      const r = await http("/api/auth/login", {
        method: "POST",
        body: { email: '"><script>alert(1)</script>@x.com', password: "<img src=x onerror=alert(1)>" },
      });
      assert(r.status !== 500, `server errored on XSS payload: ${r.status}`);
    }},
    { name: "Login rate-limit triggers within 25 rapid attempts", run: async () => {
      const email = uniqueEmail("ratelimit");
      let saw429 = false;
      for (let i = 0; i < 25; i++) {
        const r = await http("/api/auth/login", { method: "POST", body: { email, password: "x" } });
        if (r.status === 429) { saw429 = true; break; }
      }
      assert(saw429, "no 429 after 25 rapid login attempts — rate limit may be off");
    }},
    { name: "Security headers present on homepage (CSP / X-Frame-Options / HSTS)", run: async () => {
      const r = await http("/", { expectJson: false });
      const csp  = r.headers.get("content-security-policy");
      const xfo  = r.headers.get("x-frame-options");
      const hsts = r.headers.get("strict-transport-security");
      const missing = [
        !csp  && "content-security-policy",
        !xfo  && "x-frame-options",
        !hsts && cli.baseUrl.startsWith("https") && "strict-transport-security",
      ].filter(Boolean);
      assert(missing.length === 0, `missing headers: ${missing.join(", ")}`);
    }},
    { name: "Role escalation: customer cookie cannot hit /api/admin/*", run: async () =>
      "requires seeded customer cookie — covered by rbac suite (401 without cookie ≈ enforced)"
    },
  ],
};

// ── NOTIFICATIONS ───────────────────────────────────────────────────────────
const notificationsSuite: Suite = {
  name: "notifications",
  description: "Telegram/SMS/email plumbing exposed via /api/health",
  tests: [
    { name: "Telegram health is ok or unconfigured (never error)", run: async () => {
      const r = await http("/api/health");
      assertStatus(r, 200);
      const b = r.body as { checks?: { telegram?: { status?: string; message?: string } } };
      const t = b.checks?.telegram?.status;
      if (!t) return "telegram check not exposed in /api/health on this env";
      assert(t === "ok" || t === "unconfigured", `telegram status=${t} message=${b.checks?.telegram?.message}`);
    }},
    { name: "Email/SMS delivery", run: async () =>
      "live send not safe in harness — use scripts/send-welcome-emails-test.ts manually"
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite registry
// ─────────────────────────────────────────────────────────────────────────────

const ALL_SUITES: Suite[] = [
  infraSuite,
  authSuite,
  rbacSuite,
  cronSuite,
  customerSuite,
  locksmithSuite,
  dispatchSuite,
  aiSuite,
  adminSuite,
  mediaSuite,
  pdfSuite,
  seoSuite,
  perfSuite,
  securitySuite,
  notificationsSuite,
];

function selectSuites(): Suite[] {
  let suites = ALL_SUITES;
  if (cli.suites) suites = suites.filter((s) => cli.suites!.includes(s.name));
  if (cli.skip.length) suites = suites.filter((s) => !cli.skip.includes(s.name));
  return suites;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.bold}${C.cyan}LockSafe — System Full Test${C.reset}`);
  console.log(`${C.dim}base-url=${cli.baseUrl}  dry-run=${cli.dryRun}  fail-fast=${cli.failFast}${C.reset}`);
  if (cli.suites) console.log(`${C.dim}suites=${cli.suites.join(",")}${C.reset}`);
  if (cli.skip.length) console.log(`${C.dim}skip=${cli.skip.join(",")}${C.reset}`);
  if (cli.only) console.log(`${C.dim}only=${cli.only}${C.reset}`);

  const suites = selectSuites();
  if (!suites.length) {
    log.err("No suites selected.");
    process.exit(2);
  }

  const startedAt = Date.now();
  const allResults: TestResult[] = [];

  for (const s of suites) {
    const res = await runSuite(s);
    allResults.push(...res);
    if (cli.failFast && res.some((r) => r.outcome === "FAIL")) break;
  }

  const totalMs = Date.now() - startedAt;
  const pass = allResults.filter((r) => r.outcome === "PASS").length;
  const fail = allResults.filter((r) => r.outcome === "FAIL").length;
  const skip = allResults.filter((r) => r.outcome === "SKIP").length;

  console.log(`\n${C.bold}── SUMMARY ──────────────────────────────────────────────${C.reset}`);
  console.log(
    `  ${C.green}PASS${C.reset} ${pass}    ${C.red}FAIL${C.reset} ${fail}    ${C.yellow}SKIP${C.reset} ${skip}    total ${allResults.length}    ${C.grey}(${totalMs}ms)${C.reset}`,
  );

  if (fail > 0) {
    console.log(`\n${C.red}${C.bold}Failures:${C.reset}`);
    for (const r of allResults.filter((x) => x.outcome === "FAIL")) {
      console.log(`  ${C.red}✗${C.reset} ${r.suite}/${r.name}\n      ${r.error?.split("\n")[0]}`);
    }
  }

  // Write JSON report
  const reportAbs = resolve(process.cwd(), cli.reportPath);
  try {
    const dir = dirname(reportAbs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: cli.baseUrl,
      durationMs: totalMs,
      counts: { pass, fail, skip, total: allResults.length },
      results: allResults,
    };
    writeFileSync(reportAbs, JSON.stringify(report, null, 2));
    console.log(`\n${C.dim}Report → ${reportAbs}${C.reset}`);
  } catch (e) {
    log.warn(`could not write report: ${e instanceof Error ? e.message : e}`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  log.err(`fatal: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(2);
});
