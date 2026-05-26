/**
 * Click-to-Call helper — unit tests.
 *
 * Pins the client-side fire-and-forget contract:
 *   • sendCallIntent prefers sendBeacon when available
 *   • Falls back to keepalive fetch when sendBeacon returns false or absent
 *   • recordCallIntent enriches payload with visitor + UTM + pagePath
 *   • trackAndCall opens tel: via location.assign when no event passed
 *   • trackAndCall does NOT call assign when an event is passed
 *   • Never throws — DB/network failure must not block the dial
 *
 * Strategy: mock the upstream `client-attribution` module so we don't
 * have to wrestle with jsdom's non-configurable window.location getter.
 * For tel: opening we spyOn(window.location, "assign") — that's a
 * regular method which spyOn handles cleanly.
 */

// Mock upstream attribution so the helper sees a fixed payload
const mockClientAttribution = {
  visitorId:   "v_test",
  gclid:       "test-gclid-123",
  utmSource:   "google",
  utmCampaign: "phase2",
  landingPage: "/book",
};

jest.mock("@/lib/marketing/client-attribution", () => ({
  __esModule: true,
  getOrCreateVisitorId: () => mockClientAttribution.visitorId,
  getClientAttribution: () => mockClientAttribution,
}));

import {
  sendCallIntent,
  recordCallIntent,
  trackAndCall,
  _internal,
} from "@/lib/marketing/click-to-call";

const ORIGINAL_FETCH = global.fetch;

let dialerSpy: jest.SpyInstance;

beforeEach(() => {
  // jsdom locks window.location.assign as read-only, so we spy on
  // the internal indirection layer instead. _internal.openDialer is
  // a regular property on a plain object → trivially mockable.
  dialerSpy = jest.spyOn(_internal, "openDialer").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = ORIGINAL_FETCH;
  // Clean up sendBeacon if a test set it
  delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
});

// ── sendCallIntent ──────────────────────────────────────────────────────────

describe("sendCallIntent", () => {
  it("prefers navigator.sendBeacon when available", () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;
    global.fetch = jest.fn() as unknown as typeof fetch;

    sendCallIntent({ visitorId: "v-1", source: "website_call_button" });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(sendBeacon.mock.calls[0][0]).toBe("/api/marketing/call-intent");
  });

  it("falls back to fetch with keepalive when sendBeacon returns false", () => {
    const sendBeacon = jest.fn().mockReturnValue(false);
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    sendCallIntent({ visitorId: "v-1", source: "website_call_button" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("/api/marketing/call-intent");
    expect(call[1].method).toBe("POST");
    expect(call[1].keepalive).toBe(true);
  });

  it("falls back to fetch when sendBeacon is not in the browser", () => {
    delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    sendCallIntent({ visitorId: "v-1", source: "website_call_button" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never throws when sendBeacon throws", () => {
    const sendBeacon = jest.fn().mockImplementation(() => { throw new Error("nope"); });
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(() => sendCallIntent({ visitorId: "v-1", source: "x" })).not.toThrow();
    // Fallback fetch should still have fired
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never throws when fetch throws", () => {
    delete (navigator as unknown as { sendBeacon?: unknown }).sendBeacon;
    global.fetch = jest.fn().mockImplementation(() => { throw new Error("fetch dead"); }) as unknown as typeof fetch;
    expect(() => sendCallIntent({ visitorId: "v-1", source: "x" })).not.toThrow();
  });
});

// ── recordCallIntent ────────────────────────────────────────────────────────

describe("recordCallIntent", () => {
  it("enriches payload with visitorId + gclid + UTMs from the attribution helper", () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;

    const payload = recordCallIntent("hero-cta");

    expect(payload.visitorId).toBe("v_test");
    expect(payload.gclid).toBe("test-gclid-123");
    expect(payload.utmSource).toBe("google");
    expect(payload.utmCampaign).toBe("phase2");
    expect(payload.source).toBe("website_call_button");
    expect(payload.buttonId).toBe("hero-cta");
    // pagePath comes from window.location.pathname which jsdom provides
    expect(typeof payload.pagePath).toBe("string");
  });

  it("uses the supplied source override", () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;

    const payload = recordCallIntent("modal-cta", "modal_cta");
    expect(payload.source).toBe("modal_cta");
  });

  it("fires the beacon as a side effect", () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;

    recordCallIntent("hero-cta");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});

// ── trackAndCall ────────────────────────────────────────────────────────────

describe("trackAndCall", () => {
  it("opens tel: via _internal.openDialer when no event is passed", () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;

    trackAndCall("+442045771989", "hero");
    expect(dialerSpy).toHaveBeenCalledWith("+442045771989");
  });

  it("does NOT open the dialler when an event is passed (anchor mode)", () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;

    trackAndCall("+442045771989", "footer", { preventDefault: () => {} });
    expect(dialerSpy).not.toHaveBeenCalled();
  });

  it("fires the intent beacon in both modes", () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    (navigator as unknown as { sendBeacon: typeof sendBeacon }).sendBeacon = sendBeacon;

    trackAndCall("+442045771989", "hero");
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    trackAndCall("+442045771989", "footer", {});
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });
});
