/**
 * GET /api/admin/diag-traffic-quality
 *
 * Direct DB query — answer the question "of the 93 google sessions in
 * the last 7 days, how many actually engaged?" by counting:
 *   - TelLinkAttribution rows (someone clicked a tel: link)
 *   - CallIntent rows (CallIntent fired, attribution to ad)
 *   - VoiceCall rows (Retell answered a call)
 *   - Job rows created in window
 *
 * Cross-cut by utmSource to isolate google/cpc vs google/organic.
 *
 * Auth: admin JWT cookie.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

export async function GET(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? "7");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  const [
    sessionsTotal,
    sessionsGoogle,
    sessionsGoogleWithGclid,
    telLinkRows,
    telLinkGoogle,
    callIntentRows,
    callIntentMatched,
    voiceCallRows,
    jobsCreated,
    jobsWithGclid,
  ] = await Promise.all([
    p.userSession.count({ where: { startedAt: { gte: since } } }).catch(() => null),
    p.userSession.count({ where: { startedAt: { gte: since }, utmSource: "google" } }).catch(() => null),
    p.userSession.count({ where: { startedAt: { gte: since }, utmSource: "google", gclid: { not: null } } }).catch(() => null),
    p.telLinkAttribution.count({ where: { createdAt: { gte: since } } }).catch(() => null),
    p.telLinkAttribution.count({ where: { createdAt: { gte: since }, utmSource: "google" } }).catch(() => null),
    p.callIntent.count({ where: { createdAt: { gte: since } } }).catch(() => null),
    p.callIntent.count({ where: { createdAt: { gte: since }, matched: true } }).catch(() => null),
    p.voiceCall.count({ where: { createdAt: { gte: since } } }).catch(() => null),
    p.job.count({ where: { createdAt: { gte: since } } }).catch(() => null),
    p.job.count({ where: { createdAt: { gte: since }, gclid: { not: null } } }).catch(() => null),
  ]);

  // Last 10 google sessions — see if they have gclid, landing path, referrer.
  let recentGoogleSessions: unknown = null;
  try {
    recentGoogleSessions = await p.userSession.findMany({
      where: { startedAt: { gte: since }, utmSource: "google" },
      select: {
        startedAt: true,
        gclid: true,
        utmCampaign: true,
        utmMedium: true,
        utmTerm: true,
        landingPath: true,
        deviceType: true,
        browser: true,
        referrer: true,
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    });
  } catch (err) {
    recentGoogleSessions = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    windowDays: days,
    since: since.toISOString(),
    funnel: {
      _sessions_total: sessionsTotal,
      _sessions_from_google_utm: sessionsGoogle,
      _sessions_from_google_with_gclid: sessionsGoogleWithGclid,
      _tel_link_clicks_total: telLinkRows,
      _tel_link_clicks_from_google: telLinkGoogle,
      _call_intents_total: callIntentRows,
      _call_intents_matched_to_call: callIntentMatched,
      _voice_calls_received: voiceCallRows,
      _jobs_created: jobsCreated,
      _jobs_with_gclid: jobsWithGclid,
    },
    interpretation: {
      pct_google_sessions_with_gclid:
        sessionsGoogle && sessionsGoogleWithGclid !== null
          ? `${Math.round((sessionsGoogleWithGclid / sessionsGoogle) * 100)}%`
          : null,
      pct_google_sessions_clicking_tel:
        sessionsGoogle && telLinkGoogle !== null
          ? `${Math.round((telLinkGoogle / sessionsGoogle) * 100)}%`
          : null,
      pct_jobs_with_gclid:
        jobsCreated && jobsWithGclid !== null
          ? `${Math.round((jobsWithGclid / jobsCreated) * 100)}%`
          : null,
    },
    recentGoogleSessions,
  });
}
