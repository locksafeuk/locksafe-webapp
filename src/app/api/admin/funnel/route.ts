import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

/**
 * GET /api/admin/funnel?days=7
 * Customer-journey funnel from AnalyticsEvent (page_view + booking steps) + the
 * real Job outcome. Aggregated in JS (event volume is low) so it's robust to
 * the Mongo JSON-path quirks; capped at 20k events per window.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days")) || 7, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const CAP = 20000;

  const events = await prisma.analyticsEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true, data: true, sessionId: true },
    orderBy: { createdAt: "desc" },
    take: CAP,
  });

  const pageViews = events.filter((e) => e.type === "page_view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pathOf = (e: { data: unknown }) => String((e.data as any)?.path ?? "(unknown)");

  const byPath: Record<string, number> = {};
  for (const e of pageViews) byPath[pathOf(e)] = (byPath[pathOf(e)] || 0) + 1;

  const uniqueVisitors = new Set(pageViews.map((e) => e.sessionId).filter(Boolean)).size;
  const reachedBooking = pageViews.filter((e) => pathOf(e).startsWith("/request")).length;
  const submits = events.filter((e) => e.type === "booking_submit").length;
  const jobCreatedEvents = events.filter((e) => e.type === "booking_job_created").length;

  const conversionEvents: Record<string, number> = {};
  for (const e of events) {
    if (e.type.startsWith("conversion_")) conversionEvents[e.type] = (conversionEvents[e.type] || 0) + 1;
  }

  const channelTaps = {
    call: events.filter((e) => e.type === "call_click").length,
    whatsapp: events.filter((e) => e.type === "whatsapp_click").length,
    bookSubmit: submits,
  };

  const jobsInWindow = await prisma.job.count({ where: { createdAt: { gte: since } } });

  const topLandingPages = Object.entries(byPath)
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);

  // Funnel stages with drop-off vs the previous step.
  const stagesRaw = [
    { stage: "Page views", count: pageViews.length },
    { stage: "Reached booking page (/request)", count: reachedBooking },
    { stage: "Submitted booking", count: submits },
    { stage: "Job created", count: jobsInWindow },
  ];
  const funnel = stagesRaw.map((s, i) => {
    const prev = i === 0 ? s.count : stagesRaw[i - 1].count;
    const top = stagesRaw[0].count;
    return {
      ...s,
      pctOfPrev: prev > 0 ? Math.round((s.count / prev) * 1000) / 10 : null,
      pctOfTop: top > 0 ? Math.round((s.count / top) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({
    windowDays: days,
    capped: events.length >= CAP,
    totalEvents: events.length,
    uniqueVisitors,
    funnel,
    channelTaps,
    topLandingPages,
    conversionEvents,
    jobsInWindow,
    jobCreatedEvents,
    note:
      pageViews.length === 0
        ? "No page_view events yet — tracking went live just now; data accrues from here."
        : null,
  });
}
