/**
 * Standalone test runner for the SEMrush/SpyFu replacement stack.
 *
 * Runs without jest (the sandbox can't resolve ts-jest under jest v30).
 * Exercises the EXACT same production code paths a jest test would.
 *
 * Run with:
 *   node_modules/.bin/ts-node --project tsconfig.scripts.json scripts/run-competitor-intel-tests.ts
 */

import {
  parseSponsoredAds,
  parseOrganicDomains,
  extractDomainFromDisplayUrl,
  unwrapGoogleRedirect,
  SerpIntelligenceClient,
} from "../src/lib/serp-intelligence-client";
import {
  detectMla,
  detectDbs,
  detectPpcTracking,
  detectGoogleTagManager,
  extractGoogleAdsIds,
  extractTrustBadges,
  extractPriceAnchors,
  lowestGbpFromAnchors,
  extractServiceAreas,
  CompetitorFingerprintClient,
} from "../src/lib/competitor-fingerprint";
import {
  mergeIntelKeywords,
  extractTopSeeds,
  buildGeoPresenceScores,
  fingerprintMatchesKeyword,
  synonymsOf,
  estimateMonthlyClicks,
  normalise,
  type KeywordPrior,
} from "../src/lib/competitor-cross-validate";
import type { SerpScanResult } from "../src/lib/serp-intelligence-client";
import type { CompetitorFingerprint } from "../src/lib/competitor-fingerprint";

// ── Test runner ──────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  blue: "\x1b[34m", cyan: "\x1b[36m",
};

let passed = 0;
let failed = 0;
const failures: Array<{ suite: string; name: string; detail: string }> = [];
let currentSuite = "";

function suite(name: string, fn: () => void): void {
  currentSuite = name;
  console.log(`\n${C.bold}${C.blue}── ${name}${C.reset}`);
  fn();
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ${C.green}✓${C.reset} ${name}`);
  } catch (err) {
    failed++;
    const detail = err instanceof Error ? err.message : String(err);
    failures.push({ suite: currentSuite, name, detail });
    console.log(`  ${C.red}✗${C.reset} ${name}\n      ${C.dim}${detail}${C.reset}`);
  }
}

// Minimal assertion helpers (jest-style API surface)
function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) throw new Error(`expected null, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== "number" || actual <= n) {
        throw new Error(`expected > ${n}, got ${actual}`);
      }
    },
    toBeGreaterThanOrEqual(n: number) {
      if (typeof actual !== "number" || actual < n) {
        throw new Error(`expected >= ${n}, got ${actual}`);
      }
    },
    toBeCloseTo(expected: number, tol = 0.0001) {
      if (typeof actual !== "number" || Math.abs(actual - expected) > tol) {
        throw new Error(`expected ~${expected} (±${tol}), got ${actual}`);
      }
    },
    toHaveLength(len: number) {
      if (!Array.isArray(actual) || actual.length !== len) {
        throw new Error(`expected length ${len}, got ${Array.isArray(actual) ? actual.length : typeof actual}`);
      }
    },
    toContain(item: unknown) {
      if (!Array.isArray(actual) && typeof actual !== "string") {
        throw new Error(`toContain on non-array/string`);
      }
      if (!(actual as Array<unknown> | string).includes(item as never)) {
        throw new Error(`expected to contain ${JSON.stringify(item)}, got ${JSON.stringify(actual)}`);
      }
    },
    toArrayContain(items: unknown[]) {
      if (!Array.isArray(actual)) throw new Error(`not an array`);
      for (const i of items) {
        if (!(actual as unknown[]).includes(i)) {
          throw new Error(`expected ${JSON.stringify(actual)} to contain ${JSON.stringify(i)}`);
        }
      }
    },
  };
}

// ── Fixture helpers ──────────────────────────────────────────────────────────

const fp = (overrides: Partial<CompetitorFingerprint>): CompetitorFingerprint => ({
  domain: "test.co.uk",
  scannedAt: new Date(),
  httpStatus: 200,
  blocked: false,
  searchableText: "",
  titleKeywords: [], metaKeywords: [], h1Keywords: [],
  serviceAreas: [], hasDedicatedCityPages: false, claimsNationwide: false,
  hasPpcTracking: false, hasGoogleAdsTag: false, hasGoogleTagManager: false, googleAdsIds: [],
  isMlaApproved: false, isDbsChecked: false, hasWhichTrusted: false, trustBadges: [],
  priceAnchors: [], lowestPriceGbp: null,
  emphasises24h: false, leadsWithEmergency: false, noCallOutFee: false,
  ...overrides,
});

const serp = (
  keyword: string,
  geo: string,
  adDomains: string[],
  headlines: string[] = [],
): SerpScanResult => ({
  keyword,
  geo,
  scannedAt: new Date(),
  ads: adDomains.map((d, i) => ({
    domain: d,
    position: i + 1,
    headline: headlines[i] ?? `Headline for ${d}`,
    description: `Description for ${d}`,
    displayUrl: d,
    sitelinks: [],
  })),
  organicDomains: [],
  query: `${keyword} ${geo}`,
  blocked: false,
});

// Access private classifiers via narrowed cast
const classifySerpBlock = (
  SerpIntelligenceClient as unknown as {
    classifyBlock: (html: string, ct: string, status: number) => string | null;
  }
).classifyBlock;

const classifyFpResponse = (
  CompetitorFingerprintClient as unknown as {
    classifyResponse: (html: string, ct: string, status: number) => string | null;
  }
).classifyResponse;

// ══════════════════════════════════════════════════════════════════════════════
// SERP intelligence
// ══════════════════════════════════════════════════════════════════════════════

suite("extractDomainFromDisplayUrl", () => {
  test("strips protocol, www, and path", () => {
    expect(extractDomainFromDisplayUrl("https://www.lockforce.co.uk/manchester"))
      .toBe("lockforce.co.uk");
  });
  test("handles Google breadcrumb separator", () => {
    expect(extractDomainFromDisplayUrl("www.lockforce.co.uk › manchester"))
      .toBe("lockforce.co.uk");
  });
  test("handles bare domain", () => {
    expect(extractDomainFromDisplayUrl("emergencylocksmith.co.uk"))
      .toBe("emergencylocksmith.co.uk");
  });
  test("returns empty for empty input", () => {
    expect(extractDomainFromDisplayUrl("")).toBe("");
  });
});

suite("parseSponsoredAds", () => {
  test("Pattern A: data-text-ad + <h3> headlines", () => {
    const html = `
      <div data-text-ad="1"><h3>Emergency Locksmith Manchester</h3>
        <cite>lockforce.co.uk</cite><span>Sponsored</span>
        <div>24/7 locksmiths covering Greater Manchester.</div></div>
      <div data-text-ad="1"><h3>Locked Out? £49 Call Out</h3>
        <cite>emergencylocksmith.co.uk › manchester</cite><span>Sponsored</span>
        <div>Trusted local locksmith. DBS checked.</div></div>`;
    const ads = parseSponsoredAds(html);
    expect(ads).toHaveLength(2);
    expect(ads[0].domain).toBe("lockforce.co.uk");
    expect(ads[0].headline).toBe("Emergency Locksmith Manchester");
    expect(ads[0].position).toBe(1);
    expect(ads[1].domain).toBe("emergencylocksmith.co.uk");
  });

  test("Pattern B: Sponsored text fallback when data-text-ad absent", () => {
    const html = `<div><h3>24 Hour Locksmith Birmingham</h3>
      <cite>lockforce.co.uk</cite>Sponsored
      <p>Emergency response across Birmingham.</p></div>`;
    const ads = parseSponsoredAds(html);
    expect(ads.length).toBeGreaterThanOrEqual(1);
    expect(ads[0].domain).toBe("lockforce.co.uk");
  });

  test("Pattern C: role='heading' div used in some 2024+ layouts", () => {
    const html = `<div data-text-ad="1">
      <div role="heading" aria-level="2">Auto Locksmith London — 24/7</div>
      <cite>autolock.co.uk</cite><span>Sponsored</span>
      <p>Car key replacement. Mobile service.</p></div>`;
    const ads = parseSponsoredAds(html);
    expect(ads).toHaveLength(1);
    expect(ads[0].headline).toBe("Auto Locksmith London — 24/7");
    expect(ads[0].domain).toBe("autolock.co.uk");
  });

  test("data-pcu fallback when <cite> is missing", () => {
    const html = `<div data-text-ad="1" data-pcu="https://lockforce.co.uk/manchester">
      <h3>Lock Repair Manchester</h3><span>Sponsored</span>
      <p>Mortice locks, uPVC doors.</p></div>`;
    const ads = parseSponsoredAds(html);
    expect(ads).toHaveLength(1);
    expect(ads[0].domain).toBe("lockforce.co.uk");
  });

  test("extracts sitelinks", () => {
    const html = `<div data-text-ad="1"><h3>Locksmith Leeds</h3>
      <cite>lockforce.co.uk</cite><span>Sponsored</span>
      <p>Trusted local team.</p>
      <a href="/leeds/emergency">Emergency</a>
      <a href="/leeds/lock-change">Lock Change</a>
      <a href="/leeds/upvc">uPVC Doors</a></div>`;
    const ads = parseSponsoredAds(html);
    expect(ads[0].sitelinks).toArrayContain(["Emergency", "Lock Change", "uPVC Doors"]);
  });

  test("skips malformed blocks with no headline", () => {
    const html = `<div data-text-ad="1"><cite>broken.co.uk</cite><span>Sponsored</span></div>
      <div data-text-ad="1"><h3>Real Ad</h3>
        <cite>real.co.uk</cite><span>Sponsored</span><p>Real ad copy.</p></div>`;
    const ads = parseSponsoredAds(html);
    expect(ads).toHaveLength(1);
    expect(ads[0].domain).toBe("real.co.uk");
  });

  test("returns [] for HTML with no ads", () => {
    expect(parseSponsoredAds(`<div class="g"><h3>Organic</h3></div>`)).toEqual([]);
  });

  test("handles empty input safely", () => {
    expect(parseSponsoredAds("")).toEqual([]);
  });
});

suite("parseOrganicDomains", () => {
  test("returns up to 5 unique organic domains, excluding sponsored", () => {
    const html = `<div data-text-ad="1"><h3>Ad</h3><cite>ad.co.uk</cite>
      <span>Sponsored</span></div>
      <div class="g"><cite>checkatrade.com/locksmiths/manchester</cite></div>
      <div class="g"><cite>yell.com › locksmiths</cite></div>
      <div class="g"><cite>rated.co.uk/locksmiths</cite></div>
      <div class="g"><cite>checkatrade.com/locksmiths/manchester</cite></div>
      <div class="g"><cite>lockforce.co.uk/manchester</cite></div>
      <div class="g"><cite>thomson.co.uk/locksmiths</cite></div>`;
    const organics = parseOrganicDomains(html);
    expect(organics).toHaveLength(5);
    if (organics.includes("ad.co.uk")) throw new Error("sponsored leaked into organic");
    expect(organics).toContain("checkatrade.com");
    expect(organics).toContain("lockforce.co.uk");
    // unique
    const dupes = organics.filter((d) => d === "checkatrade.com");
    expect(dupes).toHaveLength(1);
  });
});

suite("unwrapGoogleRedirect — strip click-tracking wrappers", () => {
  test("unwraps /url?q= relative redirect", () => {
    expect(unwrapGoogleRedirect("/url?q=https%3A%2F%2Flockforce.co.uk%2Fmanchester&sa=U"))
      .toBe("https://lockforce.co.uk/manchester");
  });
  test("unwraps googleadservices /pagead/aclk?adurl=", () => {
    expect(unwrapGoogleRedirect(
      "https://www.googleadservices.com/pagead/aclk?adurl=https%3A%2F%2Flockforce.co.uk%2F&sa=L",
    )).toBe("https://lockforce.co.uk/");
  });
  test("unwraps /url?url= variant", () => {
    expect(unwrapGoogleRedirect("/url?url=https%3A%2F%2Fexample.com&rct=j"))
      .toBe("https://example.com");
  });
  test("returns original URL when not a Google redirect", () => {
    expect(unwrapGoogleRedirect("https://lockforce.co.uk/manchester"))
      .toBe("https://lockforce.co.uk/manchester");
  });
  test("handles unparseable input gracefully", () => {
    expect(unwrapGoogleRedirect("")).toBe("");
    expect(unwrapGoogleRedirect("not-a-url")).toBe("not-a-url");
  });
});

suite("classifyBlock — bot-block detection", () => {
  test("flags CAPTCHA / sorry pages", () => {
    const html = (`<html><body><form action="/sorry/index">
      Our systems have detected unusual traffic from your computer network.
      <div class="g-recaptcha"></div></form></body></html>`).padEnd(6000, " ");
    expect(classifySerpBlock(html, "text/html", 200)).toBe("captcha");
  });
  test("flags 429", () => {
    expect(classifySerpBlock("anything", "text/html", 429)).toBe("429");
  });
  test("flags non-HTML", () => {
    expect(classifySerpBlock("{\"error\":1}", "application/json", 200)).toBe("non_html");
  });
  test("flags suspiciously short", () => {
    expect(classifySerpBlock("<html><body>blocked</body></html>", "text/html", 200))
      .toBe("short_response");
  });
  test("flags HTTP error", () => {
    expect(classifySerpBlock("err", "text/html", 503)).toBe("http_error");
  });
  test("returns null for healthy SERP with ads hydrated", () => {
    // A real ads-rendered SERP contains data-text-ad markers. The js_only_serp
    // check requires them; without them we now (correctly) flag JS-shell.
    const realistic = "<html><body>" + "x".repeat(50_000) +
      "<div data-text-ad=\"1\"><h3>Ad</h3><cite>x.co.uk</cite>Sponsored</div>" +
      "</body></html>";
    expect(classifySerpBlock(realistic, "text/html; charset=UTF-8", 200)).toBeNull();
  });
  test("flags js_only_serp when response is healthy but ads aren't hydrated", () => {
    const shell = "<html><body>" + "x".repeat(50_000) + "</body></html>";
    expect(classifySerpBlock(shell, "text/html; charset=UTF-8", 200)).toBe("js_only_serp");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Competitor fingerprint
// ══════════════════════════════════════════════════════════════════════════════

suite("detectMla", () => {
  const cases: Array<[string, boolean]> = [
    ["Master Locksmiths Association approved", true],
    ["Master Locksmith Association member",    true],
    ["We're MLA approved engineers",           true],
    ["mlalocksmiths.co.uk verified",           true],
    ["We use master keys daily",               false],
    ["Just a regular locksmith",               false],
  ];
  for (const [text, expected] of cases) {
    test(`'${text}' → ${expected}`, () => expect(detectMla(text)).toBe(expected));
  }
});

suite("detectDbs", () => {
  test("DBS checked", () => expect(detectDbs("All engineers are DBS checked")).toBe(true));
  test("Police vetted DBS", () => expect(detectDbs("Police vetted DBS engineers")).toBe(true));
  test("no DBS mention → false", () => expect(detectDbs("plain text")).toBe(false));
});

suite("detectPpcTracking", () => {
  test("CallRail", () => expect(detectPpcTracking('<script src="//cdn.callrail.com/swap.js"></script>')).toBe(true));
  test("WhatConverts", () => expect(detectPpcTracking('<script src="//whatconverts.com/wctrack.js"></script>')).toBe(true));
  test("Marchex", () => expect(detectPpcTracking('<script>marchex.track()</script>')).toBe(true));
  test("clean page → false", () => expect(detectPpcTracking("<html></html>")).toBe(false));
});

suite("extractGoogleAdsIds", () => {
  test("single ID", () => expect(extractGoogleAdsIds("gtag('config', 'AW-123456789')")).toEqual(["AW-123456789"]));
  test("multiple IDs, deduped", () => {
    const html = `gtag('config','AW-111222333');gtag('event','c',{send_to:'AW-111222333/abc'});gtag('config','AW-987654321');`;
    const ids = extractGoogleAdsIds(html);
    expect(ids).toHaveLength(2);
    expect(ids).toArrayContain(["AW-111222333", "AW-987654321"]);
  });
  test("none → []", () => expect(extractGoogleAdsIds("<html></html>")).toEqual([]));
});

suite("detectGoogleTagManager", () => {
  test("script src", () => expect(detectGoogleTagManager('<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234"></script>')).toBe(true));
  test("bare GTM container", () => expect(detectGoogleTagManager("// GTM-XYZ123 container")).toBe(true));
  test("unrelated → false", () => expect(detectGoogleTagManager("plain text")).toBe(false));
});

suite("extractTrustBadges", () => {
  test("collects all known badges", () => {
    const html = `<img alt="MLA Approved"><a href="//which.co.uk/trusted-trader">Which? Trusted Trader</a>
      <p>DBS checked</p><a href="https://trustpilot.com/x">tp</a>
      <a href="https://checkatrade.com/y">ct</a>`;
    expect(extractTrustBadges(html)).toArrayContain(
      ["MLA Approved", "Which? Trusted Trader", "DBS Checked", "Trustpilot", "Checkatrade"],
    );
  });
  test("empty when none", () => expect(extractTrustBadges("<html></html>")).toEqual([]));
});

suite("extractPriceAnchors & lowestGbpFromAnchors", () => {
  test("extracts prices", () => {
    const text = "Locksmith from £49. Most jobs £85. Call-out £120 inc VAT.";
    const anchors = extractPriceAnchors(text);
    if (!anchors.some((a) => /£\s*49/.test(a))) throw new Error("missing £49");
    if (!anchors.some((a) => /£\s*85/.test(a))) throw new Error("missing £85");
    if (!anchors.some((a) => /£\s*120/.test(a))) throw new Error("missing £120");
  });
  test("lowest = 49", () => expect(lowestGbpFromAnchors(["from £49", "£85", "£120"])).toBe(49));
  test("empty → null", () => expect(lowestGbpFromAnchors([])).toBeNull());
});

suite("extractServiceAreas", () => {
  test("finds named cities", () => {
    expect(extractServiceAreas("Across london, birmingham, leeds and manchester."))
      .toArrayContain(["london", "birmingham", "leeds", "manchester"]);
  });
  test("none → []", () => expect(extractServiceAreas("generic text")).toEqual([]));
});

suite("classifyResponse — fingerprint block detection", () => {
  test("Cloudflare challenge", () => {
    const challenge = (`<!DOCTYPE html><html><head><title>Just a moment...</title></head>
      <body>Checking your browser before accessing...
      <script src="/cdn-cgi/challenge-platform/h/g/orchestrate/jsch/v1"></script>
      </body></html>`).padEnd(500, " ");
    expect(classifyFpResponse(challenge, "text/html", 200)).toBe("cloudflare_challenge");
  });
  test("Cloudflare challenge with 503 → http_error wins", () => {
    expect(classifyFpResponse("Just a moment...", "text/html", 503)).toBe("http_error");
  });
  test("JS-only shell (Next.js)", () => {
    const shell = (`<!DOCTYPE html><html><head><title>App</title></head>
      <body><div id="__next"></div>
      <script src="/_next/static/chunks/main.js"></script>
      <script src="/_next/static/chunks/framework.js"></script>
      </body></html>`).padEnd(500, " ");
    expect(classifyFpResponse(shell, "text/html", 200)).toBe("js_only_shell");
  });
  test("empty response", () => {
    expect(classifyFpResponse("", "text/html", 200)).toBe("empty_response");
    expect(classifyFpResponse("<html></html>", "text/html", 200)).toBe("empty_response");
  });
  test("non-HTML", () => expect(classifyFpResponse("{\"ok\":1}", "application/json", 200)).toBe("non_html"));
  test("HTTP error", () => expect(classifyFpResponse("<html><body>err</body></html>", "text/html", 500)).toBe("http_error"));
  test("healthy page → null", () => {
    const real = `<!DOCTYPE html><html><head><title>LockSafe</title></head>
      <body><h1>Emergency Locksmith Services</h1>
      <p>${"Trusted locksmiths covering the UK. ".repeat(30)}</p></body></html>`;
    expect(classifyFpResponse(real, "text/html; charset=UTF-8", 200)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Cross-validate
// ══════════════════════════════════════════════════════════════════════════════

suite("synonymsOf", () => {
  test("24-hour cluster", () => {
    expect(synonymsOf("24")).toArrayContain(["24/7", "247", "24hr", "hour"]);
  });
  test("lockout cluster", () => {
    expect(synonymsOf("lockout")).toArrayContain(["locked-out", "lockouts"]);
  });
  test("no synonyms → token alone", () => {
    expect(synonymsOf("manchester")).toEqual(["manchester"]);
  });
});

suite("fingerprintMatchesKeyword — synonym-aware", () => {
  test("exact phrase", () => {
    expect(fingerprintMatchesKeyword(
      "emergency locksmith manchester | 24/7 service",
      "emergency locksmith manchester",
    )).toBe(true);
  });
  test("all tokens present, any order", () => {
    expect(fingerprintMatchesKeyword(
      "locksmith in manchester offering emergency response",
      "emergency locksmith manchester",
    )).toBe(true);
  });
  test("'24 hour' ↔ '24/7' synonym bridge", () => {
    expect(fingerprintMatchesKeyword(
      "24/7 locksmith manchester — round-the-clock",
      "24 hour locksmith manchester",
    )).toBe(true);
  });
  test("'lockout' ↔ 'locked out'", () => {
    expect(fingerprintMatchesKeyword(
      "locked out? we open uPVC doors in london",
      "lockout london",
    )).toBe(true);
  });
  test("missing token → false", () => {
    expect(fingerprintMatchesKeyword(
      "general building services london",
      "emergency locksmith manchester",
    )).toBe(false);
  });
  test("word-boundary respected: lockoutshop ≠ lockout", () => {
    expect(fingerprintMatchesKeyword(
      "we are lockoutshop limited, services across uk",
      "lockout london",
    )).toBe(false);
  });
  test("empty inputs → false", () => {
    expect(fingerprintMatchesKeyword("", "x")).toBe(false);
    expect(fingerprintMatchesKeyword("x", "")).toBe(false);
  });
});

suite("mergeIntelKeywords", () => {
  test("dualConfirms a multi-word keyword (the original bug)", () => {
    const serpResults = [serp("emergency locksmith manchester", "manchester",
      ["lockforce.co.uk", "multiskilled.co.uk"])];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      searchableText: "emergency locksmith manchester | 24/7 | mla approved",
    }));
    fingerprints.set("multiskilled.co.uk", fp({
      searchableText: "multi skilled trades general building services",
    }));
    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged).toHaveLength(1);
    expect(merged[0].serpConfirmed).toBe(true);
    expect(merged[0].fingerprintConfirmed).toBe(true);
    expect(merged[0].dualConfirmed).toBe(true);
    expect(merged[0].fingerprintDomains).toEqual(["lockforce.co.uk"]);
    expect(merged[0].competitorCount).toBe(2);
    expect(merged[0].geoCount).toBe(1);
  });

  test("synonym bridge: '24 hour ...' matches '24/7 ...' in fingerprint", () => {
    const serpResults = [serp("24 hour locksmith london", "london", ["lockforce.co.uk"])];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      searchableText: "lockforce | 24/7 locksmith london | emergency response",
    }));
    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged[0].dualConfirmed).toBe(true);
  });

  test("blocked fingerprints excluded (no false demotion)", () => {
    const serpResults = [serp("emergency locksmith leeds", "leeds", ["lockforce.co.uk"])];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      blocked: true, blockReason: "cloudflare_challenge", searchableText: "",
    }));
    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged[0].serpConfirmed).toBe(true);
    expect(merged[0].fingerprintConfirmed).toBe(false);
    expect(merged[0].dualConfirmed).toBe(false);
    expect(merged[0].fingerprintDomains).toEqual([]);
  });

  test("fingerprint-only domain captured", () => {
    const serpResults = [serp("emergency locksmith bristol", "bristol", ["lockforce.co.uk"])];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      searchableText: "lockforce | emergency locksmith bristol & bath",
    }));
    fingerprints.set("ghost.co.uk", fp({
      searchableText: "ghost emergency locksmith bristol",
    }));
    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged[0].fingerprintDomains).toArrayContain(["lockforce.co.uk", "ghost.co.uk"]);
    expect(merged[0].serpDomains).toEqual(["lockforce.co.uk"]);
  });

  test("isEntering when no priors", () => {
    const serpResults = [serp("auto locksmith reading", "reading", ["lockforce.co.uk"])];
    const merged = mergeIntelKeywords(serpResults, new Map(), []);
    expect(merged[0].isEntering).toBe(true);
    expect(merged[0].isExiting).toBe(false);
  });

  test("isExiting when prior exists & SERP no longer confirms", () => {
    const priors: KeywordPrior[] = [{
      keyword: "lock change birmingham",
      firstSeenAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      lastConfirmedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    }];
    const serpResults = [serp("lock change birmingham", "birmingham", [])];
    const merged = mergeIntelKeywords(serpResults, new Map(), priors);
    expect(merged[0].serpConfirmed).toBe(false);
    expect(merged[0].isExiting).toBe(true);
  });

  test("cpc + volume priors carry through", () => {
    const serpResults = [serp("emergency locksmith london", "london", ["lockforce.co.uk"])];
    const cpc = new Map([["emergency locksmith london", 4.20]]);
    const vol = new Map([["emergency locksmith london", 1000]]);
    const merged = mergeIntelKeywords(serpResults, new Map(), [], cpc, vol);
    expect(merged[0].cpcGbp).toBe(4.20);
    expect(merged[0].monthlyClicks).toBeGreaterThan(0);
  });

  test("sort: dualConfirmed first, then geo+competitor score", () => {
    const serpResults = [
      serp("upvc door lock repair leeds", "leeds", ["lockforce.co.uk"]),
      serp("emergency locksmith london", "london", ["lockforce.co.uk", "multiskilled.co.uk"]),
    ];
    const fingerprints = new Map<string, CompetitorFingerprint>();
    fingerprints.set("lockforce.co.uk", fp({
      searchableText: "emergency locksmith london | 24/7",
    }));
    const merged = mergeIntelKeywords(serpResults, fingerprints);
    expect(merged[0].keyword.toLowerCase()).toBe("emergency locksmith london");
    expect(merged[0].dualConfirmed).toBe(true);
  });

  test("preserves original casing", () => {
    const merged = mergeIntelKeywords(
      [serp("Emergency Locksmith Manchester", "manchester", ["x.co.uk"])],
      new Map(),
    );
    expect(merged[0].keyword).toBe("Emergency Locksmith Manchester");
  });

  test("empty SERP → []", () => {
    expect(mergeIntelKeywords([], new Map())).toEqual([]);
  });
});

suite("extractTopSeeds", () => {
  test("only keywords with at least one source confirmation", () => {
    const serpResults = [
      serp("a confirmed kw", "london", ["a.co.uk"]),
      serp("unconfirmed kw", "london", []),
    ];
    const merged = mergeIntelKeywords(serpResults, new Map());
    const seeds = extractTopSeeds(merged, 10);
    expect(seeds).toContain("a confirmed kw");
    if (seeds.includes("unconfirmed kw")) throw new Error("unconfirmed leaked");
  });
  test("respects limit", () => {
    const many = Array.from({ length: 50 }, (_, i) => serp(`kw ${i}`, "london", ["a.co.uk"]));
    const merged = mergeIntelKeywords(many, new Map());
    expect(extractTopSeeds(merged, 10)).toHaveLength(10);
  });
});

suite("buildGeoPresenceScores", () => {
  test("fraction of keywords-with-ads per geo", () => {
    const results = [
      serp("emergency locksmith manchester", "manchester", ["a.co.uk"]),
      serp("lock change manchester",         "manchester", ["b.co.uk"]),
      serp("upvc lock repair manchester",    "manchester", []),
      serp("emergency locksmith leeds",      "leeds",      ["a.co.uk"]),
    ];
    const scores = buildGeoPresenceScores(results, 4);
    expect(scores.get("manchester")).toBeCloseTo(2 / 4);
    expect(scores.get("leeds")).toBeCloseTo(1 / 4);
  });
  test("score caps at 1.0", () => {
    const scores = buildGeoPresenceScores([serp("a", "london", ["x.co.uk"])], 0);
    expect(scores.get("london")).toBe(1);
  });
});

suite("estimateMonthlyClicks", () => {
  test("position 1 → 8.6%", () => expect(estimateMonthlyClicks(1, 1000)).toBe(86));
  test("position 2 → 5.5%", () => expect(estimateMonthlyClicks(2, 1000)).toBe(55));
  test("position ≥5 → 2%", () => {
    expect(estimateMonthlyClicks(5, 1000)).toBe(20);
    expect(estimateMonthlyClicks(10, 1000)).toBe(20);
  });
});

suite("normalise", () => {
  test("lowercase + trim + collapse whitespace", () => {
    expect(normalise("  Emergency   LOCKSMITH    Manchester  "))
      .toBe("emergency locksmith manchester");
  });
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${C.bold}${C.blue}══════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}Passed: ${C.green}${passed}${C.reset}   ` +
            `${C.bold}Failed: ${failed > 0 ? C.red : C.dim}${failed}${C.reset}`);
if (failures.length > 0) {
  console.log(`\n${C.red}Failures:${C.reset}`);
  for (const f of failures) {
    console.log(`  ${C.bold}[${f.suite}]${C.reset} ${f.name}`);
    console.log(`    ${C.dim}${f.detail}${C.reset}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
