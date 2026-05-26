/**
 * District Landing Page Generation Cron
 *
 * Runs nightly. For every district that has active LocksmithCoverage rows,
 * calls ensureOrSkip — which creates a new page if missing, regenerates a
 * stale or needs_refresh page, and silently reuses anything fresh.
 * manual_override pages are always left untouched.
 *
 * Schedule: 0 2 * * * (02:00 UTC daily)
 * Auth: Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma as _prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { ensureOrSkip } from "@/lib/district-landing/ensure-landing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  // ── 1. Find all districts with at least one active coverage row ─────
  const coverageRows: Array<{ district: string }> =
    await prisma.locksmithCoverage.findMany({
      where:    { isActive: true },
      select:   { district: true },
      distinct: ["district"],
      orderBy:  { district: "asc" },
    });

  const districts = coverageRows.map((r: { district: string }) => r.district.trim().toUpperCase());

  if (districts.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No covered districts found",
      durationMs: Date.now() - start,
    });
  }

  // ── 2. Run ensureOrSkip for every district ──────────────────────────
  // Concurrency is intentionally serial: each call hits Ollama (GPU-bound)
  // and we don't want to saturate the model server or race on DB upserts.
  const summary = {
    total:       districts.length,
    created:     0,
    regenerated: 0,
    reused:      0,
    keptManual:  0,
    skipped:     0,
    errors:      0,
  };

  const errorLog: Array<{ district: string; error: string }> = [];

  for (const district of districts) {
    try {
      const result = await ensureOrSkip(district);

      if (!result.ok) {
        summary.skipped++;
        continue;
      }

      switch (result.result?.action) {
        case "created":     summary.created++;     break;
        case "regenerated": summary.regenerated++;  break;
        case "reused":      summary.reused++;       break;
        case "kept_manual": summary.keptManual++;   break;
        default:            summary.reused++;       break;
      }
    } catch (err) {
      summary.errors++;
      errorLog.push({
        district,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const durationMs = Date.now() - start;

  console.log(
    `[district-landings cron] ${summary.created} created, ` +
    `${summary.regenerated} regenerated, ${summary.reused} reused, ` +
    `${summary.keptManual} manual, ${summary.skipped} skipped, ` +
    `${summary.errors} errors — ${durationMs}ms`,
  );

  return NextResponse.json({
    success: true,
    summary,
    errors:  errorLog.length > 0 ? errorLog : undefined,
    durationMs,
  });
}
