import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession, getSessionWithTracking } from "@/lib/marketing/tracker";

// GET - Get existing session data
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    const session = await getSessionWithTracking(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

// POST - Create or get session
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Ignore invalid/empty JSON payloads and return a validation error below.
      body = {};
    }

    const visitorId   = typeof body.visitorId   === "string" ? body.visitorId   : "";
    const userAgent   = typeof body.userAgent   === "string" ? body.userAgent   : undefined;
    const referrer    = typeof body.referrer    === "string" ? body.referrer    : undefined;
    const utmSource   = typeof body.utmSource   === "string" ? body.utmSource   : undefined;
    const utmMedium   = typeof body.utmMedium   === "string" ? body.utmMedium   : undefined;
    const utmCampaign = typeof body.utmCampaign === "string" ? body.utmCampaign : undefined;
    const utmContent  = typeof body.utmContent  === "string" ? body.utmContent  : undefined;
    const utmTerm     = typeof body.utmTerm     === "string" ? body.utmTerm     : undefined;
    const gclid       = typeof body.gclid       === "string" ? body.gclid       : undefined;
    const fbclid      = typeof body.fbclid      === "string" ? body.fbclid      : undefined;
    const landingPage = typeof body.landingPage === "string" ? body.landingPage : "/";

    if (!visitorId) {
      return NextResponse.json(
        { error: "Visitor ID required" },
        { status: 400 }
      );
    }

    const session = await getOrCreateSession(visitorId, {
      userAgent: userAgent || request.headers.get("user-agent") || "",
      referrer:  referrer  || request.headers.get("referer")    || undefined,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      landingPage,
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
