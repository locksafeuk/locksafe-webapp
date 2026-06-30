import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Lightweight, public funnel-event sink. Writes ONE AnalyticsEvent per call so
 * the customer journey (page_view + booking steps) is finally measurable — the
 * only AnalyticsEvent writer before this was the conversion endpoint, which
 * never recorded page_view, leaving the top of the funnel completely blind.
 *
 * Fail-safe by design: tracking must NEVER break the page, so this always
 * returns 200 and swallows errors.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: unknown;
      data?: unknown;
      sessionId?: unknown;
      visitorId?: unknown;
      userId?: unknown;
      userType?: unknown;
    };
    const type = typeof body.type === "string" ? body.type.slice(0, 80) : null;
    if (!type) return NextResponse.json({ ok: false }, { status: 200 });

    await prisma.analyticsEvent.create({
      data: {
        type,
        data: (body.data && typeof body.data === "object" ? body.data : {}) as object,
        // Group events by stable visitor id (stored in sessionId for analysis).
        sessionId:
          typeof body.sessionId === "string"
            ? body.sessionId
            : typeof body.visitorId === "string"
              ? body.visitorId
              : null,
        userId: typeof body.userId === "string" ? body.userId : null,
        userType: typeof body.userType === "string" ? body.userType : null,
      },
    });
  } catch (e) {
    console.warn("[tracking/event] write failed:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
