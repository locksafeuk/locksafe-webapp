/**
 * POST /api/marketing/call-intent
 *
 * Logged the instant a visitor clicks the Call CTA on the website,
 * BEFORE the tel: link opens. Captures the click's attribution
 * payload (gclid, UTMs, landing page) so the inbound Retell call
 * can later be matched back to the Google/Meta click that drove it.
 *
 * The visitorId is REQUIRED — without it we cannot reliably match
 * Retell's inbound call back to this row (UK caller IDs are
 * frequently withheld, so the visitorId-based join is the only
 * reliable join key we have).
 *
 * Returns 201 with the created intent row's id. The client should
 * fire-and-forget (sendBeacon when available) so the user isn't
 * blocked from dialling if the request is slow.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma as _prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

interface CallIntentBody {
  visitorId?:   string;
  sessionId?:   string;
  source?:      string;  // "website_call_button" | "ad_click_to_call" | "modal_cta"
  buttonId?:    string;
  gclid?:       string;
  fbclid?:      string;
  utmSource?:   string;
  utmMedium?:   string;
  utmCampaign?: string;
  utmContent?:  string;
  utmTerm?:     string;
  landingPage?: string;
  pagePath?:    string;
}

function pickString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function POST(request: NextRequest) {
  try {
    let body: CallIntentBody = {};
    try {
      body = await request.json();
    } catch {
      // Treat invalid JSON as empty — the validation below catches it
      body = {};
    }

    const visitorId = pickString(body.visitorId);
    if (!visitorId) {
      return NextResponse.json(
        { error: "visitorId is required" },
        { status: 400 },
      );
    }

    const source = pickString(body.source) ?? "website_call_button";

    // Resolve attribution: prefer values in the request body (captured
    // from the current URL at click time), fall back to the visitor's
    // most-recent UserSession (the gclid that landed them on the site).
    //
    // This is THE fix for the "33 phone calls, 2 with gclid" problem
    // 2026-06-06: the tel: link handler reads from window.location.search,
    // which has lost the ?gclid=... param by the time the user clicks
    // Call Now from a sub-page. UserSession persisted the gclid on
    // landing, so we recover it here.
    let bodyGclid = pickString(body.gclid);
    let bodyFbclid = pickString(body.fbclid);
    let bodyUtmSource = pickString(body.utmSource);
    let bodyUtmMedium = pickString(body.utmMedium);
    let bodyUtmCampaign = pickString(body.utmCampaign);
    let bodyUtmContent = pickString(body.utmContent);
    let bodyUtmTerm = pickString(body.utmTerm);
    let bodyLandingPage = pickString(body.landingPage);

    const haveAnyAttribution =
      bodyGclid || bodyFbclid || bodyUtmSource || bodyUtmCampaign;
    if (!haveAnyAttribution) {
      try {
        const { getAttributionForVisitor } = await import("@/lib/marketing/tracker");
        const recovered = await getAttributionForVisitor(visitorId);
        if (recovered) {
          bodyGclid       = bodyGclid       ?? recovered.gclid       ?? undefined;
          bodyFbclid      = bodyFbclid      ?? recovered.fbclid      ?? undefined;
          bodyUtmSource   = bodyUtmSource   ?? recovered.utmSource   ?? undefined;
          bodyUtmMedium   = bodyUtmMedium   ?? recovered.utmMedium   ?? undefined;
          bodyUtmCampaign = bodyUtmCampaign ?? recovered.utmCampaign ?? undefined;
          bodyUtmContent  = bodyUtmContent  ?? recovered.utmContent  ?? undefined;
          bodyUtmTerm     = bodyUtmTerm     ?? recovered.utmTerm     ?? undefined;
          bodyLandingPage = bodyLandingPage ?? recovered.landingPage ?? undefined;
        }
      } catch (err) {
        console.warn(
          "[call-intent] visitor-session attribution lookup failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    const data = {
      visitorId,
      sessionId:   pickString(body.sessionId),
      source,
      buttonId:    pickString(body.buttonId),
      userAgent:   request.headers.get("user-agent") ?? undefined,

      gclid:       bodyGclid,
      fbclid:      bodyFbclid,
      utmSource:   bodyUtmSource,
      utmMedium:   bodyUtmMedium,
      utmCampaign: bodyUtmCampaign,
      utmContent:  bodyUtmContent,
      utmTerm:     bodyUtmTerm,
      landingPage: bodyLandingPage,
      pagePath:    pickString(body.pagePath),
    };

    const intent = await prisma.callIntent.create({
      data,
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(
      { id: intent.id, createdAt: intent.createdAt },
      { status: 201 },
    );
  } catch (err) {
    // Self-diagnosing error response — keep the failure visible so the
    // attribution loop never silently breaks. We log it server-side AND
    // return a 200 (not 500) so the client's tel: dial isn't blocked
    // by a transient DB hiccup.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[call-intent] failed to record intent:", message);
    return NextResponse.json(
      { error: "intent not recorded", details: message },
      { status: 200 },
    );
  }
}
