import { NextRequest, NextResponse } from "next/server";
import {
  trackPageView,
  trackEvent,
  updatePageView,
  updateUserSegment,
  updateEngagementScore,
  updateIntentScore,
} from "@/lib/marketing/tracker";

// POST - Track events, page views, and updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, sessionId, ...data } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    switch (type) {
      case "page_view": {
        const { path, title } = data;
        const pageView = await trackPageView(sessionId, path, title);
        return NextResponse.json({ pageView });
      }

      case "event": {
        const { eventType, element, eventData } = data;
        const event = await trackEvent(sessionId, eventType, element, eventData);
        return NextResponse.json({ event });
      }

      case "update_page_view": {
        const { pageViewId, timeOnPage, scrollDepth } = data;
        if (!pageViewId) {
          return NextResponse.json(
            { error: "Page view ID required" },
            { status: 400 }
          );
        }
        await updatePageView(pageViewId, { timeOnPage, scrollDepth });
        return NextResponse.json({ success: true });
      }

      case "update_segment": {
        const { segments } = data;
        await updateUserSegment(sessionId, segments);
        return NextResponse.json({ success: true });
      }

      case "update_engagement": {
        const { points } = data;
        await updateEngagementScore(sessionId, points);
        return NextResponse.json({ success: true });
      }

      case "update_intent": {
        const { points } = data;
        await updateIntentScore(sessionId, points);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: "Unknown track type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error tracking:", error);
    return NextResponse.json({ error: "Failed to track" }, { status: 500 });
  }
}
