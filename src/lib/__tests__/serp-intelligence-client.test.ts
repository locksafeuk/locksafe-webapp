/**
 * SERP Intelligence Client — parser + block-detection tests.
 *
 * Covers:
 *   • parseSponsoredAds — multiple Google markup variants (data-text-ad,
 *     "Sponsored" fallback, modern role="heading" headlines, data-pcu URL).
 *   • extractDomainFromDisplayUrl — punctuation / breadcrumb stripping.
 *   • parseOrganicDomains — first 5 organic domains, sponsored blocks excluded.
 *   • SerpIntelligenceClient.classifyBlock (via private static) — CAPTCHA /
 *     short response / 429 / non-HTML detection.
 *
 * No network — these tests exercise the pure functions only.
 */

import {
  parseSponsoredAds,
  parseOrganicDomains,
  extractDomainFromDisplayUrl,
  SerpIntelligenceClient,
} from "@/lib/serp-intelligence-client";

// Expose the private static classifier via a narrow `as` cast so tests can
// drive it without making the method public on the production class.
const classifyBlock = (
  SerpIntelligenceClient as unknown as {
    classifyBlock: (
      html: string,
      contentType: string,
      httpStatus: number,
    ) => string | null;
  }
).classifyBlock;

describe("extractDomainFromDisplayUrl", () => {
  it("strips protocol, www, and path", () => {
    expect(extractDomainFromDisplayUrl("https://www.lockforce.co.uk/manchester"))
      .toBe("lockforce.co.uk");
  });

  it("handles Google's breadcrumb separator", () => {
    expect(extractDomainFromDisplayUrl("www.lockforce.co.uk › manchester"))
      .toBe("lockforce.co.uk");
  });

  it("handles bare domain", () => {
    expect(extractDomainFromDisplayUrl("emergencylocksmith.co.uk"))
      .toBe("emergencylocksmith.co.uk");
  });

  it("returns empty for empty input", () => {
    expect(extractDomainFromDisplayUrl("")).toBe("");
  });
});

describe("parseSponsoredAds", () => {
  it("parses Pattern A — data-text-ad markers with <h3> headlines", () => {
    const html = `
      <div data-text-ad="1">
        <h3>Emergency Locksmith Manchester</h3>
        <cite>lockforce.co.uk</cite>
        <span>Sponsored</span>
        <div>24/7 locksmiths covering Greater Manchester.</div>
      </div>
      <div data-text-ad="1">
        <h3>Locked Out? £49 Call Out</h3>
        <cite>emergencylocksmith.co.uk › manchester</cite>
        <span>Sponsored</span>
        <div>Trusted local locksmith. DBS checked.</div>
      </div>
    `;
    const ads = parseSponsoredAds(html);
    expect(ads).toHaveLength(2);
    expect(ads[0].domain).toBe("lockforce.co.uk");
    expect(ads[0].headline).toBe("Emergency Locksmith Manchester");
    expect(ads[0].position).toBe(1);
    expect(ads[1].domain).toBe("emergencylocksmith.co.uk");
    expect(ads[1].position).toBe(2);
  });

  it("parses Pattern B — Sponsored text fallback when data-text-ad absent", () => {
    const html = `
      <div>
        <h3>24 Hour Locksmith Birmingham</h3>
        <cite>lockforce.co.uk</cite>
        Sponsored
        <p>Emergency response across Birmingham.</p>
      </div>
    `;
    const ads = parseSponsoredAds(html);
    expect(ads.length).toBeGreaterThanOrEqual(1);
    expect(ads[0].domain).toBe("lockforce.co.uk");
    expect(ads[0].headline).toBe("24 Hour Locksmith Birmingham");
  });

  it("parses Pattern C — role='heading' div used in some 2024+ layouts", () => {
    const html = `
      <div data-text-ad="1">
        <div role="heading" aria-level="2">Auto Locksmith London — 24/7</div>
        <cite>autolock.co.uk</cite>
        <span>Sponsored</span>
        <p>Car key replacement. Mobile service.</p>
      </div>
    `;
    const ads = parseSponsoredAds(html);
    expect(ads).toHaveLength(1);
    expect(ads[0].headline).toBe("Auto Locksmith London — 24/7");
    expect(ads[0].domain).toBe("autolock.co.uk");
  });

  it("falls back to data-pcu when <cite> is missing", () => {
    const html = `
      <div data-text-ad="1" data-pcu="https://lockforce.co.uk/manchester">
        <h3>Lock Repair Manchester</h3>
        <span>Sponsored</span>
        <p>Mortice locks, uPVC doors.</p>
      </div>
    `;
    const ads = parseSponsoredAds(html);
    expect(ads).toHaveLength(1);
    expect(ads[0].domain).toBe("lockforce.co.uk");
  });

  it("extracts sitelinks (short anchor texts)", () => {
    const html = `
      <div data-text-ad="1">
        <h3>Locksmith Leeds</h3>
        <cite>lockforce.co.uk</cite>
        <span>Sponsored</span>
        <p>Trusted local team.</p>
        <a href="/leeds/emergency">Emergency</a>
        <a href="/leeds/lock-change">Lock Change</a>
        <a href="/leeds/upvc">uPVC Doors</a>
      </div>
    `;
    const ads = parseSponsoredAds(html);
    expect(ads[0].sitelinks).toEqual(
      expect.arrayContaining(["Emergency", "Lock Change", "uPVC Doors"]),
    );
  });

  it("skips malformed blocks with no headline", () => {
    const html = `
      <div data-text-ad="1">
        <cite>brokenmarkup.co.uk</cite>
        <span>Sponsored</span>
      </div>
      <div data-text-ad="1">
        <h3>Real Ad</h3>
        <cite>real.co.uk</cite>
        <span>Sponsored</span>
        <p>Real ad copy.</p>
      </div>
    `;
    const ads = parseSponsoredAds(html);
    expect(ads).toHaveLength(1);
    expect(ads[0].domain).toBe("real.co.uk");
  });

  it("returns empty array for HTML with no ads", () => {
    const html = `<html><body><div class="g"><h3>Organic Result</h3></div></body></html>`;
    expect(parseSponsoredAds(html)).toEqual([]);
  });

  it("handles empty input safely", () => {
    expect(parseSponsoredAds("")).toEqual([]);
  });
});

describe("parseOrganicDomains", () => {
  it("returns up to 5 unique organic domains, excluding sponsored", () => {
    const html = `
      <div data-text-ad="1">
        <h3>Sponsored</h3>
        <cite>ad-domain.co.uk</cite>
        <span>Sponsored</span>
      </div>
      <div class="g"><cite>checkatrade.com/locksmiths/manchester</cite></div>
      <div class="g"><cite>yell.com › locksmiths</cite></div>
      <div class="g"><cite>rated.co.uk/locksmiths</cite></div>
      <div class="g"><cite>checkatrade.com/locksmiths/manchester</cite></div>
      <div class="g"><cite>lockforce.co.uk/manchester</cite></div>
      <div class="g"><cite>thomson.co.uk/locksmiths</cite></div>
    `;
    const organics = parseOrganicDomains(html);
    expect(organics).toHaveLength(5);
    expect(organics).not.toContain("ad-domain.co.uk");
    expect(organics).toContain("checkatrade.com");
    expect(organics).toContain("lockforce.co.uk");
    // Uniqueness check — checkatrade.com appears twice in HTML, once in result
    expect(organics.filter((d) => d === "checkatrade.com")).toHaveLength(1);
  });
});

describe("classifyBlock — bot-block detection", () => {
  it("flags CAPTCHA / sorry pages", () => {
    const html = `<html><body>
      <form action="/sorry/index">
        Our systems have detected unusual traffic from your computer network.
        <div class="g-recaptcha"></div>
      </form>
    </body></html>`.padEnd(6000, " ");
    expect(classifyBlock(html, "text/html", 200)).toBe("captcha");
  });

  it("flags 429 Too Many Requests", () => {
    expect(classifyBlock("anything", "text/html", 429)).toBe("429");
  });

  it("flags non-HTML responses", () => {
    expect(classifyBlock("{\"error\":\"blocked\"}", "application/json", 200))
      .toBe("non_html");
  });

  it("flags suspiciously small responses", () => {
    expect(classifyBlock("<html><body>blocked</body></html>", "text/html", 200))
      .toBe("short_response");
  });

  it("flags non-200 HTTP errors", () => {
    expect(classifyBlock("server error", "text/html", 503)).toBe("http_error");
  });

  it("returns null for a healthy SERP", () => {
    const realisticHtml = "<html><body>" + "x".repeat(50_000) + "</body></html>";
    expect(classifyBlock(realisticHtml, "text/html; charset=UTF-8", 200))
      .toBeNull();
  });
});
