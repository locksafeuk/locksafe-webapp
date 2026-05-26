/**
 * Competitor Fingerprint — parser + block-detection tests.
 *
 * Covers:
 *   • Pure detection helpers (MLA, DBS, Google Ads IDs, GTM, trust badges,
 *     prices, service areas).
 *   • CompetitorFingerprintClient.classifyResponse — Cloudflare challenge,
 *     JS-only shell, empty response, non-HTML, HTTP error.
 *
 * No network — pure function tests.
 */

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
} from "@/lib/competitor-fingerprint";

describe("detectMla — Master Locksmiths Association", () => {
  it.each([
    ["Master Locksmiths Association approved",   true],
    ["Master Locksmith Association member",      true],
    ["We're MLA approved engineers",             true],
    ["Trusted MLA member since 2015",            true],
    ["mlalocksmiths.co.uk verified",             true],
    ["We use master keys daily",                 false],
    ["Just a regular locksmith",                 false],
  ])("'%s' → %s", (html, expected) => {
    expect(detectMla(html)).toBe(expected);
  });
});

describe("detectDbs — police vetting", () => {
  it.each([
    ["All engineers are DBS checked",        true],
    ["DBS cleared since 2018",                true],
    ["Police vetted DBS engineers",          true],
    ["No DBS checking here — beware",        true], // current regex catches "DBS checking" too
    ["We respect your DBS data",              false],
  ])("'%s' → %s", (html, expected) => {
    expect(detectDbs(html)).toBe(expected);
  });
});

describe("detectPpcTracking — call-tracking scripts", () => {
  it("detects CallRail", () => {
    expect(detectPpcTracking('<script src="//cdn.callrail.com/swap.js"></script>'))
      .toBe(true);
  });

  it("detects WhatConverts", () => {
    expect(detectPpcTracking('<script src="//whatconverts.com/wctrack.js"></script>'))
      .toBe(true);
  });

  it("detects Marchex", () => {
    expect(detectPpcTracking('<script>marchex.track();</script>'))
      .toBe(true);
  });

  it("returns false for plain page", () => {
    expect(detectPpcTracking("<html><body>hello</body></html>"))
      .toBe(false);
  });
});

describe("extractGoogleAdsIds — AW-xxxxxxxxx conversion tags", () => {
  it("extracts single ID", () => {
    expect(extractGoogleAdsIds("gtag('config', 'AW-123456789')"))
      .toEqual(["AW-123456789"]);
  });

  it("extracts and dedupes multiple IDs", () => {
    const html = `
      gtag('config', 'AW-111222333');
      gtag('event', 'conversion', {send_to: 'AW-111222333/abc'});
      gtag('config', 'AW-987654321');
    `;
    expect(extractGoogleAdsIds(html)).toEqual(
      expect.arrayContaining(["AW-111222333", "AW-987654321"]),
    );
    expect(extractGoogleAdsIds(html)).toHaveLength(2);
  });

  it("returns empty array when none present", () => {
    expect(extractGoogleAdsIds("<html><body></body></html>")).toEqual([]);
  });
});

describe("detectGoogleTagManager", () => {
  it("detects GTM script src", () => {
    expect(detectGoogleTagManager('<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234"></script>'))
      .toBe(true);
  });

  it("detects bare GTM container ID", () => {
    expect(detectGoogleTagManager("dataLayer.push({'gtm.start': new Date(), 'gtm.uniqueEventId': 0});  // GTM-XYZ123"))
      .toBe(true);
  });

  it("false on unrelated content", () => {
    expect(detectGoogleTagManager("just text")).toBe(false);
  });
});

describe("extractTrustBadges", () => {
  it("collects MLA, Which? Trusted, DBS, Trustpilot, Checkatrade", () => {
    const html = `
      <img alt="MLA Approved">
      <a href="//which.co.uk/trusted-trader">Which? Trusted Trader</a>
      <p>DBS checked engineers</p>
      <a href="https://trustpilot.com/review/lockforce.co.uk">Trustpilot</a>
      <a href="https://checkatrade.com/lockforce">Checkatrade</a>
    `;
    const badges = extractTrustBadges(html);
    expect(badges).toEqual(
      expect.arrayContaining([
        "MLA Approved",
        "Which? Trusted Trader",
        "DBS Checked",
        "Trustpilot",
        "Checkatrade",
      ]),
    );
  });

  it("returns empty when no badges", () => {
    expect(extractTrustBadges("<html><body></body></html>")).toEqual([]);
  });
});

describe("extractPriceAnchors & lowestGbpFromAnchors", () => {
  it("extracts 'from £X' and bare '£X' patterns", () => {
    const text = "Locksmith services from £49. Most jobs £85. Call-out £120 inc VAT.";
    const anchors = extractPriceAnchors(text);
    expect(anchors.some((a) => /£\s*49/.test(a))).toBe(true);
    expect(anchors.some((a) => /£\s*85/.test(a))).toBe(true);
    expect(anchors.some((a) => /£\s*120/.test(a))).toBe(true);
  });

  it("finds lowest GBP value", () => {
    expect(lowestGbpFromAnchors(["from £49", "£85", "£120"])).toBe(49);
  });

  it("returns null when no valid prices", () => {
    expect(lowestGbpFromAnchors([])).toBeNull();
    expect(lowestGbpFromAnchors(["£abc", ""])).toBeNull();
  });
});

describe("extractServiceAreas — UK city detection in text", () => {
  it("finds named cities", () => {
    const text = "Locksmith services across london, birmingham, leeds and manchester.";
    const areas = extractServiceAreas(text);
    expect(areas).toEqual(expect.arrayContaining(
      ["london", "birmingham", "leeds", "manchester"],
    ));
  });

  it("returns empty when no cities", () => {
    expect(extractServiceAreas("just generic text")).toEqual([]);
  });
});

// ── Block detection via the static classifier ─────────────────────────────────

const classify = (
  CompetitorFingerprintClient as unknown as {
    classifyResponse: (
      html: string,
      contentType: string,
      httpStatus: number,
    ) => string | null;
  }
).classifyResponse;

describe("classifyResponse — fingerprint block detection", () => {
  it("flags Cloudflare challenge pages", () => {
    const challenge = `<!DOCTYPE html><html><head><title>Just a moment...</title>
      <meta http-equiv="refresh" content="5">
      </head><body>Checking your browser before accessing...
      <script src="/cdn-cgi/challenge-platform/h/g/orchestrate/jsch/v1"></script>
      </body></html>`.padEnd(500, " ");
    expect(classify(challenge, "text/html", 503)).toBe("http_error");
    // Strip the 503 to test the cf detection itself
    expect(classify(challenge, "text/html", 200)).toBe("cloudflare_challenge");
  });

  it("flags JS-only shell pages (Next.js, React SPA)", () => {
    const shell = `<!DOCTYPE html><html><head><title>App</title></head>
      <body><div id="__next"></div>
      <script src="/_next/static/chunks/main.js"></script>
      <script src="/_next/static/chunks/framework.js"></script>
      </body></html>`.padEnd(500, " ");
    expect(classify(shell, "text/html", 200)).toBe("js_only_shell");
  });

  it("flags empty / suspiciously short responses", () => {
    expect(classify("", "text/html", 200)).toBe("empty_response");
    expect(classify("<html></html>", "text/html", 200)).toBe("empty_response");
  });

  it("flags non-HTML content", () => {
    expect(classify("{\"ok\":1}", "application/json", 200)).toBe("non_html");
  });

  it("flags HTTP errors", () => {
    expect(classify("<html><body>err</body></html>", "text/html", 500))
      .toBe("http_error");
  });

  it("returns null for a healthy homepage with real content", () => {
    const realPage = `<!DOCTYPE html><html><head><title>LockSafe Locksmiths</title></head>
      <body>
        <h1>Emergency Locksmith Services</h1>
        <p>${"Trusted locksmiths covering the UK. ".repeat(20)}</p>
        <p>${"24/7 emergency response. ".repeat(10)}</p>
      </body></html>`;
    expect(classify(realPage, "text/html; charset=UTF-8", 200)).toBeNull();
  });
});
