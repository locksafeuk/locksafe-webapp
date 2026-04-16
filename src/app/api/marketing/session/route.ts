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
    const body = await request.json();
    const { visitorId, userAgent, referrer, utmSource, utmMedium, utmCampaign, landingPage } = body;

    if (!visitorId) {
      return NextResponse.json(
        { error: "Visitor ID required" },
        { status: 400 }
      );
    }

    const session = await getOrCreateSession(visitorId, {
      userAgent: userAgent || request.headers.get("user-agent") || "",
      referrer: referrer || request.headers.get("referer") || undefined,
      utmSource,
      utmMedium,
      utmCampaign,
      landingPage: landingPage || "/",
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
