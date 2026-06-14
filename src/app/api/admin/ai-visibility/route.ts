/**
 * GET  /api/admin/ai-visibility — latest AI-visibility snapshot per
 *   prompt × engine, plus share-of-voice and which competitors get cited
 *   instead. Powers /admin/ai-visibility.
 * POST /api/admin/ai-visibility — manually trigger a run now.
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { buildTrackedPrompts } from "@/lib/ai-visibility/prompts";
import { runAiVisibilityCheck } from "@/lib/ai-visibility/check";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

const ENGINES = ["chatgpt", "gemini", "copilot"] as const;

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull recent snapshots (last 60 days is plenty for "latest + trend").
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const rows: Array<{
    runAt: Date; engine: string; promptId: string; promptText: string;
    category: string; status: string; citedLockSafe: boolean; position: number | null;
    citedUrls: string[]; competitors: string[];
  }> = await prisma.aiVisibilitySnapshot.findMany({
    where: { runAt: { gte: since } },
    orderBy: { runAt: "desc" },
  });

  const prompts = buildTrackedPrompts();

  // Latest snapshot per prompt×engine.
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const k = `${r.promptId}::${r.engine}`;
    if (!latest.has(k)) latest.set(k, r);
  }

  // Share of voice per engine (over prompts that ran OK).
  const sov: Record<string, { ok: number; cited: number; pct: number; lastRunAt: string | null }> = {};
  for (const e of ENGINES) sov[e] = { ok: 0, cited: 0, pct: 0, lastRunAt: null };
  for (const [, r] of latest) {
    if (!(r.engine in sov)) continue;
    if (r.status === "ok") {
      sov[r.engine].ok++;
      if (r.citedLockSafe) sov[r.engine].cited++;
    }
    if (!sov[r.engine].lastRunAt || r.runAt.toISOString() > (sov[r.engine].lastRunAt as string)) {
      sov[r.engine].lastRunAt = r.runAt.toISOString();
    }
  }
  for (const e of ENGINES) sov[e].pct = sov[e].ok > 0 ? Number(((sov[e].cited / sov[e].ok) * 100).toFixed(1)) : 0;

  // Per-prompt matrix.
  const matrix = prompts.map((p) => ({
    id: p.id,
    text: p.text,
    category: p.category,
    engines: Object.fromEntries(
      ENGINES.map((e) => {
        const r = latest.get(`${p.id}::${e}`);
        return [e, r ? {
          status: r.status,
          cited: r.citedLockSafe,
          position: r.position,
          competitors: r.competitors ?? [],
        } : null];
      }),
    ),
  }));

  // Competitors cited instead of us (across latest OK snapshots where we're absent).
  const compTally = new Map<string, number>();
  for (const [, r] of latest) {
    if (r.status === "ok" && !r.citedLockSafe) {
      for (const c of r.competitors ?? []) compTally.set(c, (compTally.get(c) ?? 0) + 1);
    }
  }
  const competitorsCitedInstead = Array.from(compTally.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const hasAnyData = latest.size > 0;
  return NextResponse.json({
    hasAnyData,
    shareOfVoice: sov,
    matrix,
    competitorsCitedInstead,
    promptCount: prompts.length,
  });
}

export async function POST() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runAiVisibilityCheck();
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
