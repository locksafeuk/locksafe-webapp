/**
 * GET /api/admin/agents/reflections
 *
 * Lists recent agent reflections, newest first. Supports query filters:
 *   ?agent=opportunity-scout
 *   ?outcome=WIN|LOSS|INCONCLUSIVE|NEUTRAL
 *   ?subjectType=opportunity|draft|...
 *   ?limit=50 (max 200)
 *
 * Each reflection is enriched with:
 *   • `verdict`  — a deterministic CONTINUE / OPTIMISE / CHANGE_STRATEGY /
 *                  KEEP_WATCHING / ARCHIVE recommendation (no LLM needed).
 *   • `live`     — the campaign's CURRENT Google Ads serving state + the
 *                  spend/conversions/clicks synced from Google, so the grade
 *                  can be read against present-day reality.
 *
 * NOTE: plain `Request` (not `NextRequest`) on purpose — see the comment in
 * /api/admin/google-ads/coverage/route.ts about the Vercel bundler dropping
 * handlers typed with NextRequest (OPTIONS:204 / GET:404).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { fetchLiveLabels, type LiveStatus } from "@/lib/google-ads-live-status";
import { computeVerdict, type Verdict } from "@/lib/reflection-verdict";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

interface DraftInfo {
  id: string;
  googleCampaignId: string | null;
  totalSpend: number | null;
  totalConversions: number | null;
  totalClicks: number | null;
  lastVerifiedAt: Date | null;
}

// Short cache for the live-labels GAQL call so rapid page reloads don't burn
// developer-token quota. Module-scoped — survives within a warm lambda.
let _liveCache: { at: number; map: Map<string, LiveStatus> } | null = null;
const LIVE_CACHE_TTL_MS = Number(process.env["REFLECTIONS_LIVE_CACHE_TTL_MS"] ?? "60000");

export async function GET(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agent = searchParams.get("agent");
  const outcome = searchParams.get("outcome");
  const subjectType = searchParams.get("subjectType");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50)));

  const where: Record<string, string> = {};
  if (agent) where.agentName = agent;
  if (outcome) where.outcome = outcome;
  if (subjectType) where.subjectType = subjectType;

  const reflections = await p.agentReflection.findMany({
    where,
    orderBy: { computedAt: "desc" },
    take: limit,
  });

  const counts = await p.agentReflection.groupBy({
    by: ["outcome"],
    _count: { _all: true },
  });

  // ---- Resolve each reflection's underlying Google campaign + synced totals ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = reflections as any[];

  const draftIds = new Set<string>();
  const oppIds = new Set<string>();
  const suggestionIds = new Set<string>();
  for (const r of rows) {
    if (r.subjectType === "draft") draftIds.add(r.subjectId);
    else if (r.subjectType === "opportunity") oppIds.add(r.subjectId);
    else if (r.subjectType === "suggestion") suggestionIds.add(r.subjectId);
  }

  // opportunity → draftId
  const oppDraft = new Map<string, string>();
  if (oppIds.size > 0) {
    const opps = await p.googleAdsOpportunity.findMany({
      where: { id: { in: [...oppIds] } },
      select: { id: true, draftId: true },
    });
    for (const o of opps) {
      if (o.draftId) {
        oppDraft.set(o.id, o.draftId);
        draftIds.add(o.draftId);
      }
    }
  }

  // suggestion → googleCampaignId
  const sugCampaign = new Map<string, string | null>();
  if (suggestionIds.size > 0) {
    const sugs = await p.campaignSuggestion.findMany({
      where: { id: { in: [...suggestionIds] } },
      select: { id: true, googleCampaignId: true },
    });
    for (const s of sugs) sugCampaign.set(s.id, s.googleCampaignId ?? null);
  }

  // drafts by id (+ index by googleCampaignId for suggestion rows)
  const draftById = new Map<string, DraftInfo>();
  const draftByCampaign = new Map<string, DraftInfo>();
  if (draftIds.size > 0 || sugCampaign.size > 0) {
    const campaignIdsForDrafts = [...sugCampaign.values()].filter((c): c is string => !!c);
    const drafts = await p.googleAdsCampaignDraft.findMany({
      where: {
        OR: [
          { id: { in: [...draftIds] } },
          ...(campaignIdsForDrafts.length ? [{ googleCampaignId: { in: campaignIdsForDrafts } }] : []),
        ],
      },
      select: {
        id: true, googleCampaignId: true, totalSpend: true,
        totalConversions: true, totalClicks: true, lastVerifiedAt: true,
      },
    });
    for (const d of drafts as DraftInfo[]) {
      draftById.set(d.id, d);
      if (d.googleCampaignId) draftByCampaign.set(d.googleCampaignId, d);
    }
  }

  // Resolve a (campaignId, draftInfo) pair per reflection.
  function resolve(r: { subjectType: string; subjectId: string }): {
    campaignId: string | null; draft: DraftInfo | null;
  } {
    if (r.subjectType === "draft") {
      const d = draftById.get(r.subjectId) ?? null;
      return { campaignId: d?.googleCampaignId ?? null, draft: d };
    }
    if (r.subjectType === "opportunity") {
      const dId = oppDraft.get(r.subjectId);
      const d = dId ? draftById.get(dId) ?? null : null;
      return { campaignId: d?.googleCampaignId ?? null, draft: d };
    }
    if (r.subjectType === "suggestion") {
      const cid = sugCampaign.get(r.subjectId) ?? null;
      return { campaignId: cid, draft: cid ? draftByCampaign.get(cid) ?? null : null };
    }
    return { campaignId: null, draft: null };
  }

  // ---- Pull live Google Ads serving labels (one batched GAQL, cached) ----
  const allCampaignIds = new Set<string>();
  for (const r of rows) {
    const { campaignId } = resolve(r);
    if (campaignId) allCampaignIds.add(campaignId);
  }

  let liveMap = new Map<string, LiveStatus>();
  let liveError: string | null = null;
  if (allCampaignIds.size > 0) {
    if (_liveCache && Date.now() - _liveCache.at < LIVE_CACHE_TTL_MS) {
      liveMap = _liveCache.map;
    } else {
      try {
        liveMap = await fetchLiveLabels([...allCampaignIds]);
        _liveCache = { at: Date.now(), map: liveMap };
      } catch (err) {
        // Degrade gracefully — verdicts still compute from stored grade data.
        liveError = err instanceof Error ? err.message : String(err);
        console.warn("[reflections] live-label fetch failed:", liveError);
      }
    }
  }

  // ---- Attach verdict + live state to every reflection ----
  const verdictCounts: Record<string, number> = {};
  const enriched = rows.map((r) => {
    const { campaignId, draft } = resolve(r);
    const liveStatus = campaignId ? liveMap.get(campaignId) ?? null : null;
    const live = {
      campaignId,
      label: liveStatus?.label ?? null,
      campaignStatus: liveStatus?.campaignStatus ?? null,
      spend: draft?.totalSpend ?? null,
      conversions: draft?.totalConversions ?? null,
      clicks: draft?.totalClicks ?? null,
      lastVerifiedAt: draft?.lastVerifiedAt ?? null,
    };
    const verdict: Verdict = computeVerdict({
      outcome: r.outcome,
      metric: r.metric,
      expectedValue: r.expectedValue ?? null,
      actualValue: r.actualValue ?? null,
      confidence: r.confidence ?? 0,
      windowDays: r.windowDays ?? 28,
      live,
    });
    verdictCounts[verdict.code] = (verdictCounts[verdict.code] ?? 0) + 1;
    return { ...r, live, verdict };
  });

  return NextResponse.json({
    reflections: enriched,
    counts: (counts as Array<{ outcome: string; _count: { _all: number } }>).reduce(
      (acc: Record<string, number>, c) => {
        acc[c.outcome] = c._count._all;
        return acc;
      },
      {} as Record<string, number>,
    ),
    verdictCounts,
    liveError,
    generatedAt: new Date().toISOString(),
  });
}
